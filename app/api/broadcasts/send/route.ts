import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RATE_LIMIT_MS = 35 // ~28 messages/second (under Telegram's 30/s limit)

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  buttons?: { label: string; url: string }[],
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }

  if (buttons && buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: [buttons.map((b) => ({ text: b.label, url: b.url }))],
    }
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

// POST /api/broadcasts/send
// Body: { broadcast_id: string }
// Fetches the broadcast from DB, sends to all contacts with rate limiting.
// Long-running — suitable for broadcasts up to ~5000 contacts within 300s timeout.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { broadcast_id?: string }
  try { body = await request.json() } catch { body = {} }

  const { broadcast_id } = body
  if (!broadcast_id) return NextResponse.json({ error: 'broadcast_id required' }, { status: 400 })

  // Fetch broadcast (must belong to this user)
  const { data: broadcast, error: brErr } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', broadcast_id)
    .eq('user_id', user.id)
    .single()

  if (brErr || !broadcast) {
    return NextResponse.json({ error: 'broadcast not found' }, { status: 404 })
  }

  if (!['draft', 'scheduled'].includes(broadcast.status)) {
    return NextResponse.json({ error: `cannot send broadcast in status: ${broadcast.status}` }, { status: 409 })
  }

  // Fetch the bot's token
  const { data: bot } = await supabase
    .from('bots')
    .select('token')
    .eq('id', broadcast.bot_id)
    .eq('user_id', user.id)
    .single()

  if (!bot?.token) {
    return NextResponse.json({ error: 'bot token not found' }, { status: 404 })
  }

  // Fetch target contacts based on audience filter
  let contactsQuery = supabase
    .from('contacts')
    .select('telegram_id')
    .eq('user_id', user.id)
    .not('telegram_id', 'is', null)

  if (broadcast.audience === 'buyers') {
    contactsQuery = contactsQuery.gt('purchases', 0)
  } else if (broadcast.audience === 'leads') {
    contactsQuery = contactsQuery.eq('purchases', 0)
  }

  const { data: contacts } = await contactsQuery
  if (!contacts || contacts.length === 0) {
    await supabase
      .from('broadcasts')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', broadcast_id)
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Mark as sending
  await supabase
    .from('broadcasts')
    .update({ status: 'sending', started_at: new Date().toISOString(), sent: 0, delivered: 0, failed: 0 })
    .eq('id', broadcast_id)

  let sent = 0, delivered = 0, failed = 0

  for (const contact of contacts) {
    if (!contact.telegram_id) continue

    const ok = await sendTelegramMessage(
      bot.token,
      contact.telegram_id,
      broadcast.message,
      broadcast.buttons ?? [],
    )

    if (ok) delivered++
    else failed++
    sent++

    // Update progress every 50 messages
    if (sent % 50 === 0) {
      await supabase
        .from('broadcasts')
        .update({ sent, delivered, failed })
        .eq('id', broadcast_id)
    }

    await sleep(RATE_LIMIT_MS)
  }

  // Final update
  await supabase
    .from('broadcasts')
    .update({
      status: failed > sent * 0.5 ? 'failed' : 'done',
      sent,
      delivered,
      failed,
      finished_at: new Date().toISOString(),
    })
    .eq('id', broadcast_id)

  return NextResponse.json({ ok: true, sent, delivered, failed })
}
