import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'

// Verifies Mercado Pago webhook signature.
// MP sends: x-signature: ts=<ts>,v1=<hmac>
// We compute: HMAC-SHA256(secret, "id:<payment_id>;request-id:<x-request-id>;ts:<ts>")
function verifyMpSignature(request: NextRequest, rawBody: string, paymentId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // block in prod if unconfigured

  const signature = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id') ?? ''
  if (!signature) return false

  const ts = signature.match(/ts=([^,]+)/)?.[1] ?? ''
  const v1 = signature.match(/v1=([^,]+)/)?.[1] ?? ''

  const message = `id:${paymentId};request-id:${requestId};ts:${ts}`
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
}

// POST /api/payments/mercadopago-webhook
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  let event: { type?: string; data?: { id?: string } }
  try { event = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Only handle payment notifications
  if (event.type !== 'payment') return new NextResponse(null, { status: 200 })

  const paymentId = event.data?.id
  if (!paymentId) return new NextResponse(null, { status: 200 })

  // Verify signature
  if (!verifyMpSignature(request, rawBody, paymentId)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  // Fetch payment details from MP
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  })
  if (!mpRes.ok) return new NextResponse(null, { status: 200 })

  const payment = await mpRes.json()
  const mpStatus: string = payment.status // approved | pending | rejected | cancelled

  const statusMap: Record<string, string> = {
    approved:  'approved',
    pending:   'pending',
    rejected:  'cancelled',
    cancelled: 'cancelled',
  }
  const newStatus = statusMap[mpStatus] ?? 'pending'

  const supabase = await createClient()

  // Find our transaction by gateway_payment_id
  const { data: tx } = await supabase
    .from('transactions')
    .select('id, user_id, bot_id, customer_telegram_id, customer_name, amount, product_name, status')
    .eq('gateway_payment_id', String(paymentId))
    .eq('gateway', 'mercadopago')
    .single()

  if (!tx) return new NextResponse(null, { status: 200 })

  // Avoid re-processing
  if (tx.status === newStatus) return new NextResponse(null, { status: 200 })

  // Update transaction status
  const { error: updateError } = await supabase
    .from('transactions')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', tx.id)

  if (updateError) {
    Sentry.captureException(updateError, { extra: { paymentId, txId: tx.id, context: 'mp_webhook_update' } })
    return new NextResponse(null, { status: 200 }) // responde 200 para MP não retentar
  }

  const fmtBRL = (v: number) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ── Aprovada ────────────────────────────────────────────────────────────────
  if (newStatus === 'approved') {
    const amountFmt = fmtBRL(Number(tx.amount))

    // 1. Log de atividade
    const { error: activityError } = await supabase.from('activity_events').insert({
      user_id:     tx.user_id,
      bot_id:      tx.bot_id,
      type:        'sale',
      title:       `Venda aprovada: ${tx.product_name}`,
      description: `${tx.customer_name} · ${amountFmt}`,
      amount:      tx.amount,
    })
    if (activityError) {
      Sentry.captureException(activityError, { extra: { txId: tx.id, context: 'mp_webhook_activity' } })
    }

    // 2. Alerta para o operador no dashboard
    await supabase.from('alerts').insert({
      user_id:     tx.user_id,
      type:        'sale',
      severity:    'info',
      title:       `Nova venda: ${tx.product_name}`,
      description: `${tx.customer_name} · ${amountFmt}`,
    }).then(({ error }) => {
      if (error) Sentry.captureException(error, { extra: { txId: tx.id, context: 'mp_webhook_alert' } })
    })

    // 3. Mensagem de confirmação para o comprador via Telegram
    if (tx.customer_telegram_id && tx.bot_id) {
      const { data: bot } = await supabase
        .from('bots')
        .select('token')
        .eq('id', tx.bot_id)
        .single()

      if (bot?.token) {
        await sendTelegramMessage(
          decryptToken(bot.token),
          tx.customer_telegram_id,
          `✅ <b>Pagamento confirmado!</b>\n\nProduto: <b>${tx.product_name}</b>\nValor: <b>${amountFmt}</b>\n\nObrigado pela sua compra! 🎉`,
        ).catch((err) => {
          Sentry.captureException(err, { extra: { txId: tx.id, context: 'mp_webhook_telegram_notify' } })
        })
      }
    }
  }

  // ── PIX expirado / cancelado → follow-up para o comprador ──────────────────
  if (newStatus === 'cancelled' && tx.status === 'pending' && tx.customer_telegram_id && tx.bot_id) {
    const { data: bot } = await supabase
      .from('bots')
      .select('token')
      .eq('id', tx.bot_id)
      .single()

    if (bot?.token) {
      await sendTelegramMessage(
        decryptToken(bot.token),
        tx.customer_telegram_id,
        `⏳ <b>Seu PIX expirou!</b>\n\nO pagamento de <b>${tx.product_name}</b> não foi concluído a tempo.\n\nSe ainda tiver interesse, entre em contato para gerar um novo link de pagamento.`,
      ).catch((err) => {
        Sentry.captureException(err, { extra: { txId: tx.id, context: 'mp_webhook_pix_expired' } })
      })
    }
  }

  return new NextResponse(null, { status: 200 })
}
