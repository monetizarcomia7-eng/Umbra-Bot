/**
 * Instagram OAuth — adapter para Meta Graph API v19.0
 *
 * Fluxo:
 *   1. buildAuthUrl(state) — gera URL de autorização
 *   2. Usuário autoriza no Facebook → Meta redireciona para /api/auth/instagram/callback
 *   3. exchangeCodeForToken(code) → token curto (1h)
 *   4. getLongLivedToken(shortToken) → token longo (60 dias)
 *   5. getFacebookPages(longToken) → lista de páginas do user
 *   6. getInstagramBusinessAccount(pageId, pageToken) → conta IG Business vinculada
 */

const META_API_VERSION = 'v19.0'
const META_GRAPH_URL   = `https://graph.facebook.com/${META_API_VERSION}`
const META_OAUTH_URL   = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`

export const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
].join(',')

// ─── URL de autorização ──────────────────────────────────────────────────
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  process.env.META_REDIRECT_URI!,
    scope:         INSTAGRAM_SCOPES,
    response_type: 'code',
    state,
  })
  return `${META_OAUTH_URL}?${params.toString()}`
}

// ─── Helpers de fetch ────────────────────────────────────────────────────
interface MetaError { message: string; type?: string; code: number; error_subcode?: number }

class MetaAuthError extends Error {
  code: number
  subcode?: number
  constructor(error: MetaError) {
    super(error.message)
    this.name = 'MetaAuthError'
    this.code = error.code
    this.subcode = error.error_subcode
  }
}

// ─── Code → token curto (~1h) ────────────────────────────────────────────
export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(`${META_GRAPH_URL}/oauth/access_token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri:  process.env.META_REDIRECT_URI!,
      code,
    }),
    cache: 'no-store',
  })
  const data = await res.json() as { access_token?: string; error?: MetaError }
  if (data.error) throw new MetaAuthError(data.error)
  if (!data.access_token) throw new Error('Resposta inesperada do Meta OAuth.')
  return data.access_token
}

// ─── Token curto → token longo (60 dias) ─────────────────────────────────
export async function getLongLivedToken(shortToken: string): Promise<{
  access_token: string
  expires_in:   number
}> {
  const url = new URL(`${META_GRAPH_URL}/oauth/access_token`)
  url.searchParams.set('grant_type',       'fb_exchange_token')
  url.searchParams.set('client_id',        process.env.META_APP_ID!)
  url.searchParams.set('client_secret',    process.env.META_APP_SECRET!)
  url.searchParams.set('fb_exchange_token', shortToken)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: MetaError }
  if (data.error) throw new MetaAuthError(data.error)
  if (!data.access_token) throw new Error('Falha ao obter token de longa duração.')

  // Default 60 dias se Meta não retornar expires_in
  return {
    access_token: data.access_token,
    expires_in:   data.expires_in ?? 60 * 86_400,
  }
}

// ─── Lista de páginas do Facebook do user ────────────────────────────────
export async function getFacebookPages(token: string): Promise<Array<{
  id: string; name: string; access_token: string
}>> {
  const url = new URL(`${META_GRAPH_URL}/me/accounts`)
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json() as {
    data?: Array<{ id: string; name: string; access_token: string }>
    error?: MetaError
  }
  if (data.error) throw new MetaAuthError(data.error)
  return data.data ?? []
}

// ─── Conta IG Business vinculada a uma página FB ─────────────────────────
export async function getInstagramBusinessAccount(
  pageId: string,
  pageToken: string,
): Promise<{ id: string; username: string; profile_picture_url?: string }> {
  const url = new URL(`${META_GRAPH_URL}/${pageId}`)
  url.searchParams.set(
    'fields',
    'instagram_business_account{id,username,profile_picture_url}',
  )
  url.searchParams.set('access_token', pageToken)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json() as {
    instagram_business_account?: { id: string; username: string; profile_picture_url?: string }
    error?: MetaError
  }
  if (data.error) throw new MetaAuthError(data.error)
  if (!data.instagram_business_account) {
    throw new Error('Nenhuma conta Instagram Business vinculada a esta página do Facebook.')
  }
  return data.instagram_business_account
}

export { MetaAuthError }
