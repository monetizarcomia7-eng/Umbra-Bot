import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import * as Sentry from '@sentry/nextjs'

// GET /api/cron/process-broadcasts
// Processa broadcasts com status='scheduled' cujo scheduled_for já chegou.
// Protegido por CRON_SECRET — chamar via cron-job.org (1x a cada 15 min).
//
// Limitações:
//   - Processa 1 broadcast por rodada para evitar timeout serverless (300s)
//   - Máximo ~8.500 contatos por disparo dentro do limite de tempo
//   - Para audiências maiores, recomenda-se dividir em sub-campanhas

const RATE_LIMIT_MS = 35  // ~28 msgs/s — abaixo do limite Telegram

interface BroadcastButton { label: string; url: string }
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

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Busca o próximo broadcast agendado (1 por vez)
  const { data: due } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!due) {
    return NextResponse.json({ ok: true, processed: 0, message: 'Nenhum broadcast agendado' })
  }

  // Marca como 'sending' imediatamente (CAS — evita duplo-processamento)
  const { error: lockErr } = await supabase
    .from('broadcasts')
    .update({ status: 'sending', started_at: now })
    .eq('id', due.id)
    .eq('status', 'scheduled')

  if (lockErr) {
    return NextResponse.json({ ok: true, processed: 0, message: 'Broadcast já processado por outra instância' })
  }

  // Busca token do bot
  const { data: bot } = await supabase
    .from('bots')
    .select('token, name, username')
    .eq('id', due.bot_id)
    .single()

  if (!bot?.token) {
    await supabase
      .from('broadcasts')
      .update({ status: 'failed', failure_reason: 'Bot não encontrado ou sem token', finished_at: now })
      .eq('id', due.id)
    return NextResponse.json({ ok: false, error: 'bot token not found' })
  }

  const decrypted = decryptToken(bot.token)
  const botName   = bot.username ? `@${bot.username}` : (bot.name ?? 'Bot')

  // Segmentação de contatos
  let contactsQuery = supabase
    .from('contacts')
    .select('telegram_id, first_name')
    .eq('user_id', due.user_id)
    .not('telegram_id', 'is', null)

  const aud = (due.audience ?? 'all') as string

  if (aud === 'buyers') {
    contactsQuery = contactsQuery.gt('orders_count', 0)
  } else if (aud === 'leads') {
    contactsQuery = contactsQuery.eq('orders_count', 0)
  } else if (aud.startsWith('tag:')) {
    const tag = aud.slice(4)
    contactsQuery = contactsQuery.filter('tags', 'cs', `{${tag}}`)
  }

  if (due.bot_id) {
    contactsQuery = contactsQuery.eq('bot_id', due.bot_id)
  }

  const filters = (due.filters ?? {}) as Record<string, string>
  if (filters.registered_after)  contactsQuery = contactsQuery.gte('created_at', filters.registered_after)
  if (filters.registered_before) contactsQuery = contactsQuery.lte('created_at', filters.registered_before)

  const { data: contacts } = await contactsQuery

  if (!contacts || contacts.length === 0) {
    await supabase
      .from('broadcasts')
      .update({ status: 'done', finished_at: new Date().toISOString(), sent: 0, delivered: 0, failed: 0 })
      .eq('id', due.id)
    return NextResponse.json({ ok: true, processed: 1, sent: 0 })
  }

  let sent = 0, delivered = 0, failed = 0
  const buttons: BroadcastButton[] = (due.buttons ?? []) as BroadcastButton[]
  const media = due.media as MediaAttachment | null

  for (const contact of contacts) {
    if (!contact.telegram_id) continue

    const text = substituteVars(due.message ?? '', contact.first_name ?? '', botName)
    const ok   = await sendTgMsg(decrypted, contact.telegram_id, text, buttons, media)

    if (ok) delivered++
    else    failed++
    sent++

    if (sent % 50 === 0) {
      const { data: cur } = await supabase
        .from('broadcasts')
        .select('status')
        .eq('id', due.id)
        .single()

      if (cur?.status === 'canceled') break

      await supabase
        .from('broadcasts')
        .update({ sent, delivered, failed })
        .eq('id', due.id)
    }

    await sleep(RATE_LIMIT_MS)
  }

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
    .eq('id', due.id)

  // Registra no cron_log (fire-and-forget)
  await supabase
    .from('cron_log')
    .insert({
      job_name:      'process-broadcasts',
      started_at:    now,
      finished_at:   new Date().toISOString(),
      rows_affected: sent,
      notes:         `broadcast_id=${due.id} status=${finalStatus} sent=${sent} delivered=${delivered} failed=${failed}`,
    })
    .then(() => {})

  Sentry.captureCheckIn?.({ checkInId: due.id, monitorSlug: 'process-broadcasts', status: 'ok' })

  return NextResponse.json({ ok: true, processed: 1, sent, delivered, failed, status: finalStatus })
}
