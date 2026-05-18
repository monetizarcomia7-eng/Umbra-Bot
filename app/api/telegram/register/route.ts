import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

// POST /api/telegram/register
// Body: { bot_id: string }
// Registers (or updates) the webhook URL with Telegram for a bot owned by the authenticated user.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 10 webhook registrations per user per 10 minutes
  const rl = rateLimit(`tg-register:${user.id}`, 10, 10 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'muitas requisições, aguarde alguns minutos' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  let body: { bot_id?: string }
  try { body = await request.json() } catch { body = {} }

  const { bot_id } = body
  if (!bot_id) return NextResponse.json({ error: 'bot_id required' }, { status: 400 })

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, user_id, token, webhook_secret')
    .eq('id', bot_id)
    .eq('user_id', user.id)
    .single()

  if (botError || !bot) {
    return NextResponse.json({ error: 'bot not found' }, { status: 404 })
  }

  const appUrl = process.env.APP_URL
  if (!appUrl) return NextResponse.json({ error: 'APP_URL not configured' }, { status: 500 })

  const webhookUrl = `${appUrl}/api/telegram/webhook?bot_id=${bot.id}`

  const telegramRes = await fetch(
    `https://api.telegram.org/bot${bot.token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:          webhookUrl,
        secret_token: bot.webhook_secret,
        allowed_updates: ['message', 'callback_query', 'pre_checkout_query', 'successful_payment'],
      }),
    },
  )

  const telegramData = await telegramRes.json()
  if (!telegramData.ok) {
    return NextResponse.json({ error: telegramData.description }, { status: 400 })
  }

  // Update bot status to active
  await supabase
    .from('bots')
    .update({ status: 'active' })
    .eq('id', bot.id)

  return NextResponse.json({ ok: true, webhook_url: webhookUrl })
}
