/**
 * Instagram Token Refresh — renova tokens de longa duração antes de expirarem.
 * Chamado pelo cron /api/cron/refresh-instagram-tokens (1x a cada 12h).
 */

import { encryptToken, decryptToken } from '@/lib/crypto'

const META_GRAPH_URL = 'https://graph.facebook.com/v19.0'

export async function refreshLongLivedToken(encryptedToken: string): Promise<{
  encryptedToken: string
  expiresAt:      Date
}> {
  const currentToken = decryptToken(encryptedToken)

  const url = new URL(`${META_GRAPH_URL}/oauth/access_token`)
  url.searchParams.set('grant_type',        'fb_exchange_token')
  url.searchParams.set('client_id',         process.env.META_APP_ID!)
  url.searchParams.set('client_secret',     process.env.META_APP_SECRET!)
  url.searchParams.set('fb_exchange_token', currentToken)

  const res  = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: { message: string } }

  if (data.error) throw new Error(data.error.message)
  if (!data.access_token) throw new Error('Resposta inesperada do refresh de token.')

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 60 * 86_400) * 1_000)
  return {
    encryptedToken: encryptToken(data.access_token),
    expiresAt,
  }
}
