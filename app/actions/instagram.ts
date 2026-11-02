'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'
import { encryptToken, decryptToken } from '@/lib/crypto'
import { subscribeAccountWebhooks } from '@/lib/instagram/subscribe'
import { META_IG_GRAPH_URL, isInstagramLoginToken } from '@/lib/instagram/graph'
import { getFacebookPages, getInstagramBusinessAccount, MetaAuthError } from '@/lib/instagram/auth'

// ─── Schemas ────────────────────────────────────────────────────────────────

const SCHEDULE_SCHEMA = z.object({
  accountId:   z.string().uuid(),
  mediaType:   z.enum(['IMAGE', 'REELS', 'CAROUSEL']),
  mediaUrls:   z.array(z.string().url()).min(1).max(10),
  caption:     z.string().max(2200).default(''),
  scheduledAt: z.string().datetime(),
}).superRefine((v, ctx) => {
  if (v.mediaType === 'CAROUSEL' && v.mediaUrls.length < 2) {
    ctx.addIssue({ code: 'custom', message: 'Carrossel precisa de no mínimo 2 mídias.' })
  }
  if (v.mediaType !== 'CAROUSEL' && v.mediaUrls.length > 1) {
    ctx.addIssue({ code: 'custom', message: 'IMAGE/REELS aceita apenas 1 mídia.' })
  }
  // No mínimo 2 minutos no futuro
  const ts = new Date(v.scheduledAt).getTime()
  if (ts < Date.now() + 2 * 60_000) {
    ctx.addIssue({ code: 'custom', message: 'Agende para no mínimo 2 minutos no futuro.' })
  }
})

// ─── schedulePostAction ─────────────────────────────────────────────────────
export async function schedulePostAction(
  payload: z.input<typeof SCHEDULE_SCHEMA>,
): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`ig-schedule:${user.id}`, 30, 60_000)
  if (!rl.ok) throw new Error('Muitos agendamentos. Aguarde 1 minuto.')

  const p = SCHEDULE_SCHEMA.parse(payload)

  // Anti-spam: 500 posts por usuário
  const { count } = await supabase
    .from('instagram_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= 500) throw new Error('Limite de 500 posts atingido.')

  // Verifica que account pertence ao user (IDOR)
  const { data: account } = await supabase
    .from('instagram_accounts')
    .select('id, is_active')
    .eq('id', p.accountId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!account) throw new Error('Conta Instagram não encontrada.')
  if (!account.is_active) throw new Error('Esta conta está desativada. Reconecte antes de agendar.')

  const { data, error } = await supabase
    .from('instagram_posts')
    .insert({
      user_id:      user.id,
      account_id:   p.accountId,
      media_type:   p.mediaType,
      media_urls:   p.mediaUrls,
      caption:      p.caption,
      scheduled_at: p.scheduledAt,
      status:       'scheduled',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Erro ao agendar post.')

  revalidatePath('/dashboard/instagram')
  return { id: data.id }
}

// ─── cancelPostAction ───────────────────────────────────────────────────────
export async function cancelPostAction(postId: string): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(postId).success) throw new Error('ID inválido.')

  const { error } = await supabase
    .from('instagram_posts')
    .update({ status: 'cancelled' })
    .eq('id', postId)
    .eq('user_id', user.id)
    .eq('status', 'scheduled')

  if (error) throw new Error(error.message)
  return { ok: true }
}

// ─── deletePostAction ───────────────────────────────────────────────────────
export async function deletePostAction(postId: string): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(postId).success) throw new Error('ID inválido.')

  // Não permite apagar post 'publishing' (poderia causar inconsistência com Meta)
  const { error } = await supabase
    .from('instagram_posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', user.id)
    .neq('status', 'publishing')

  if (error) throw new Error(error.message)
  return { ok: true }
}

// ─── disconnectAccountAction ────────────────────────────────────────────────
export async function disconnectAccountAction(accountId: string): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(accountId).success) throw new Error('ID inválido.')

  const rl = await rateLimit(`ig-disconnect:${user.id}`, 10, 60_000)
  if (!rl.ok) throw new Error('Muitas operações. Aguarde.')

  // Cancela todos os posts agendados desta conta
  await supabase
    .from('instagram_posts')
    .update({ status: 'cancelled', error_msg: 'Conta desconectada' })
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .eq('status', 'scheduled')

  // Apaga a conta (cascata leva posts já consolidados)
  const { error } = await supabase
    .from('instagram_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  return { ok: true }
}

// ─── getPostLogsAction ──────────────────────────────────────────────────────
export async function getPostLogsAction(postId: string): Promise<Array<{
  id: string
  attempt_at: string
  success: boolean
  error_code: string | null
  duration_ms: number | null
}>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(postId).success) return []

  // Verifica ownership do post
  const { data: post } = await supabase
    .from('instagram_posts')
    .select('id')
    .eq('id', postId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!post) return []

  const { data } = await supabase
    .from('instagram_publish_logs')
    .select('id, attempt_at, success, error_code, duration_ms')
    .eq('post_id', postId)
    .order('attempt_at', { ascending: false })
    .limit(20)

  return (data ?? []) as Array<{
    id: string; attempt_at: string; success: boolean;
    error_code: string | null; duration_ms: number | null
  }>
}

// ─── connectInstagramTokenAction ────────────────────────────────────────────
// Conecta uma conta usando um token já gerado (ex.: conta testadora do app Meta, sem Página do Facebook).
// O token só trafega do formulário para o servidor; é validado na Meta e salvo criptografado.
export async function connectInstagramTokenAction(
  rawToken: string,
): Promise<{ ok: true; username: string | null } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }

  const rl = await rateLimit(`ig-connect-token:${user.id}`, 10, 60 * 60_000)
  if (!rl.ok) return { ok: false, error: 'Muitas tentativas. Aguarde um pouco.' }

  const token = rawToken.trim()
  if (token.length < 20 || token.length > 1000 || /\s/.test(token)) {
    return { ok: false, error: 'Token inválido. Cole o token completo, sem espaços.' }
  }

  let igUserId: string | null = null
  let username: string | null = null
  let picture:  string | null = null
  let pageId:   string | null = null
  let pageToken: string | null = null

  try {
    if (isInstagramLoginToken(token)) {
      const url = new URL(`${META_IG_GRAPH_URL}/me`)
      url.searchParams.set('fields', 'user_id,username,profile_picture_url')
      url.searchParams.set('access_token', token)
      const res  = await fetch(url.toString(), { cache: 'no-store' })
      const data = await res.json() as {
        user_id?: string | number; id?: string; username?: string; profile_picture_url?: string
        error?: { message: string; code: number }
      }
      if (data.error) return { ok: false, error: `A Meta recusou o token (código ${data.error.code}). Gere um novo token.` }
      igUserId = String(data.user_id ?? data.id ?? '') || null
      username = data.username ?? null
      picture  = data.profile_picture_url ?? null
    } else {
      // Token do Facebook Login: precisa de uma Página com Instagram vinculado
      const pages = await getFacebookPages(token)
      for (const page of pages) {
        try {
          const ig = await getInstagramBusinessAccount(page.id, page.access_token)
          igUserId = ig.id; username = ig.username ?? null; picture = ig.profile_picture_url ?? null
          pageId = page.id; pageToken = page.access_token
          break
        } catch { /* página sem IG — tenta a próxima */ }
      }
      if (!igUserId) {
        return {
          ok: false,
          error: 'Este token não tem Página do Facebook com Instagram vinculado. Use o token gerado em "Instagram → Gerar token" no painel do app Meta (começa com IG).',
        }
      }
    }
  } catch (e) {
    const code = e instanceof MetaAuthError ? ` (código ${e.code})` : ''
    return { ok: false, error: `Não foi possível validar o token na Meta${code}.` }
  }

  if (!igUserId) return { ok: false, error: 'A Meta não retornou a conta deste token.' }

  const { error } = await supabase.from('instagram_accounts').upsert(
    {
      user_id:          user.id,
      ig_user_id:       igUserId,
      username,
      profile_picture:  picture,
      access_token:     encryptToken(token),
      token_expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      page_id:          pageId,
      page_token:       pageToken ? encryptToken(pageToken) : null,
      is_active:        true,
    },
    { onConflict: 'user_id,ig_user_id' },
  )
  if (error) return { ok: false, error: `Não foi possível salvar a conta (${error.code || 'erro'}).` }

  // Melhor esforço: assina a conta nos webhooks (comentários e DMs). Pode ser refeito pelo botão "Ativar webhooks".
  await subscribeAccountWebhooks(igUserId, token, pageId, pageToken)

  revalidatePath('/dashboard/instagram')
  return { ok: true, username }
}

// ─── enableAccountWebhooksAction ────────────────────────────────────────────
export async function enableAccountWebhooksAction(
  accountId: string,
): Promise<{ ok: true; fields: string[] } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }
  if (!z.string().uuid().safeParse(accountId).success) return { ok: false, error: 'ID inválido.' }

  const rl = await rateLimit(`ig-subscribe:${user.id}`, 10, 60_000)
  if (!rl.ok) return { ok: false, error: 'Muitas tentativas. Aguarde.' }

  const { data: acc } = await supabase
    .from('instagram_accounts')
    .select('ig_user_id, access_token, page_id, page_token')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!acc) return { ok: false, error: 'Conta não encontrada.' }

  return subscribeAccountWebhooks(
    acc.ig_user_id,
    decryptToken(acc.access_token),
    acc.page_id,
    acc.page_token ? decryptToken(acc.page_token) : null,
  )
}
