import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'

// GET /api/cron/register-webhooks
// Re-registers Telegram webhooks for all online bots.
// Protected by CRON_SECRET — call once to fix webhook registration drift.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const appUrl = process.env.APP_URL
  if (!appUrl) return NextResponse.json({ error: 'APP_URL not set' }, { status: 500 })

  const { data: bots, error } = await supabase
    .from('bots')
    .select('id, name, token, webhook_secret')
    .not('token', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { bot: string; ok: boolean; detail: string }[] = []

  for (const bot of bots ?? []) {
    const webhookUrl = `${appUrl}/api/telegram/webhook?bot_id=${bot.id}`
    try {
      const plainToken = decryptToken(bot.token as string)
      const res = await fetch(
        `https://api.telegram.org/bot${plainToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: bot.webhook_secret,
            allowed_updates: ['message', 'callback_query', 'pre_checkout_query', 'successful_payment', 'channel_post', 'edited_channel_post'],
          }),
        },
      )
      const tg = await res.json() as { ok: boolean; description?: string }
      if (tg.ok) {
        await supabase
          .from('bots')
          .update({ status: 'online', webhook_url: webhookUrl, last_sync: new Date().toISOString() })
          .eq('id', bot.id)
        results.push({ bot: bot.name, ok: true, detail: 'webhook registered' })
      } else {
        results.push({ bot: bot.name, ok: false, detail: tg.description ?? 'telegram error' })
      }
    } catch (err) {
      results.push({ bot: bot.name, ok: false, detail: String(err) })
    }
  }

  return NextResponse.json({ registered: results.length, results })
}
