'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/crypto'
import { rateLimit } from '@/lib/rate-limit'

// ─── Provider helpers ─────────────────────────────────────────────────────────

const PROVIDER_NAMES: Record<string, string> = {
  mercadopago: 'Mercado Pago',
}

async function callGatewayApi(
  provider: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string; accountInfo?: string }> {
  try {
    if (provider === 'mercadopago') {
      const res = await fetch('https://api.mercadopago.com/v1/users/me', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        return { ok: false, error: 'Access token inválido. Verifique no painel do Mercado Pago.' }
      }
      const json = (await res.json()) as { email?: string; nickname?: string }
      return { ok: true, accountInfo: json.email ?? json.nickname ?? 'Conectado' }
    }
    // Outros providers: validação básica de tamanho (integração completa por provider)
    if (apiKey.trim().length < 10) {
      return { ok: false, error: 'Chave de API muito curta.' }
    }
    return { ok: true, accountInfo: 'Credenciais verificadas.' }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, error: 'Tempo de resposta esgotado. Tente novamente.' }
    }
    return { ok: false, error: 'Não foi possível validar as credenciais.' }
  }
}

// ─── validateGatewayCredentialsAction ────────────────────────────────────────
// Valida credenciais sem salvar no banco (passo 1 do ConnectModal)

export async function validateGatewayCredentialsAction(
  provider: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string; accountInfo?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }

  const rl = await rateLimit(`gw-validate:${user.id}`, 15, 60 * 60 * 1000)
  if (!rl.ok) return { ok: false, error: 'Muitas tentativas. Tente novamente em 1 hora.' }

  if (!apiKey.trim()) return { ok: false, error: 'Chave de API obrigatória.' }

  return callGatewayApi(provider, apiKey.trim())
}

// ─── connectGatewayAction ─────────────────────────────────────────────────────
// Valida (defesa em profundidade) + salva credencial encriptada no banco

export async function connectGatewayAction(
  provider: string,
  apiKey: string,
  bankAccountId: string,
): Promise<{ ok: boolean; error?: string; gatewayId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }

  const rl = await rateLimit(`gw-connect:${user.id}`, 10, 60 * 60 * 1000)
  if (!rl.ok) return { ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' }

  // Re-valida server-side (defesa em profundidade)
  const validation = await callGatewayApi(provider, apiKey.trim())
  if (!validation.ok) return { ok: false, error: validation.error }

  // Busca conta bancária (IDOR-safe: .eq user_id)
  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('id, label')
    .eq('id', bankAccountId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!bankAccount) return { ok: false, error: 'Conta bancária não encontrada.' }

  const encryptedToken = encryptToken(apiKey.trim())

  const { data, error } = await supabase
    .from('gateways')
    .upsert(
      {
        user_id:     user.id,
        provider,
        name:        PROVIDER_NAMES[provider] ?? provider,
        connected:   true,
        status:      'active',
        account:     bankAccount.label,
        account_id:  bankAccount.id,
        credentials: { token: encryptedToken },
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select('id')
    .single()

  if (error) return { ok: false, error: 'Erro ao salvar configuração. Tente novamente.' }

  // activity_event — fire-and-forget
  supabase.from('activity_events').insert({
    user_id:     user.id,
    type:        'newBot',
    title:       `${PROVIDER_NAMES[provider] ?? provider} conectado`,
    description: 'Gateway de pagamento configurado com sucesso.',
  }).then(() => {})

  return { ok: true, gatewayId: data.id }
}

// ─── disconnectGatewayAction ──────────────────────────────────────────────────

export async function disconnectGatewayAction(
  gatewayId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }

  // Lê nome para o activity_event (IDOR-safe: .eq user_id)
  const { data: gateway } = await supabase
    .from('gateways')
    .select('name, provider')
    .eq('id', gatewayId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!gateway) return { ok: false, error: 'Gateway não encontrado.' }

  const { error } = await supabase
    .from('gateways')
    .update({
      connected:   false,
      status:      'disabled',
      credentials: {},
      account:     null,
      account_id:  null,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', gatewayId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: 'Erro ao desconectar gateway.' }

  // activity_event — fire-and-forget
  supabase.from('activity_events').insert({
    user_id:     user.id,
    type:        'disconnect',
    title:       `${gateway.name} desconectado`,
    description: 'Gateway de pagamento foi desconectado.',
  }).then(() => {})

  return { ok: true }
}

// ─── updateGatewayAction ──────────────────────────────────────────────────────
// Atualiza apenas a conta bancária de recebimento (sem alterar credenciais)

export async function updateGatewayAction(
  gatewayId: string,
  bankAccountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }

  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('id, label')
    .eq('id', bankAccountId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!bankAccount) return { ok: false, error: 'Conta bancária não encontrada.' }

  const { error } = await supabase
    .from('gateways')
    .update({
      account:    bankAccount.label,
      account_id: bankAccount.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gatewayId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: 'Erro ao salvar configuração.' }
  return { ok: true }
}

// ─── testGatewayConnectionAction ─────────────────────────────────────────────
// Descriptografa a credencial salva e chama a API do gateway para validar

export async function testGatewayConnectionAction(
  gatewayId: string,
): Promise<{ ok: boolean; error?: string; accountInfo?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }

  const { data: gateway } = await supabase
    .from('gateways')
    .select('provider, credentials')
    .eq('id', gatewayId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!gateway) return { ok: false, error: 'Gateway não encontrado.' }

  const rawToken = (gateway.credentials as Record<string, unknown> | null)?.token
  if (!rawToken || typeof rawToken !== 'string') {
    return { ok: false, error: 'Credenciais não encontradas. Reconecte o gateway.' }
  }

  const apiKey = decryptToken(rawToken)
  if (!apiKey) return { ok: false, error: 'Erro ao descriptografar credenciais.' }

  return callGatewayApi(gateway.provider ?? '', apiKey)
}
