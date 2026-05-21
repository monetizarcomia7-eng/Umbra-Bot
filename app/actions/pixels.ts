'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/crypto'
import { rateLimit } from '@/lib/rate-limit'
import type { PixelStats } from '@/app/dashboard/tracking/page'

/* ============================================================
   Types
   ============================================================ */

export interface PixelPatch {
  pixelId:          string | null
  pixelCode:        string | null  // TikTok Pixel Code (distinto do Advertiser ID)
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
   Helpers internos — verificação de credenciais (testPixelAction)
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

async function testTikTokPixel(advertiserId: string, accessToken: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const url = `https://business-api.tiktok.com/open_api/v1.3/pixel/list/?advertiser_id=${encodeURIComponent(advertiserId)}`
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
   Helpers internos — eventos de teste (sendTestPixelEvent)
   ============================================================ */

async function sendMetaTestEvent(pixelId: string, accessToken: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const eventTime = Math.floor(Date.now() / 1000)
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Purchase',
          event_time: eventTime,
          action_source: 'website',
          user_data: {
            client_ip_address: '127.0.0.1',
            client_user_agent: 'umbra-bot/1.0',
          },
          custom_data: { currency: 'BRL', value: 1.00 },
        }],
        test_event_code: 'TEST00001',
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    const data = await res.json() as { events_received?: number; error?: { message: string } }
    const latency = Date.now() - start
    if (data.error) {
      return { ok: false, message: `Meta: ${data.error.message}`, latency: null }
    }
    return {
      ok: true,
      message: `Evento Purchase enviado com sucesso — ${data.events_received ?? 1} evento recebido. Verifique no Gerenciador de Eventos usando o código TEST00001.`,
      latency,
    }
  } catch {
    return { ok: false, message: 'Timeout ao conectar com a Meta CAPI. Verifique o access token.', latency: null }
  }
}

async function sendTikTokTestEvent(pixelCode: string, accessToken: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/pixel/track/'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pixel_code: pixelCode,
        event: 'CompletePayment',
        timestamp: new Date().toISOString(),
        context: {
          user_agent: 'umbra-bot/1.0',
          ip: '127.0.0.1',
        },
        properties: { currency: 'BRL', value: '1.00' },
        test_event_code: 'TEST_EVENT',
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    const data = await res.json() as { code?: number; message?: string }
    const latency = Date.now() - start
    if (data.code !== 0) {
      return { ok: false, message: `TikTok Events API: ${data.message ?? 'Erro desconhecido.'}`, latency: null }
    }
    return {
      ok: true,
      message: `Evento CompletePayment enviado ao TikTok Events API com sucesso.`,
      latency,
    }
  } catch {
    return { ok: false, message: 'Timeout ao conectar com a TikTok Events API.', latency: null }
  }
}

async function sendGoogleTestEvent(measurementId: string, apiSecret: string): Promise<TestResult> {
  // Usa o endpoint /debug/ para validar sem poluir os dados de produção
  const start = Date.now()
  try {
    const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: `umbra-bot-test-${Date.now()}`,
        events: [{
          name: 'purchase',
          params: {
            currency: 'BRL',
            value: 1.00,
            transaction_id: `umbra_test_${Date.now()}`,
          },
        }],
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    const data = await res.json() as { validationMessages?: Array<{ description: string; fieldPath?: string }> }
    const latency = Date.now() - start
    const msgs = data.validationMessages ?? []
    if (msgs.length > 0) {
      return {
        ok: false,
        message: `GA4 Validation: ${msgs[0].description}${msgs[0].fieldPath ? ` (${msgs[0].fieldPath})` : ''}`,
        latency: null,
      }
    }
    return {
      ok: true,
      message: `Evento purchase validado pelo GA4 Measurement Protocol. Nenhum erro de validação encontrado. Confirme no DebugView do Google Analytics.`,
      latency,
    }
  } catch {
    return { ok: false, message: 'Timeout ao conectar com o Google Measurement Protocol.', latency: null }
  }
}

/* ============================================================
   Server Actions
   ============================================================ */

/**
 * Salva ou atualiza a configuração de um pixel do usuário.
 * Retorna o id do registro para que o caller possa abrir o modal de verificação.
 */
export async function savePixelAction(
  provider: string,
  patch: PixelPatch,
): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado')

  await rateLimit(`pixel_save:${user.id}`, 20, 60_000)

  const payload: Record<string, unknown> = {
    user_id:    user.id,
    provider,
    pixel_id:   patch.pixelId?.trim() || null,
    pixel_code: patch.pixelCode?.trim() || null,
    events:     patch.events,
    capi:       patch.capi,
    status:     patch.pixelId?.trim() ? 'warning' : 'inactive',
  }

  if (patch.newToken?.trim()) {
    payload.access_token = encryptToken(patch.newToken.trim())
  } else if (patch.clearToken) {
    payload.access_token = null
  }

  const { data, error } = await supabase
    .from('pixels')
    .upsert(payload, { onConflict: 'user_id,provider' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { id: (data as { id: string }).id }
}

/**
 * Verifica a conexão de um pixel com a API do provider.
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
    .eq('user_id', user.id)
    .single()

  if (!pixel) return { ok: false, message: 'Pixel não encontrado.', latency: null }
  if (!pixel.pixel_id) return { ok: false, message: 'Pixel sem ID configurado. Edite e adicione o ID antes de verificar.', latency: null }

  const plainToken = pixel.access_token ? decryptToken(pixel.access_token) : null

  let result: TestResult
  switch (pixel.provider) {
    case 'meta':
      if (!plainToken) return { ok: false, message: 'Access token não configurado. Necessário para verificar via CAPI.', latency: null }
      result = await testMetaPixel(pixel.pixel_id, plainToken)
      break

    case 'tiktok':
      if (!plainToken) return { ok: false, message: 'Access token não configurado. Necessário para verificar via Events API.', latency: null }
      result = await testTikTokPixel(pixel.pixel_id, plainToken)
      break

    case 'google':
      result = validateGoogleId(pixel.pixel_id)
      break

    default:
      return { ok: false, message: 'Provider não suportado.', latency: null }
  }

  // Persiste status verificado no banco (fire-and-forget)
  supabase
    .from('pixels')
    .update({ status: result.ok ? 'healthy' : 'warning' })
    .eq('id', pixelDbId)
    .eq('user_id', user.id)
    .then(() => {/* silencioso */})

  return result
}

/**
 * Envia um evento de teste real para o provider do pixel.
 * Meta: usa test_event_code (visível no Gerenciador de Eventos).
 * TikTok: envia via Events API com test_event_code.
 * Google: envia para /debug/mp/collect (não contamina dados de produção).
 */
export async function sendTestPixelEvent(pixelDbId: string): Promise<TestResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Não autorizado.', latency: null }

  await rateLimit(`pixel_test_event:${user.id}`, 5, 60_000)

  const { data: pixel } = await supabase
    .from('pixels')
    .select('provider, pixel_id, pixel_code, access_token')
    .eq('id', pixelDbId)
    .eq('user_id', user.id)
    .single()

  if (!pixel) return { ok: false, message: 'Pixel não encontrado.', latency: null }
  if (!pixel.pixel_id) return { ok: false, message: 'Configure o ID do pixel antes de enviar um evento de teste.', latency: null }
  if (!pixel.access_token) return { ok: false, message: 'Configure o access token para enviar eventos de teste via API server-side.', latency: null }

  const plainToken = decryptToken(pixel.access_token)

  let result: TestResult
  switch (pixel.provider) {
    case 'meta':
      result = await sendMetaTestEvent(pixel.pixel_id, plainToken)
      break
    case 'tiktok':
      // Para TikTok: usa pixel_code para envio de eventos; fallback para pixel_id se não configurado
      result = await sendTikTokTestEvent(pixel.pixel_code ?? pixel.pixel_id, plainToken)
      break
    case 'google':
      result = await sendGoogleTestEvent(pixel.pixel_id, plainToken)
      break
    default:
      return { ok: false, message: 'Provider não suportado.', latency: null }
  }

  // Registra timestamp do teste no banco (fire-and-forget)
  if (result.ok) {
    supabase
      .from('pixels')
      .update({ last_test_at: new Date().toISOString() })
      .eq('id', pixelDbId)
      .eq('user_id', user.id)
      .then(() => {/* silencioso */})
  }

  return result
}

/**
 * Re-busca as estatísticas do pixel no servidor.
 * Usado pelo auto-refresh client-side a cada 5 minutos.
 */
export async function fetchPixelStats(): Promise<PixelStats> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { events_sent_today: 0, events_matched: 0, last_event: null }

  const { data } = await supabase.rpc('pixels_stats', { p_user_id: user.id })
  return (data as PixelStats | null) ?? { events_sent_today: 0, events_matched: 0, last_event: null }
}
