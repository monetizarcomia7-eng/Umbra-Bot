import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

interface PixBody {
  amount: number           // valor em reais (ex: 97.00)
  product_name: string
  customer_name: string
  customer_email: string
  customer_cpf: string     // CPF sem pontuação
  customer_telegram_id?: string
  bot_id?: string
  description?: string
}

// POST /api/payments/pix
// Creates a PIX payment via Mercado Pago and stores it in the transactions table.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 10 PIX payments per user per hour
  const rl = await rateLimit(`pix:${user.id}`, 10, 60 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'muitas requisições, tente novamente mais tarde' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ error: 'gateway não configurado' }, { status: 500 })
  }

  let body: PixBody
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'json inválido' }, { status: 400 })
  }

  const { amount, product_name, customer_name, customer_email, customer_cpf, customer_telegram_id, bot_id, description } = body

  if (!amount || amount <= 0) return NextResponse.json({ error: 'valor inválido' }, { status: 400 })
  if (!customer_name || !customer_email || !customer_cpf) {
    return NextResponse.json({ error: 'dados do comprador incompletos' }, { status: 400 })
  }

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
    return NextResponse.json({ error: mpErr.message ?? 'erro no gateway' }, { status: 502 })
  }

  const mpData = await mpRes.json()
  const pixInfo = mpData.point_of_interaction?.transaction_data

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

  // Persist transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id:               user.id,
      bot_id:                bot_id ?? null,
      gateway:               'mercadopago',
      gateway_payment_id:    String(mpData.id),
      amount,
      fee:                   amount * 0.0399 + 0.4, // MP fee approximation
      status:                'pending',
      pix_qr_code:           pixInfo?.qr_code_base64 ?? null,
      pix_copy_paste:        pixInfo?.qr_code ?? null,
      pix_expires_at:        expiresAt,
      product_name,
      customer_name,
      customer_email,
      customer_telegram_id:  customer_telegram_id ?? null,
    })
    .select('id')
    .single()

  if (txError) {
    return NextResponse.json({ error: 'erro ao salvar transação' }, { status: 500 })
  }

  return NextResponse.json({
    transaction_id:  transaction.id,
    pix_copy_paste:  pixInfo?.qr_code,
    pix_qr_code:     pixInfo?.qr_code_base64,
    expires_at:      expiresAt,
    amount,
  })
}
