'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { decryptToken } from '@/lib/crypto'
import { graphUrlFor } from '@/lib/instagram/graph'

// ─── Schema ─────────────────────────────────────────────────────────────────

const httpUrl = z.string().trim().max(500).refine(v => {
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}, 'Link inválido (use http:// ou https://).')

const optText = (max: number) => z.string().trim().max(max).nullable().optional()
  .transform(v => (v ? v : null))

const AUTOMATION_SCHEMA = z.object({
  accountId:         z.string().uuid(),
  name:              z.string().trim().min(1, 'Dê um nome à automação.').max(80),
  mediaId:           z.string().trim().max(64).nullable().optional().transform(v => (v ? v : null)),
  mediaLabel:        optText(120),
  keywords:          z.array(z.string().trim().min(1).max(40)).min(1, 'Informe ao menos uma palavra-chave.').max(10),
  matchType:         z.enum(['contains', 'exact']),
  replyCommentText:  optText(300),
  dmText:            z.string().trim().min(1, 'Escreva a mensagem do DM.').max(640),
  dmButtonLabel:     z.string().trim().max(20).nullable().optional().transform(v => (v ? v : null)),
  finalText:         optText(640),
  finalButtons:      z.array(z.object({
    title: z.string().trim().min(1, 'Todo botão precisa de um texto.').max(20, 'Texto do botão: máximo 20 caracteres.'),
    url:   httpUrl,
  })).max(3),
  requireFollow:     z.boolean(),
  followText:        optText(640),
  followButtonLabel: z.string().trim().max(20).nullable().optional().transform(v => (v ? v : null)),
}).superRefine((v, ctx) => {
  if (v.dmButtonLabel) {
    if (!v.finalText) ctx.addIssue({ code: 'custom', message: 'Escreva a mensagem final (enviada depois do clique no botão).' })
    if (v.finalButtons.length === 0) ctx.addIssue({ code: 'custom', message: 'Adicione ao menos um botão de link na mensagem final.' })
  }
  if (v.requireFollow && !v.dmButtonLabel) {
    ctx.addIssue({ code: 'custom', message: '"Exigir que siga" precisa de um botão no primeiro DM (a checagem só é possível depois do clique).' })
  }
})

export type AutomationInput = z.input<typeof AUTOMATION_SCHEMA>

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? 'Dados inválidos.' }
  return { ok: false, error: e instanceof Error ? e.message : 'Erro inesperado.' }
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')
  const rl = await rateLimit(`ig-auto:${user.id}`, 60, 60_000)
  if (!rl.ok) throw new Error('Muitas operações. Aguarde um pouco.')
  return { supabase, user }
}

function toRow(p: z.output<typeof AUTOMATION_SCHEMA>) {
  return {
    account_id:          p.accountId,
    name:                p.name,
    media_id:            p.mediaId,
    media_label:         p.mediaId ? p.mediaLabel : null,
    keywords:            p.keywords,
    match_type:          p.matchType,
    reply_comment_text:  p.replyCommentText,
    dm_text:             p.dmText,
    dm_button_label:     p.dmButtonLabel,
    final_text:          p.finalText,
    final_buttons:       p.finalButtons,
    require_follow:      p.requireFollow,
    follow_text:         p.requireFollow ? p.followText : null,
    follow_button_label: p.requireFollow ? p.followButtonLabel : null,
    updated_at:          new Date().toISOString(),
  }
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createAutomationAction(input: AutomationInput): Promise<Result<{ id: string }>> {
  try {
    const { supabase, user } = await requireUser()
    const p = AUTOMATION_SCHEMA.parse(input)

    const { data: account } = await supabase
      .from('instagram_accounts').select('id').eq('id', p.accountId).eq('user_id', user.id).maybeSingle()
    if (!account) return { ok: false, error: 'Conta Instagram não encontrada.' }

    const { count } = await supabase
      .from('instagram_automations').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= 50) return { ok: false, error: 'Limite de 50 automações atingido.' }

    const { data, error } = await supabase
      .from('instagram_automations').insert({ user_id: user.id, ...toRow(p) }).select('id').single()
    if (error || !data) return { ok: false, error: `Não foi possível salvar (${error?.code ?? 'erro'}).` }

    revalidatePath('/dashboard/instagram/automations')
    return { ok: true, id: data.id as string }
  } catch (e) { return fail(e) }
}

export async function updateAutomationAction(id: string, input: AutomationInput): Promise<Result> {
  try {
    const { supabase, user } = await requireUser()
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'ID inválido.' }
    const p = AUTOMATION_SCHEMA.parse(input)

    const { data: account } = await supabase
      .from('instagram_accounts').select('id').eq('id', p.accountId).eq('user_id', user.id).maybeSingle()
    if (!account) return { ok: false, error: 'Conta Instagram não encontrada.' }

    const { error } = await supabase
      .from('instagram_automations').update(toRow(p)).eq('id', id).eq('user_id', user.id)
    if (error) return { ok: false, error: `Não foi possível salvar (${error.code ?? 'erro'}).` }

    revalidatePath('/dashboard/instagram/automations')
    return { ok: true }
  } catch (e) { return fail(e) }
}

export async function toggleAutomationAction(id: string, active: boolean): Promise<Result> {
  try {
    const { supabase, user } = await requireUser()
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'ID inválido.' }
    const { error } = await supabase
      .from('instagram_automations')
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)
    if (error) return { ok: false, error: `Não foi possível atualizar (${error.code ?? 'erro'}).` }
    revalidatePath('/dashboard/instagram/automations')
    return { ok: true }
  } catch (e) { return fail(e) }
}

export async function deleteAutomationAction(id: string): Promise<Result> {
  try {
    const { supabase, user } = await requireUser()
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'ID inválido.' }
    const { error } = await supabase.from('instagram_automations').delete().eq('id', id).eq('user_id', user.id)
    if (error) return { ok: false, error: `Não foi possível apagar (${error.code ?? 'erro'}).` }
    revalidatePath('/dashboard/instagram/automations')
    return { ok: true }
  } catch (e) { return fail(e) }
}

// ─── Posts recentes da conta (para escolher o Reels) ────────────────────────

export interface AccountMedia {
  id:        string
  caption:   string
  thumb:     string | null
  permalink: string | null
  type:      string
  timestamp: string | null
}

export async function listAccountMediaAction(accountId: string): Promise<Result<{ media: AccountMedia[] }>> {
  try {
    const { supabase, user } = await requireUser()
    if (!z.string().uuid().safeParse(accountId).success) return { ok: false, error: 'ID inválido.' }

    const { data: account } = await supabase
      .from('instagram_accounts').select('ig_user_id, access_token')
      .eq('id', accountId).eq('user_id', user.id).maybeSingle()
    if (!account) return { ok: false, error: 'Conta Instagram não encontrada.' }

    const token = decryptToken(account.access_token as string)
    const url = new URL(`${graphUrlFor(token)}/${account.ig_user_id}/media`)
    url.searchParams.set('fields', 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp')
    url.searchParams.set('limit', '30')

    const res  = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const data = await res.json() as {
      data?: Array<{
        id: string; caption?: string; media_type?: string; media_product_type?: string
        permalink?: string; thumbnail_url?: string; media_url?: string; timestamp?: string
      }>
      error?: { message: string; code: number }
    }
    if (data.error) {
      return { ok: false, error: `A Meta não liberou a lista de posts (código ${data.error.code}). Você ainda pode usar "Qualquer publicação".` }
    }

    return {
      ok: true,
      media: (data.data ?? []).map(m => ({
        id:        m.id,
        caption:   (m.caption ?? '').slice(0, 120),
        thumb:     m.thumbnail_url ?? (m.media_type === 'IMAGE' ? m.media_url ?? null : null),
        permalink: m.permalink ?? null,
        type:      m.media_product_type === 'REELS' ? 'Reels' : (m.media_type ?? 'Post'),
        timestamp: m.timestamp ?? null,
      })),
    }
  } catch (e) { return fail(e) }
}
