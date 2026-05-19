import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { captureEvent } from '@/lib/analytics-server'
import { getMercadoPagoToken } from '@/lib/gateway'
import * as Sentry from '@sentry/nextjs'

const pixSchema = z.object({
  amount:               z.number({ error: 'Valor deve ser um número.' })
                         .positive('Valor deve ser maior que zero.')
                         .max(50_000, 'Valor máximo por transação: R$50.000.'),
  product_name:         z.string().min(1, 'Nome do produto obrigatório.').max(200),
  customer_name:        z.string().min(2, 'Nome do cliente obrigatório.').max(150),
  customer_email:       z.string().email('E-mail inválido.'),
  // Aceita CPF com ou sem formatação (000.000.000-00 ou 00000000000)
  customer_cpf:         z.string()
                         .transform((v) => v.replace(/\D/g, ''))
                         .pipe(z.string().length(11, 'CPF deve ter 11 dígitos.')),
  customer_telegram_id: z.string().max(50).optional(),
  bot_id:               z.string().uuid('bot_id inválido.').optional(),
  flow_id:              z.string().uuid('flow_id inválido.').optional(),
  description:          z.string().max(200).optional(),
  // Rastreamento de origem (UTM)
  utm_source:           z.string().max(100).optional(),
  utm_medium:           z.string().max(100).optional(),
  utm_campaign:         z.string().max(100).optional(),
  utm_content:          z.string().max(100).optional(),
})

// POST /api/payments/pix
// Creates a PIX payment via Mercado Pago and stores it in the transactions table.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // 10 PIX payments per user per hour
  const rl = await rateLimit(`pix:${user.id}`, 10, 60 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  // Usa credenciais do próprio usuário se cadastradas; cai no env var global
  const accessToken = await getMercadoPagoToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gateway não configurado.' }, { status: 500 })
  }

  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const parsed = pixSchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const {
    amount, product_name, customer_name, customer_email, customer_cpf,
    customer_telegram_id, bot_id, flow_id, description,
    utm_source, utm_medium, utm_campaign, utm_content,
  } = parsed.data

  // Create payment on Mercado Pago
  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: description ?? product_name,
      payment_method_id: 'pix',
      payer: {
        email: customer_email,
        first_name: customer_name.split(' ')[0],
        last_name: customer_name.split(' ').slice(1).join(' ') || '',
        identification: { type: 'CPF', number: customer_cpf.replace(/\D/g, '') },
      },
    }),
  })

  if (!mpRes.ok) {
    const mpErr = await mpRes.json().catch(() => ({}))
    Sentry.captureException(new Error(`MercadoPago PIX error: ${mpErr.message ?? mpRes.status}`), {
      extra: { status: mpRes.status, body: mpErr },
    })
    return NextResponse.json({ error: mpErr.message ?? 'erro no gateway' }, { status: 502 })
  }

  const mpData = await mpRes.json()
  const pixInfo = mpData.point_of_interaction?.transaction_data

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

  const fee = amount * 0.0399 + 0.4 // aproximação da taxa MP: 3,99% + R$0,40
  const net = amount - fee

  // Persist transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id:               user.id,
      bot_id:                bot_id ?? null,
      flow_id:               flow_id ?? null,
      gateway:               'mercadopago',
      gateway_payment_id:    String(mpData.id),
      amount,
      fee,
      net,
      type:                  'sale',
      payment_method:        'pix',
      status:                'pending',
      pix_qr_code:           pixInfo?.qr_code_base64 ?? null,
      pix_copy_paste:        pixInfo?.qr_code ?? null,
      pix_expires_at:        expiresAt,
      product_name,
      customer_name,
      customer_email,
      customer_telegram_id:  customer_telegram_id ?? null,
      utm_source:            utm_source ?? null,
      utm_medium:            utm_medium ?? null,
      utm_campaign:          utm_campaign ?? null,
      utm_content:           utm_content ?? null,
    })
    .select('id')
    .single()

  if (txError) {
    Sentry.captureException(txError, { extra: { user_id: user.id, amount, product_name } })
    return NextResponse.json({ error: 'erro ao salvar transação' }, { status: 500 })
  }

  // Registra evento cart_added no funil de conversão (fire-and-forget)
  supabase.from('checkout_events').insert({
    user_id:        user.id,
    bot_id:         bot_id ?? null,
    flow_id:        flow_id ?? null,
    transaction_id: transaction.id,
    event_type:     'cart_added',
    product_name,
    utm_source:     utm_source ?? null,
    utm_medium:     utm_medium ?? null,
    utm_campaign:   utm_campaign ?? null,
  }).then(({ error }) => {
    if (error) Sentry.captureException(error, { extra: { txId: transaction.id, context: 'pix_cart_added_event' } })
  })

  // Registra evento de atividade: pagamento PIX iniciado (fire-and-forget)
  supabase.from('activity_events').insert({
    user_id:     user.id,
    bot_id:      bot_id ?? null,
    type:        'payment',
    title:       `Pagamento iniciado — ${product_name}`,
    description: `${customer_name} · ${Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} via Pix`,
    amount,
  }).then(({ error }) => {
    if (error) Sentry.captureException(error, { extra: { txId: transaction.id, context: 'pix_activity_event' } })
  })

  await captureEvent(user.id, 'pix_payment_created', { amount, product_name })

  return NextResponse.json({
    transaction_id:  transaction.id,
    pix_copy_paste:  pixInfo?.qr_code,
    pix_qr_code:     pixInfo?.qr_code_base64,
    expires_at:      expiresAt,
    amount,
  })
}
