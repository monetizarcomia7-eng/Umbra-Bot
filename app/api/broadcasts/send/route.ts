import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { captureEvent } from '@/lib/analytics-server'
import { decryptToken } from '@/lib/crypto'
import * as Sentry from '@sentry/nextjs'

const RATE_LIMIT_MS = 35 // ~28 mensagens/segundo — abaixo do limite do Telegram (30/s)

interface BroadcastButton  { label: string; url: string }
interface MediaAttachment  { kind: 'image' | 'video' | 'file'; url?: string; label?: string }

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function substituteVars(text: string, firstName: string, botName: string): string {
  const nome = (firstName ?? '').trim() || 'você'
  return text
    .replace(/\{nome\}/g,    nome)
    .replace(/\{bot\}/g,     botName)
    .replace(/\{data\}/g,    new Date().toLocaleDateString('pt-BR'))
    .replace(/\{produto\}/g, '')
    .replace(/\{valor\}/g,   '')
}

async function sendTgMsg(
  token: string,
  chatId: string,
  text: string,
  buttons: BroadcastButton[],
  media?: MediaAttachment | null,
): Promise<boolean> {
  const keyboard = buttons.length > 0
    ? { inline_keyboard: [buttons.map((b) => ({ text: b.label, url: b.url }))] }
    : undefined

  try {
    // Com mídia (URL real fornecida)
    if (media?.url) {
      const methodMap = { image: 'sendPhoto', video: 'sendVideo', file: 'sendDocument' } as const
      const fieldMap  = { image: 'photo',     video: 'video',     file: 'document'     } as const
      const method    = methodMap[media.kind] ?? 'sendDocument'
      const field     = fieldMap[media.kind]  ?? 'document'

      const body: Record<string, unknown> = {
        chat_id:    chatId,
        [field]:    media.url,
        caption:    text,
        parse_mode: 'HTML',
      }
      if (keyboard) body.reply_markup = keyboard

      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.ok
    }

    // Somente texto
    const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }
    if (keyboard) body.reply_markup = keyboard

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

// POST /api/broadcasts/send
// Body: { broadcast_id: string }
// Timeout máximo Vercel: 300s — suporta até ~8.500 contatos por execução.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 5 disparos por usuário por hora
  const rl = await rateLimit(`broadcast:${user.id}`, 5, 60 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'limite de disparos atingido, tente novamente mais tarde' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  let body: { broadcast_id?: string }
  try { body = await request.json() } catch { body = {} }

  const { broadcast_id } = body
  if (!broadcast_id) return NextResponse.json({ error: 'broadcast_id required' }, { status: 400 })

  // Fetch broadcast — valida propriedade (IDOR-safe)
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
    return NextResponse.json(
      { error: `cannot send broadcast in status: ${broadcast.status}` },
      { status: 409 },
    )
  }

  // Busca token do bot
  const { data: bot } = await supabase
    .from('bots')
    .select('token, name, username')
    .eq('id', broadcast.bot_id)
    .eq('user_id', user.id)
    .single()

  if (!bot?.token) {
    return NextResponse.json({ error: 'bot token not found' }, { status: 404 })
  }

  const decrypted = decryptToken(bot.token)
  const botName   = bot.username ? `@${bot.username}` : (bot.name ?? 'Bot')

  // ── Segmentação de contatos ──────────────────────────────────────
  let contactsQuery = supabase
    .from('contacts')
    .select('telegram_id, first_name')
    .eq('user_id', user.id)
    .not('telegram_id', 'is', null)

  const aud = (broadcast.audience ?? 'all') as string

  if (aud === 'buyers') {
    contactsQuery = contactsQuery.gt('orders_count', 0)
  } else if (aud === 'leads') {
    // Novos contatos têm orders_count = NULL — coalesce(NULL, 0) = 0 → leads
    contactsQuery = contactsQuery.or('orders_count.eq.0,orders_count.is.null')
  } else if (aud.startsWith('tag:')) {
    const tag = aud.slice(4)
    contactsQuery = contactsQuery.filter('tags', 'cs', `{${tag}}`)
  }
  // aud === 'all' → sem filtro extra

  // Filtra por bot se broadcast tem bot_id
  if (broadcast.bot_id) {
    contactsQuery = contactsQuery.eq('bot_id', broadcast.bot_id)
  }

  // Filtros avançados (filters JSONB: registered_after, registered_before)
  const filters = (broadcast.filters ?? {}) as Record<string, string>
  if (filters.registered_after)  contactsQuery = contactsQuery.gte('created_at', filters.registered_after)
  if (filters.registered_before) contactsQuery = contactsQuery.lte('created_at', filters.registered_before)

  const { data: contacts } = await contactsQuery

  if (!contacts || contacts.length === 0) {
    await supabase
      .from('broadcasts')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', broadcast_id)
    return NextResponse.json({ ok: true, sent: 0, delivered: 0, failed: 0 })
  }

  // Marca como enviando
  await supabase
    .from('broadcasts')
    .update({
      status:     'sending',
      started_at: new Date().toISOString(),
      sent: 0, delivered: 0, failed: 0,
    })
    .eq('id', broadcast_id)

  let sent = 0, delivered = 0, failed = 0
  const buttons: BroadcastButton[] = (broadcast.buttons ?? []) as BroadcastButton[]
  const media = broadcast.media as MediaAttachment | null

  for (const contact of contacts) {
    if (!contact.telegram_id) continue

    const text = substituteVars(broadcast.message ?? '', contact.first_name ?? '', botName)
    const ok   = await sendTgMsg(decrypted, contact.telegram_id, text, buttons, media)

    if (ok) delivered++
    else    failed++
    sent++

    // A cada 50 mensagens: atualiza progresso e verifica cancelamento
    if (sent % 50 === 0) {
      const { data: cur } = await supabase
        .from('broadcasts')
        .select('status')
        .eq('id', broadcast_id)
        .single()

      if (cur?.status === 'canceled') break

      await supabase
        .from('broadcasts')
        .update({ sent, delivered, failed })
        .eq('id', broadcast_id)
    }

    await sleep(RATE_LIMIT_MS)
  }

  // Atualização final
  const finalStatus = failed > sent * 0.5 ? 'failed' : 'done'
  await supabase
    .from('broadcasts')
    .update({
      status:      finalStatus,
      sent,
      delivered,
      failed,
      finished_at: new Date().toISOString(),
    })
    .eq('id', broadcast_id)

  await captureEvent(user.id, 'broadcast_sent', {
    contacts_count: contacts.length,
    delivered,
    failed,
    audience: broadcast.audience,
  }).catch((e) => Sentry.captureException(e))

  return NextResponse.json({ ok: true, sent, delivered, failed })
}
