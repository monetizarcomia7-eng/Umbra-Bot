/**
 * Instagram Publishing — Graph API v19.0
 *
 * Publica IMAGE / REELS / CAROUSEL para a Instagram Business API.
 * Usa o lib/crypto do Umbra Bot para descriptografar tokens AES-256-GCM.
 */

import { decryptToken } from '@/lib/crypto'

const META_GRAPH_URL    = 'https://graph.facebook.com/v19.0'
const POLL_INTERVAL_MS  = 5_000
const POLL_MAX_ATTEMPTS = 120  // 10 min máximo para processamento de vídeo

// ─── Erros customizados ──────────────────────────────────────────────────

export class MetaAPIError extends Error {
  code:    number
  subcode?: number
  constructor(error: { message: string; code: number; error_subcode?: number }) {
    super(error.message)
    this.name    = 'MetaAPIError'
    this.code    = error.code
    this.subcode = error.error_subcode
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────

interface CreateParams {
  image_url?:         string
  video_url?:         string
  caption?:           string
  media_type?:        'REELS' | 'VIDEO' | 'CAROUSEL'
  children?:          string
  is_carousel_item?:  boolean
  share_to_feed?:     boolean
}

async function createMediaContainer(
  igUserId: string,
  token: string,
  params: CreateParams,
): Promise<string> {
  const res = await fetch(`${META_GRAPH_URL}/${igUserId}/media`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, access_token: token }),
    cache: 'no-store',
  })
  const data = await res.json() as { id?: string; error?: { message: string; code: number; error_subcode?: number } }
  if (data.error) throw new MetaAPIError(data.error)
  if (!data.id) throw new Error('Meta não retornou ID do container.')
  return data.id
}

async function publishContainer(
  igUserId: string,
  containerId: string,
  token: string,
): Promise<string> {
  const res = await fetch(`${META_GRAPH_URL}/${igUserId}/media_publish`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
    cache: 'no-store',
  })
  const data = await res.json() as { id?: string; error?: { message: string; code: number; error_subcode?: number } }
  if (data.error) throw new MetaAPIError(data.error)
  if (!data.id) throw new Error('Meta não retornou ID do post publicado.')
  return data.id
}

async function waitForVideoProcessing(
  containerId: string,
  token: string,
): Promise<void> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const url = new URL(`${META_GRAPH_URL}/${containerId}`)
    url.searchParams.set('fields', 'status_code,status')
    url.searchParams.set('access_token', token)

    const res = await fetch(url.toString(), { cache: 'no-store' })
    const data = await res.json() as { status_code?: string; status?: string }

    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR') {
      throw new Error(`Erro no processamento do vídeo pela Meta: ${data.status ?? 'desconhecido'}`)
    }
    // IN_PROGRESS → continua polling
  }
  throw new Error('Timeout de 10 min no processamento do vídeo pela Meta.')
}

// ─── Tipos públicos ──────────────────────────────────────────────────────

export interface PublishResult {
  ig_post_id: string
}

export interface PublishInput {
  ig_user_id:   string
  access_token: string                            // criptografado (lib/crypto)
  media_type:   'IMAGE' | 'REELS' | 'CAROUSEL'
  media_urls:   string[]
  caption:      string
}

// ─── publishImage ────────────────────────────────────────────────────────

export async function publishImage(
  igUserId:       string,
  encryptedToken: string,
  imageUrl:       string,
  caption:        string,
): Promise<PublishResult> {
  const token = decryptToken(encryptedToken)
  const containerId = await createMediaContainer(igUserId, token, {
    image_url: imageUrl,
    caption,
  })
  const postId = await publishContainer(igUserId, containerId, token)
  return { ig_post_id: postId }
}

// ─── publishReel ─────────────────────────────────────────────────────────

export async function publishReel(
  igUserId:       string,
  encryptedToken: string,
  videoUrl:       string,
  caption:        string,
  shareToFeed:    boolean = true,
): Promise<PublishResult> {
  const token = decryptToken(encryptedToken)

  const containerId = await createMediaContainer(igUserId, token, {
    media_type:    'REELS',
    video_url:     videoUrl,
    caption,
    share_to_feed: shareToFeed,
  })

  await waitForVideoProcessing(containerId, token)

  const postId = await publishContainer(igUserId, containerId, token)
  return { ig_post_id: postId }
}

// ─── publishCarousel ─────────────────────────────────────────────────────

const VIDEO_RE = /\.(mp4|mov|avi)$/i

export async function publishCarousel(
  igUserId:       string,
  encryptedToken: string,
  mediaUrls:      string[],
  caption:        string,
): Promise<PublishResult> {
  if (mediaUrls.length < 2 || mediaUrls.length > 10) {
    throw new Error('Carrossel precisa ter entre 2 e 10 itens.')
  }
  const token = decryptToken(encryptedToken)

  // 1. Cria container para cada item em paralelo
  const childIds = await Promise.all(
    mediaUrls.map(url => {
      const isVideo = VIDEO_RE.test(url)
      return createMediaContainer(igUserId, token, {
        ...(isVideo
          ? { media_type: 'VIDEO' as const, video_url: url }
          : { image_url: url }),
        is_carousel_item: true,
      })
    }),
  )

  // 2. Aguarda processamento de qualquer vídeo presente
  const hasVideos = mediaUrls.some(url => VIDEO_RE.test(url))
  if (hasVideos) {
    await Promise.all(childIds.map(id => waitForVideoProcessing(id, token)))
  }

  // 3. Cria container do carrossel
  const carouselId = await createMediaContainer(igUserId, token, {
    media_type: 'CAROUSEL',
    children:   childIds.join(','),
    caption,
  })

  // 4. Publica
  const postId = await publishContainer(igUserId, carouselId, token)
  return { ig_post_id: postId }
}

// ─── Função principal — decide tipo automaticamente ──────────────────────

export async function publishPost(post: PublishInput): Promise<PublishResult> {
  switch (post.media_type) {
    case 'IMAGE':
      return publishImage(post.ig_user_id, post.access_token, post.media_urls[0], post.caption)
    case 'REELS':
      return publishReel(post.ig_user_id, post.access_token, post.media_urls[0], post.caption)
    case 'CAROUSEL':
      return publishCarousel(post.ig_user_id, post.access_token, post.media_urls, post.caption)
    default:
      throw new Error(`Tipo de mídia inválido: ${(post as { media_type: string }).media_type}`)
  }
}

// ─── Mensagens amigáveis por código de erro ──────────────────────────────

export const META_ERROR_MESSAGES: Record<number, string> = {
  190:     'Token de acesso expirado. Reconecte sua conta Instagram.',
  200:     'Permissão negada. Verifique as permissões do app no Meta for Developers.',
  9:       'Muitas publicações hoje. O Instagram limita 50 posts/dia por conta.',
  32:      'Limite da API atingido. Tente novamente em alguns minutos.',
  100:     'Parâmetro inválido. Verifique a mídia e a legenda.',
  368:     'Sua conta foi temporariamente bloqueada pelo Instagram.',
  2207050: 'Vídeo ainda em processamento. Aguarde e tente novamente.',
  2207006: 'O vídeo não atende aos requisitos do Instagram (MP4, H.264, mín 720p).',
  2207003: 'A proporção do vídeo não é suportada para Reels (use 9:16).',
  24:      'URL da mídia inválida ou inacessível pela Meta.',
}

export function getMetaErrorMessage(code: number): string {
  return META_ERROR_MESSAGES[code] ?? `Erro da API da Meta (código ${code}).`
}
