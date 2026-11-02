/**
 * Instagram Token Refresh — renova tokens de longa duração antes de expirarem.
 * Chamado pelo cron /api/cron/refresh-instagram-tokens (1x a cada 12h).
 */

import { encryptToken, decryptToken } from '@/lib/crypto'
import { META_GRAPH_URL, META_IG_GRAPH_URL, isInstagramLoginToken } from './graph'

export async function refreshLongLivedToken(encryptedToken: string): Promise<{
  encryptedToken: string
  expiresAt:      Date
}> {
  const currentToken = decryptToken(encryptedToken)

  // Token do Instagram Login: renovação própria (o token precisa ter pelo menos 24h)
  if (isInstagramLoginToken(currentToken)) {
    const igUrl = new URL(`${META_IG_GRAPH_URL.replace(/\/v[\d.]+$/, '')}/refresh_access_token`)
    igUrl.searchParams.set('grant_type',   'ig_refresh_token')
    igUrl.searchParams.set('access_token', currentToken)
    const igRes  = await fetch(igUrl.toString(), { cache: 'no-store' })
    const igData = await igRes.json() as { access_token?: string; expires_in?: number; error?: { message: string } }
    if (igData.error) throw new Error(igData.error.message)
    if (!igData.access_token) throw new Error('Resposta inesperada do refresh de token.')
    return {
      encryptedToken: encryptToken(igData.access_token),
      expiresAt:      new Date(Date.now() + (igData.expires_in ?? 60 * 86_400) * 1_000),
    }
  }

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
