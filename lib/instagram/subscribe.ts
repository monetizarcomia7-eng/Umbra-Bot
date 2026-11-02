/**
 * Assina a conta Instagram nos webhooks do app (comments, messages, messaging_postbacks).
 * O interruptor "Assinar" do painel Meta vale para o app; cada conta ainda precisa ser assinada
 * via POST /{ig-user-id}/subscribed_apps com o token da própria conta.
 */
import { META_GRAPH_URL, META_IG_GRAPH_URL, isInstagramLoginToken } from './graph'

const FIELDS = 'comments,messages,messaging_postbacks'

interface Target { url: string; token: string }

function target(igUserId: string, token: string, pageId?: string | null, pageToken?: string | null): Target {
  if (isInstagramLoginToken(token)) {
    return { url: `${META_IG_GRAPH_URL}/${igUserId}/subscribed_apps`, token }
  }
  // Facebook Login: a assinatura é feita na Página vinculada, com o token da Página
  return { url: `${META_GRAPH_URL}/${pageId ?? igUserId}/subscribed_apps`, token: pageToken ?? token }
}

export async function subscribeAccountWebhooks(
  igUserId: string, token: string, pageId?: string | null, pageToken?: string | null,
): Promise<{ ok: true; fields: string[] } | { ok: false; error: string }> {
  const t = target(igUserId, token, pageId, pageToken)
  try {
    const post = new URL(t.url)
    post.searchParams.set('subscribed_fields', FIELDS)
    post.searchParams.set('access_token', t.token)
    const res  = await fetch(post.toString(), { method: 'POST', cache: 'no-store' })
    const data = await res.json() as { success?: boolean; error?: { message: string; code: number } }
    if (data.error) return { ok: false, error: `A Meta recusou a assinatura (código ${data.error.code}): ${data.error.message}` }

    // Confere o que ficou ativo
    const get = new URL(t.url)
    get.searchParams.set('access_token', t.token)
    const chk = await fetch(get.toString(), { cache: 'no-store' })
    const cd  = await chk.json() as { data?: Array<{ subscribed_fields?: string[] }> }
    const fields = cd.data?.flatMap(d => d.subscribed_fields ?? []) ?? []
    return { ok: true, fields }
  } catch {
    return { ok: false, error: 'Não foi possível falar com a Meta. Tente de novo.' }
  }
}
