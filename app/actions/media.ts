'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/crypto'
import { rateLimit } from '@/lib/rate-limit'

// ─── Tipos ──────────────────────────────────────────────────────────────────────

export interface MediaItem {
  id:            string
  bot_id:        string
  media_type:    'image' | 'video'
  file_id:       string
  thumb_file_id: string | null
  caption:       string | null
  width:         number | null
  height:        number | null
  duration:      number | null
  created_at:    string
}

// ─── listMediaLibraryAction ──────────────────────────────────────────────────────
// Lista as mídias capturadas para um bot específico (file_id é por-bot).
export async function listMediaLibraryAction(
  botId: string,
  mediaType?: 'image' | 'video',
): Promise<MediaItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  let query = supabase
    .from('media_library')
    .select('id, bot_id, media_type, file_id, thumb_file_id, caption, width, height, duration, created_at')
    .eq('user_id', user.id)
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })
    .limit(120)

  if (mediaType) query = query.eq('media_type', mediaType)

  const { data, error } = await query
  if (error) throw new Error('Erro ao carregar a biblioteca de mídia.')
  return (data ?? []) as MediaItem[]
}

// ─── deleteMediaItemAction ───────────────────────────────────────────────────────
export async function deleteMediaItemAction(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const { error } = await supabase
    .from('media_library')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error('Erro ao apagar a mídia.')
  return { ok: true }
}

// ─── getMediaThumbnailsAction ────────────────────────────────────────────────────
// Baixa as miniaturas (via getFile) e devolve como data URL base64 — evita expor o
// token do bot no src da imagem. Recebe ids da biblioteca; resolve o token por bot.
export async function getMediaThumbnailsAction(
  ids: string[],
): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (ids.length === 0) return {}

  const rl = await rateLimit(`media-thumbs:${user.id}`, 30, 60 * 1000)
  if (!rl.ok) throw new Error('Muitas requisições. Aguarde um momento.')

  const capped = ids.slice(0, 60)

  const { data: items } = await supabase
    .from('media_library')
    .select('id, bot_id, file_id, thumb_file_id')
    .eq('user_id', user.id)
    .in('id', capped)

  if (!items || items.length === 0) return {}

  // Resolve o token (descriptografado) de cada bot envolvido
  const botIds = [...new Set(items.map(i => i.bot_id))]
  const { data: bots } = await supabase
    .from('bots')
    .select('id, token')
    .eq('user_id', user.id)
    .in('id', botIds)

  const tokenByBot = new Map<string, string>()
  for (const b of bots ?? []) {
    if (b.token) {
      try { tokenByBot.set(b.id, decryptToken(b.token as string)) } catch { /* ignora token inválido */ }
    }
  }

  const result: Record<string, string> = {}

  await Promise.allSettled(
    items.map(async (item) => {
      const token = tokenByBot.get(item.bot_id)
      const fileId = item.thumb_file_id ?? item.file_id
      if (!token || !fileId) return
      try {
        const fileRes = await fetch(
          `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
          { cache: 'no-store' },
        )
        const fileJson = await fileRes.json() as { ok: boolean; result?: { file_path?: string } }
        const filePath = fileJson.result?.file_path
        if (!filePath) return
        const imgRes  = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, { cache: 'no-store' })
        const imgBuf  = await imgRes.arrayBuffer()
        const base64  = Buffer.from(imgBuf).toString('base64')
        const ct      = imgRes.headers.get('content-type') ?? 'image/jpeg'
        result[item.id] = `data:${ct};base64,${base64}`
      } catch {
        // ignora miniatura que falhar
      }
    }),
  )

  return result
}
