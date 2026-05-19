import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'

interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string }
  chat: { id: number; type: string }
  text?: string
  date: number
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: { id: number; first_name: string }
    message?: TelegramMessage
    data?: string
  }
}

// POST /api/telegram/webhook?bot_id=<uuid>
export async function POST(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  if (!botId) return NextResponse.json({ error: 'bot_id required' }, { status: 400 })

  const supabase = await createClient()

  // Fetch bot to verify secret and get token
  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, user_id, token, webhook_secret, name')
    .eq('id', botId)
    .single()

  if (botError || !bot) {
    return NextResponse.json({ error: 'bot not found' }, { status: 404 })
  }

  // Verify Telegram secret token
  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!incomingSecret || incomingSecret !== bot.webhook_secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Always return 200 immediately (Telegram retries on non-200)
  const msg = update.message
  if (!msg?.from) return new NextResponse(null, { status: 200 })

  const telegramId = String(msg.from.id)
  const firstName  = msg.from.first_name
  const lastName   = msg.from.last_name ?? ''
  const username   = msg.from.username ?? null
  const chatId     = msg.chat.id

  // Upsert contact
  const { data: contact } = await supabase
    .from('contacts')
    .upsert(
      {
        user_id:     bot.user_id,
        bot_id:      bot.id,
        telegram_id: telegramId,
        first_name:  firstName,
        last_name:   lastName,
        username,
        language:    msg.from.language_code ?? 'pt',
      },
      { onConflict: 'bot_id,telegram_id', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  // Log activity event
  await supabase.from('activity_events').insert({
    user_id:     bot.user_id,
    bot_id:      bot.id,
    contact_id:  contact?.id ?? null,
    type:        'message',
    title:       `Mensagem de ${firstName}`,
    description: msg.text?.slice(0, 200) ?? '',
  })

  // Handle /start command
  if (msg.text?.startsWith('/start')) {
    // Registra evento de início de conversa no funil (fire-and-forget)
    supabase.from('checkout_events').insert({
      user_id:    bot.user_id,
      bot_id:     bot.id,
      contact_id: contact?.id ?? null,
      event_type: 'conversation_started',
      product_name: '',
    }).then(({ error }) => {
      if (error) console.error('[webhook] conversation_started error:', error.message)
    })

    await sendTelegramMessage(
      decryptToken(bot.token),
      chatId,
      `Olá, <b>${firstName}</b>! 👋\n\nSeja bem-vindo ao <b>${bot.name}</b>. Em breve você receberá mais informações.`,
    ).catch(() => {}) // não bloquear o 200 se falhar
  }

  return new NextResponse(null, { status: 200 })
}
