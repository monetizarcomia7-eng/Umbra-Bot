'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/crypto'
import { rateLimit } from '@/lib/rate-limit'

/* ============================================================
   Types
   ============================================================ */

export interface PixelPatch {
  pixelId:          string | null
  newToken:         string | null  // null = usuário não digitou nada
  clearToken:       boolean        // true = usuário limpou o campo explicitamente
  events:           Record<string, boolean>
  capi:             boolean
}

export interface TestResult {
  ok:      boolean
  message: string
  latency: number | null
}

/* ============================================================
   Helpers internos — chamadas a APIs de pixels
   ============================================================ */

async function testMetaPixel(pixelId: string, accessToken: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}?access_token=${encodeURIComponent(accessToken)}&fields=id,name`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    const data = await res.json() as { id?: string; name?: string; error?: { message: string } }
    const latency = Date.now() - start
    if (data.error) {
      return { ok: false, message: `Meta: ${data.error.message}`, latency: null }
    }
    return {
      ok: true,
      message: `Pixel "${data.name ?? data.id}" encontrado e ativo na Meta.`,
      latency,
    }
  } catch {
    return { ok: false, message: 'Timeout ao conectar com a Meta Graph API. Verifique o access token.', latency: null }
  }
}

async function testTikTokPixel(pixelId: string, accessToken: string): Promise<TestResult> {
  const start = Date.now()
  try {
    // TikTok Business API — lista pixels do anunciante
    const url = `https://business-api.tiktok.com/open_api/v1.3/pixel/list/?advertiser_id=${encodeURIComponent(pixelId)}`
    const res = await fetch(url, {
      headers: { 'Access-Token': accessToken },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    const data = await res.json() as { code?: number; message?: string; data?: { pixels?: unknown[] } }
    const latency = Date.now() - start
    if (data.code !== 0) {
      return { ok: false, message: `TikTok: ${data.message ?? 'Credenciais inválidas.'}`, latency: null }
    }
    const count = data.data?.pixels?.length ?? 0
    return {
      ok: true,
      message: `TikTok Pixel verificado — ${count} pixel(s) encontrado(s) nessa conta.`,
      latency,
    }
  } catch {
    return { ok: false, message: 'Timeout ao conectar com a TikTok Business API. Verifique o access token.', latency: null }
  }
}

function validateGoogleId(measurementId: string): TestResult {
  // GA4 Measurement ID: G- seguido de 6-12 caracteres alfanuméricos
  const valid = /^G-[A-Z0-9]{6,12}$/i.test(measurementId.trim())
  if (!valid) {
    return {
      ok: false,
      message: 'Formato inválido. O ID de medição do GA4 deve ser G-XXXXXXXXXX (veja em Admin → Fluxos de dados do GA4).',
      latency: null,
    }
  }
  return {
    ok: true,
    message: `ID de medição ${measurementId.trim().toUpperCase()} tem formato válido. Configure o Measurement Protocol para envios server-side.`,
    latency: 0,
  }
}

/* ============================================================
   Server Actions
   ============================================================ */

/**
 * Salva ou atualiza a configuração de um pixel do usuário.
 * - user_id sempre lido do servidor (sem IDOR)
 * - access_token sempre criptografado com AES-256-GCM
 * - upsert por (user_id, provider) — padrão idêntico ao gateways
 */
export async function savePixelAction(
  provider: string,
  patch: PixelPatch,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado')

  await rateLimit(`pixel_save:${user.id}`, 20, 60_000)

  // Monta o payload — access_token é opcional no UPDATE
  const payload: Record<string, unknown> = {
    user_id:  user.id,
    provider,
    pixel_id: patch.pixelId?.trim() || null,
    events:   patch.events,
    capi:     patch.capi,
    // status é calculado dinamicamente na UI; no banco guardamos o estado base
    status:   patch.pixelId?.trim() ? 'warning' : 'inactive',
  }

  if (patch.newToken?.trim()) {
    // Usuário digitou um novo token → criptografa e salva
    payload.access_token = encryptToken(patch.newToken.trim())
  } else if (patch.clearToken) {
    // Usuário limpou o campo explicitamente → remove o token
    payload.access_token = null
  }
  // Se newToken=null e clearToken=false → não inclui access_token no payload
  // → Supabase upsert preserva o valor existente (não sobrescreve)

  const { error } = await supabase
    .from('pixels')
    .upsert(payload, { onConflict: 'user_id,provider' })

  if (error) throw new Error(error.message)
}

/**
 * Verifica a conexão de um pixel com a API do provider.
 * - Descriptografa o token no servidor (nunca expõe ao cliente)
 * - Chama a API real do provider e retorna resultado
 */
export async function testPixelAction(pixelDbId: string): Promise<TestResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Não autorizado.', latency: null }

  await rateLimit(`pixel_test:${user.id}`, 10, 60_000)

  const { data: pixel } = await supabase
    .from('pixels')
    .select('provider, pixel_id, access_token')
    .eq('id', pixelDbId)
    .eq('user_id', user.id) // IDOR guard
    .single()

  if (!pixel) return { ok: false, message: 'Pixel não encontrado.', latency: null }
  if (!pixel.pixel_id) return { ok: false, message: 'Pixel sem ID configurado. Edite e adicione o ID antes de verificar.', latency: null }

  const plainToken = pixel.access_token ? decryptToken(pixel.access_token) : null

  switch (pixel.provider) {
    case 'meta':
      if (!plainToken) return { ok: false, message: 'Access token não configurado. Necessário para verificar via CAPI.', latency: null }
      return testMetaPixel(pixel.pixel_id, plainToken)

    case 'tiktok':
      if (!plainToken) return { ok: false, message: 'Access token não configurado. Necessário para verificar via Events API.', latency: null }
      return testTikTokPixel(pixel.pixel_id, plainToken)

    case 'google':
      // Google só valida formato — Measurement Protocol não tem endpoint de teste público
      return validateGoogleId(pixel.pixel_id)

    default:
      return { ok: false, message: 'Provider não suportado.', latency: null }
  }
}
