import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/crypto'

/**
 * Retorna o access token do Mercado Pago para o usuário autenticado.
 *
 * Prioridade:
 *  1. Credencial do gateway cadastrada pelo usuário (gateways.credentials.token)
 *  2. MERCADOPAGO_ACCESS_TOKEN (variável de ambiente global — fallback)
 *
 * Só funciona em contextos server-side com sessão ativa (API routes autenticadas).
 */
export async function getMercadoPagoToken(): Promise<string | null> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return process.env.MERCADOPAGO_ACCESS_TOKEN ?? null

    const { data } = await supabase
      .from('gateways')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('provider', 'mercadopago')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const rawToken = (data?.credentials as Record<string, unknown> | null)?.token
    if (rawToken && typeof rawToken === 'string') {
      const decrypted = decryptToken(rawToken)
      if (decrypted) return decrypted
    }
  } catch {
    // fall through to env var
  }

  return process.env.MERCADOPAGO_ACCESS_TOKEN ?? null
}
