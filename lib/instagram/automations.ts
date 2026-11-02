/**
 * Automação de comentários → DM (estilo ManyChat) para o Instagram.
 *
 * Chamado pelo webhook /api/webhooks/instagram (campos `comments` e `messaging_postbacks`).
 *   comentário com palavra-chave → [resposta pública] + DM 1 (resposta privada, com botão)
 *   clique no botão              → [checa se segue] → DM final com botões de link
 *
 * Regras da Meta: 1 resposta privada por comentário, em até 7 dias. A DM seguinte só pode
 * ser enviada depois que a pessoa responde (clique no botão) e em até 24h dessa resposta.
 */

import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import { graphUrlFor, META_GRAPH_URL, isInstagramLoginToken } from './graph'
import { MetaAPIError } from './publish'

type Admin = ReturnType<typeof createAdminClient>

export interface LinkButton { title: string; url: string }

export interface AutomationRow {
  id:                  string
  user_id:             string
  account_id:          string
  media_id:            string | null
  keywords:            string[]
  match_type:          'contains' | 'exact'
  reply_comment_text:  string | null
  dm_text:             string
  dm_button_label:     string | null
  final_text:          string | null
  final_buttons:       LinkButton[]
  require_follow:      boolean
  follow_text:         string | null
  follow_button_label: string | null
}

interface AccountRow {
  id:           string
  ig_user_id:   string
  access_token: string
  page_id:      string | null
  page_token:   string | null
}

type Button =
  | { type: 'web_url';  title: string; url: string }
  | { type: 'postback'; title: string; payload: string }

const AUTOMATION_COLUMNS =
  'id, user_id, account_id, media_id, keywords, match_type, reply_comment_text, dm_text, dm_button_label, ' +
  'final_text, final_buttons, require_follow, follow_text, follow_button_label'

const DEFAULT_FOLLOW_TEXT   = 'Esse link é exclusivo para seguidores! 🔒 Me segue aqui e toca no botão abaixo que eu te libero na hora 👇'
const DEFAULT_FOLLOW_BUTTON = 'Seguindo'

// ─── Palavras-chave ──────────────────────────────────────────────────────

export function normalize(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesKeyword(text: string, keywords: string[], matchType: 'contains' | 'exact'): boolean {
  const t = normalize(text)
  if (!t) return false
  return keywords.some(k => {
    const n = normalize(k)
    if (!n) return false
    return matchType === 'exact' ? t === n : ` ${t} `.includes(` ${n} `)
  })
}

function subVars(text: string, username: string | null): string {
  return text.replace(/\{usuario\}/gi, username ? `@${username}` : '')
}

// ─── Chamadas à Graph API ────────────────────────────────────────────────

interface Target { base: string; id: string; token: string }

// Token do Instagram Login → /{ig_user_id}/messages em graph.instagram.com.
// Token do Facebook Login → /{page_id}/messages em graph.facebook.com (token da Página).
function messagingTarget(acc: AccountRow): Target {
  const token = decryptToken(acc.access_token)
  if (isInstagramLoginToken(token)) {
    return { base: graphUrlFor(token), id: acc.ig_user_id, token }
  }
  if (acc.page_id && acc.page_token) {
    return { base: META_GRAPH_URL, id: acc.page_id, token: decryptToken(acc.page_token) }
  }
  throw new Error('Conta sem credencial para enviar mensagens. Reconecte a conta.')
}

async function graphCall(method: 'GET' | 'POST', url: string, token: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body:  body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown> & {
    error?: { message: string; code: number; error_subcode?: number }
  }
  if (data.error) throw new MetaAPIError(data.error)
  return data
}

function buttonMessage(text: string, buttons: Button[]) {
  if (buttons.length === 0) return { text }
  return {
    attachment: {
      type: 'template',
      payload: { template_type: 'button', text, buttons },
    },
  }
}

function linkButtons(list: LinkButton[]): Button[] {
  return list.slice(0, 3).map(b => ({ type: 'web_url' as const, title: b.title, url: b.url }))
}

function plainTextFallback(text: string, list: LinkButton[]): string {
  return list.length ? `${text}\n\n${list.map(b => `${b.title}: ${b.url}`).join('\n')}` : text
}

async function sendMessage(
  target: Target,
  recipient: { comment_id: string } | { id: string },
  text: string,
  buttons: Button[],
): Promise<string | null> {
  const data = await graphCall('POST', `${target.base}/${target.id}/messages`, target.token, {
    recipient,
    message: buttonMessage(text, buttons),
  })
  return typeof data.recipient_id === 'string' ? data.recipient_id : null
}

async function replyToComment(target: Target, commentId: string, message: string): Promise<void> {
  await graphCall('POST', `${target.base}/${commentId}/replies`, target.token, { message })
}

async function isUserFollowBusiness(target: Target, igsid: string): Promise<boolean> {
  const data = await graphCall('GET', `${target.base}/${igsid}?fields=is_user_follow_business`, target.token)
  if (typeof data.is_user_follow_business !== 'boolean') {
    throw new Error('A Meta não informou se a pessoa segue a conta.')
  }
  return data.is_user_follow_business
}

// ─── Log com deduplicação ────────────────────────────────────────────────

// Reserva a execução. Retorna o id do log, ou null se já foi processada (webhook reenviado).
async function reserveEvent(
  admin: Admin,
  row: {
    user_id: string; automation_id: string; kind: 'comment' | 'click'; dedupe_key: string
    comment_id?: string | null; ig_sender_id?: string | null; username?: string | null
  },
): Promise<string | null> {
  const { data, error } = await admin.from('instagram_automation_events').insert(row).select('id').single()
  if (error) {
    if (error.code !== '23505') {
      Sentry.captureException(new Error(error.message), { extra: { context: 'ig_automation_reserve' } })
    }
    return null
  }
  return data.id as string
}

async function finishEvent(
  admin: Admin, id: string, status: 'sent' | 'delivered' | 'gated' | 'skipped' | 'failed',
  extra: { error_msg?: string; ig_sender_id?: string | null } = {},
) {
  await admin.from('instagram_automation_events').update({ status, ...extra }).eq('id', id)
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : 'Erro desconhecido').slice(0, 300)
}

// ─── Comentário ──────────────────────────────────────────────────────────

export interface CommentEvent {
  id:         string
  text?:      string
  parent_id?: string
  from?:      { id?: string; username?: string }
  media?:     { id?: string }
}

export async function processComment(admin: Admin, igAccountId: string, c: CommentEvent): Promise<void> {
  if (!c.id || !c.text) return
  // Ignora respostas a comentários e comentários da própria conta (nossa resposta pública dispara este webhook)
  if (c.parent_id) return
  if (c.from?.id && c.from.id === igAccountId) return

  const { data: accounts } = await admin
    .from('instagram_accounts')
    .select('id, ig_user_id, access_token, page_id, page_token')
    .eq('ig_user_id', igAccountId)
    .eq('is_active', true)
  if (!accounts || accounts.length === 0) return

  for (const account of accounts as AccountRow[]) {
    const { data: rows } = await admin
      .from('instagram_automations')
      .select(AUTOMATION_COLUMNS)
      .eq('account_id', account.id)
      .eq('is_active', true)
    const candidates = ((rows ?? []) as unknown as AutomationRow[])
      .filter(a => !a.media_id || a.media_id === c.media?.id)
      .filter(a => matchesKeyword(c.text as string, a.keywords, a.match_type))
      // automação de um post específico tem prioridade sobre a "qualquer publicação"
      .sort((a, b) => Number(!!b.media_id) - Number(!!a.media_id))

    const auto = candidates[0]
    if (!auto) continue

    const eventId = await reserveEvent(admin, {
      user_id: auto.user_id, automation_id: auto.id, kind: 'comment', dedupe_key: `c:${c.id}`,
      comment_id: c.id, ig_sender_id: c.from?.id ?? null, username: c.from?.username ?? null,
    })
    if (!eventId) return   // já tratado (e só existe 1 resposta privada por comentário)

    const username = c.from?.username ?? null
    try {
      const target = messagingTarget(account)
      const text   = subVars(auto.dm_text, username)

      const firstButtons: Button[] = auto.dm_button_label
        ? [{ type: 'postback', title: auto.dm_button_label, payload: `umbra:${auto.id}:go` }]
        : linkButtons(auto.final_buttons)

      let recipientId: string | null
      try {
        recipientId = await sendMessage(target, { comment_id: c.id }, text, firstButtons)
      } catch (e) {
        // A Meta documenta só texto na resposta privada. Se recusar o botão e a DM só tem
        // botões de link, reenvia como texto com os links (o fluxo com clique não tem alternativa).
        const canFallback = !auto.dm_button_label && auto.final_buttons.length > 0
          && !(e instanceof MetaAPIError && e.code === 190)
        if (!canFallback) throw e
        recipientId = await sendMessage(target, { comment_id: c.id }, plainTextFallback(text, auto.final_buttons), [])
      }

      await finishEvent(admin, eventId, 'sent', { ig_sender_id: recipientId ?? c.from?.id ?? null })

      if (auto.reply_comment_text) {
        try {
          await replyToComment(target, c.id, subVars(auto.reply_comment_text, username))
        } catch (e) {
          // A DM já foi enviada; falha na resposta pública não desfaz isso.
          Sentry.captureException(e, { extra: { context: 'ig_automation_public_reply', automationId: auto.id } })
        }
      }
    } catch (e) {
      await finishEvent(admin, eventId, 'failed', { error_msg: errMsg(e) })
      Sentry.captureException(e, { extra: { context: 'ig_automation_comment', automationId: auto.id } })
    }
    return
  }
}

// ─── Clique no botão (postback) ──────────────────────────────────────────

export interface PostbackEvent {
  sender?:   { id?: string }
  postback?: { mid?: string; payload?: string }
}

export async function processPostback(admin: Admin, igAccountId: string, m: PostbackEvent): Promise<void> {
  const payload  = m.postback?.payload ?? ''
  const senderId = m.sender?.id
  const mid      = m.postback?.mid
  const match    = /^umbra:([0-9a-f-]{36}):(go|follow)$/.exec(payload)
  if (!match || !senderId || !mid) return

  const { data } = await admin
    .from('instagram_automations').select(AUTOMATION_COLUMNS)
    .eq('id', match[1]).eq('is_active', true).maybeSingle()
  const auto = data as unknown as AutomationRow | null
  if (!auto) return

  const { data: acc } = await admin
    .from('instagram_accounts')
    .select('id, ig_user_id, access_token, page_id, page_token')
    .eq('id', auto.account_id).eq('is_active', true).maybeSingle()
  const account = acc as AccountRow | null
  if (!account || account.ig_user_id !== igAccountId) return

  const eventId = await reserveEvent(admin, {
    user_id: auto.user_id, automation_id: auto.id, kind: 'click', dedupe_key: `p:${mid}`, ig_sender_id: senderId,
  })
  if (!eventId) return

  try {
    const target = messagingTarget(account)

    if (auto.require_follow && !(await isUserFollowBusiness(target, senderId))) {
      await sendMessage(
        target, { id: senderId },
        auto.follow_text || DEFAULT_FOLLOW_TEXT,
        [{ type: 'postback', title: auto.follow_button_label || DEFAULT_FOLLOW_BUTTON, payload: `umbra:${auto.id}:follow` }],
      )
      await finishEvent(admin, eventId, 'gated')
      return
    }

    await sendMessage(target, { id: senderId }, auto.final_text || auto.dm_text, linkButtons(auto.final_buttons))
    await finishEvent(admin, eventId, 'delivered')
  } catch (e) {
    await finishEvent(admin, eventId, 'failed', { error_msg: errMsg(e) })
    Sentry.captureException(e, { extra: { context: 'ig_automation_postback', automationId: auto.id } })
  }
}

// ─── Entrada do webhook ──────────────────────────────────────────────────

export interface WebhookEntryLike {
  id:         string | number
  changes?:   Array<{ field?: string; value?: unknown }>
  messaging?: PostbackEvent[]
}

export async function handleAutomationEvents(entries: WebhookEntryLike[]): Promise<void> {
  const admin = createAdminClient()
  for (const entry of entries) {
    const igAccountId = String(entry.id ?? '')
    if (!igAccountId) continue

    for (const change of entry.changes ?? []) {
      if (change.field === 'comments' && change.value) {
        await processComment(admin, igAccountId, change.value as CommentEvent)
      }
    }
    for (const m of entry.messaging ?? []) {
      if (m.postback) await processPostback(admin, igAccountId, m)
    }
  }
}
