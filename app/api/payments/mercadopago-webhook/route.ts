import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Verifies Mercado Pago webhook signature.
// MP sends: x-signature: ts=<ts>,v1=<hmac>
// We compute: HMAC-SHA256(secret, "id:<payment_id>;request-id:<x-request-id>;ts:<ts>")
function verifyMpSignature(request: NextRequest, rawBody: string, paymentId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return true // not configured — skip verification in dev

  const signature = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id') ?? ''
  if (!signature) return false

  const ts = signature.match(/ts=([^,]+)/)?.[1] ?? ''
  const v1 = signature.match(/v1=([^,]+)/)?.[1] ?? ''

  const message = `id:${paymentId};request-id:${requestId};ts:${ts}`
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
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
  await supabase
    .from('transactions')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', tx.id)

  // On approval: log event and notify buyer via Telegram
  if (newStatus === 'approved') {
    const amount = Number(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    await supabase.from('activity_events').insert({
      user_id:     tx.user_id,
      bot_id:      tx.bot_id,
      type:        'sale',
      title:       `Venda aprovada: ${tx.product_name}`,
      description: `${tx.customer_name} · ${amount}`,
      amount:      tx.amount,
    })

    // Send confirmation to buyer if we know their Telegram ID
    if (tx.customer_telegram_id && tx.bot_id) {
      const { data: bot } = await supabase
        .from('bots')
        .select('token')
        .eq('id', tx.bot_id)
        .single()

      if (bot?.token) {
        await sendTelegramMessage(
          bot.token,
          tx.customer_telegram_id,
          `✅ <b>Pagamento confirmado!</b>\n\nProduto: <b>${tx.product_name}</b>\nValor: <b>${amount}</b>\n\nObrigado pela sua compra! 🎉`,
        )
      }
    }
  }

  return new NextResponse(null, { status: 200 })
}
