import { NextResponse, type NextRequest } from 'next/server'
import { z }                  from 'zod'
import { createAdminClient }  from '@/lib/supabase/admin'
import { decryptToken }       from '@/lib/crypto'
import { rateLimit }          from '@/lib/rate-limit'
import { fireCapiPurchase }   from '@/lib/capi'
import * as Sentry            from '@sentry/nextjs'

/* ─── Validation ─────────────────────────────────────────── */

const paySchema = z.object({
  checkout_id:    z.string().uuid('checkout_id inválido.'),
  customer_name:  z.string().min(2,  'Nome deve ter ao menos 2 caracteres.').max(150),
  customer_email: z.string().email('E-mail inválido.'),
  customer_cpf:   z.string()
                   .transform((v) => v.replace(/\D/g, ''))
                   .pipe(z.string().length(11, 'CPF deve ter 11 dígitos.')),
  customer_phone: z.string().max(20).nullish(),
  method:         z.enum(['pix', 'card', 'boleto']),
  utm_source:     z.string().max(100).nullish(),
  utm_medium:     z.string().max(100).nullish(),
  utm_campaign:   z.string().max(100).nullish(),
})

/* ─── POST /api/checkout/pay ─────────────────────────────── */
// Endpoint público (sem auth de usuário) — usa admin client para buscar
// as credenciais do dono do checkout e criar um pagamento PIX via MP.

export async function POST(request: NextRequest) {
  // Rate limit por IP: 20 req/min — previne abuso sem bloquear compradores legítimos
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`checkout_pay:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const parsed = paySchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const {
    checkout_id, customer_name, customer_email, customer_cpf,
    customer_phone, method, utm_source, utm_medium, utm_campaign,
  } = parsed.data

  const customerPhone = customer_phone ?? null

  const admin = createAdminClient()

  /* ── 1. Busca checkout + dono ──────────────────────────── */
  const { data: checkout } = await admin
    .from('checkouts')
    .select('id, user_id, product_name, price, installments, gateway, methods')
    .eq('id', checkout_id)
    .eq('status', 'published')
    .maybeSingle()

  if (!checkout) {
    return NextResponse.json({ error: 'Checkout não encontrado ou não publicado.' }, { status: 404 })
  }

  const methods = (checkout.methods ?? {}) as Record<string, boolean>
  if (!methods[method]) {
    return NextResponse.json({ error: `Método "${method}" não disponível neste checkout.` }, { status: 400 })
  }

  /* ── 2. Busca gateway do dono ──────────────────────────── */
  const { data: gateway } = await admin
    .from('gateways')
    .select('credentials')
    .eq('user_id', checkout.user_id)
    .eq('provider', checkout.gateway)
    .eq('connected', true)
    .maybeSingle()

  let accessToken: string | null = null

  if (gateway?.credentials) {
    const rawToken = (gateway.credentials as Record<string, unknown>).token
    if (rawToken && typeof rawToken === 'string') {
      accessToken = decryptToken(rawToken)
    }
  }

  // Fallback para variável de ambiente global (ambiente de desenvolvimento/demo)
  if (!accessToken) {
    accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? null
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'Gateway de pagamento não configurado.' }, { status: 503 })
  }

  /* ── 3. Cria pagamento PIX no Mercado Pago ─────────────── */
  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'Authorization':   `Bearer ${accessToken}`,
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: Number(checkout.price),
      description:        checkout.product_name,
      payment_method_id:  'pix',
      payer: {
        email:      customer_email,
        first_name: customer_name.split(' ')[0],
        last_name:  customer_name.split(' ').slice(1).join(' ') || '',
        identification: { type: 'CPF', number: customer_cpf },
      },
    }),
  })

  if (!mpRes.ok) {
    const mpErr = await mpRes.json().catch(() => ({}))
    Sentry.captureException(
      new Error(`checkout_pay MP error: ${mpErr.message ?? mpRes.status}`),
      { extra: { checkout_id, status: mpRes.status, body: mpErr } },
    )
    return NextResponse.json(
      { error: mpErr.message ?? 'Erro no gateway de pagamento. Tente novamente.' },
      { status: 502 },
    )
  }

  const mpData  = await mpRes.json()
  const pixInfo = mpData.point_of_interaction?.transaction_data
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const fee = Number(checkout.price) * 0.0399 + 0.4
  const net = Number(checkout.price) - fee

  /* ── 4. Persiste transação ─────────────────────────────── */
  const { data: transaction, error: txError } = await admin
    .from('transactions')
    .insert({
      user_id:            checkout.user_id,
      checkout_id:        checkout.id,
      gateway:            checkout.gateway,
      gateway_payment_id: String(mpData.id),
      amount:             Number(checkout.price),
      fee,
      net,
      type:               'sale',
      payment_method:     method,
      status:             'pending',
      pix_qr_code:        pixInfo?.qr_code_base64 ?? null,
      pix_copy_paste:     pixInfo?.qr_code ?? null,
      pix_expires_at:     expiresAt,
      product_name:       checkout.product_name,
      customer_name,
      customer_email,
      customer_phone:     customerPhone,
      utm_source:         utm_source ?? null,
      utm_medium:         utm_medium ?? null,
      utm_campaign:       utm_campaign ?? null,
    })
    .select('id')
    .single()

  if (txError) {
    Sentry.captureException(txError, { extra: { checkout_id, context: 'checkout_pay_tx_insert' } })
    return NextResponse.json({ error: 'Erro ao registrar transação.' }, { status: 500 })
  }

  /* ── 5. Registra evento 'paid' no funil (fire-and-forget) ─ */
  admin.from('checkout_events').insert({
    user_id:     checkout.user_id,
    checkout_id: checkout.id,
    event_type:  'cart_added',
    product_name: checkout.product_name,
    utm_source:   utm_source ?? null,
    utm_medium:   utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
  }).then(({ error }) => {
    if (error) Sentry.captureException(error, { extra: { checkout_id, txId: transaction?.id, context: 'checkout_pay_event' } })
  })

  /* ── 6. CAPI fire-and-forget (se aprovado via webhook) ─── */
  // O CAPI real é disparado no webhook do MP ao confirmar status='approved'.
  // Aqui não disparamos pois o pagamento ainda está pendente.

  return NextResponse.json({
    transaction_id: transaction?.id,
    pix_qr_code:    pixInfo?.qr_code_base64,
    pix_copy_paste: pixInfo?.qr_code,
    expires_at:     expiresAt,
    amount:         Number(checkout.price),
  })
}
