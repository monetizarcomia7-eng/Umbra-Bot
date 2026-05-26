'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'

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
