'use server'

import { randomBytes, createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/crypto'
import { rateLimit } from '@/lib/rate-limit'

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface WebhookPayload {
  name:   string
  url:    string
  events: string[]
  secret: string
}

function validateUrl(url: string): string | null {
  try {
    const p = new URL(url.trim())
    if (!['http:', 'https:'].includes(p.protocol)) return 'URL precisa usar http:// ou https://.'
    const h = p.hostname
    if (h === 'localhost' || h === '127.0.0.1') return 'Localhost não é permitido.'
    if (h.startsWith('169.254.') || h.startsWith('10.') || /^192\.168\./.test(h))
      return 'IPs de rede privada não são permitidos.'
    return null
  } catch {
    return 'URL inválida.'
  }
}

async function getAuthedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autorizado.')
  return { supabase, user }
}

/* ── generateSecretAction ───────────────────────────────────────────────────── */

export async function generateSecretAction(): Promise<string> {
  return 'whsec_' + randomBytes(18).toString('hex')
}

/* ── createWebhookAction ────────────────────────────────────────────────────── */

export async function createWebhookAction(payload: WebhookPayload): Promise<{ id: string }> {
  const { supabase, user } = await getAuthedUser()

  const rl = await rateLimit(`webhook-create:${user.id}`, 10, 60 * 60 * 1000)
  if (!rl.ok) throw new Error('Muitas requisições. Tente novamente em alguns minutos.')

  const urlErr = validateUrl(payload.url)
  if (urlErr) throw new Error(urlErr)
  if (!payload.name.trim()) throw new Error('Informe um nome.')
  if (payload.events.length === 0) throw new Error('Selecione pelo menos um evento.')

  const id = 'wh_' + randomBytes(8).toString('hex')
  const encryptedSecret = encryptToken(payload.secret)

  const { error } = await supabase.from('webhooks').insert({
    id,
    user_id:       user.id,
    name:          payload.name.trim(),
    url:           payload.url.trim(),
    events:        payload.events,
    secret:        encryptedSecret,
    status:        'healthy',
    active:        true,
    deliveries_24h: 0,
    success_rate:  100,
    last_delivery: null,
  })

  if (error) throw new Error('Erro ao criar webhook: ' + error.message)
  return { id }
}

/* ── updateWebhookAction ────────────────────────────────────────────────────── */

export async function updateWebhookAction(
  id: string,
  payload: Partial<WebhookPayload>,
): Promise<void> {
  const { supabase, user } = await getAuthedUser()

  const rl = await rateLimit(`webhook-update:${user.id}`, 20, 60 * 60 * 1000)
  if (!rl.ok) throw new Error('Muitas requisições. Tente novamente.')

  if (payload.url) {
    const urlErr = validateUrl(payload.url)
    if (urlErr) throw new Error(urlErr)
  }

  const patch: Record<string, unknown> = {}
  if (payload.name   !== undefined) patch.name   = payload.name.trim()
  if (payload.url    !== undefined) patch.url    = payload.url.trim()
  if (payload.events !== undefined) patch.events = payload.events
  if (payload.secret !== undefined) patch.secret = encryptToken(payload.secret)

  const { error } = await supabase
    .from('webhooks')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error('Erro ao atualizar webhook: ' + error.message)
}

/* ── deleteWebhookAction ────────────────────────────────────────────────────── */

export async function deleteWebhookAction(id: string): Promise<void> {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error('Erro ao remover webhook: ' + error.message)
}

/* ── toggleWebhookAction ────────────────────────────────────────────────────── */

export async function toggleWebhookAction(id: string, active: boolean): Promise<void> {
  const { supabase, user } = await getAuthedUser()

  const { error } = await supabase
    .from('webhooks')
    .update({
      active,
      status: active ? 'healthy' : 'paused',
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error('Erro ao atualizar webhook: ' + error.message)
}

/* ── testWebhookAction ──────────────────────────────────────────────────────── */

export interface TestWebhookResult {
  ok:         boolean
  status:     number | null
  durationMs: number
  message:    string
}

export async function testWebhookAction(id: string): Promise<TestWebhookResult> {
  const { supabase, user } = await getAuthedUser()

  const rl = await rateLimit(`webhook-test:${user.id}`, 10, 60 * 1000)
  if (!rl.ok) throw new Error('Muitas requisições de teste. Aguarde 1 minuto.')

  const { data: webhook, error: fetchErr } = await supabase
    .from('webhooks')
    .select('id, url, secret, active')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !webhook) throw new Error('Webhook não encontrado.')
  if (!webhook.active) throw new Error('Webhook está pausado.')

  const plainSecret = decryptToken(webhook.secret)
  const deliveryId  = randomBytes(8).toString('hex')
  const payload = JSON.stringify({
    id:      deliveryId,
    event:   'test.ping',
    created: Date.now(),
    data:    { message: 'Evento de teste enviado pelo Umbra Bot.' },
  })

  const signature = 'sha256=' + createHmac('sha256', plainSecret).update(payload).digest('hex')

  const start = Date.now()
  let responseStatus: number | null = null
  let responseBody = ''
  let fetchOk = false

  try {
    const res = await fetch(webhook.url, {
      method:  'POST',
      headers: {
        'Content-Type':           'application/json',
        'X-Umbra-Signature-256':  signature,
        'X-Umbra-Event':          'test.ping',
        'X-Umbra-Delivery':       deliveryId,
        'X-Umbra-Timestamp':      String(Date.now()),
        'User-Agent':             'Umbra-Bot-Webhook/1.0',
      },
      body:    payload,
      signal:  AbortSignal.timeout(8000),
    })
    responseStatus = res.status
    responseBody   = await res.text().catch(() => '')
    fetchOk        = res.ok
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'Erro de conexão'
  }

  const durationMs = Date.now() - start

  // Persiste a entrega de teste (fire-and-forget)
  void (async () => {
    try {
      await supabase.from('webhook_deliveries').insert({
        webhook_id:      id,
        user_id:         user.id,
        event_type:      'test.ping',
        payload:         JSON.parse(payload),
        response_status: responseStatus,
        response_body:   responseBody.slice(0, 2000),
        duration_ms:     durationMs,
        success:         fetchOk,
        attempt:         1,
      })
      try { await supabase.rpc('sync_webhook_stats', { p_webhook_id: id }) } catch { /* ignore */ }
      if (fetchOk) {
        try {
          await supabase
            .from('webhooks')
            .update({ last_delivery: Date.now() })
            .eq('id', id)
            .eq('user_id', user.id)
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  })()

  return {
    ok:         fetchOk,
    status:     responseStatus,
    durationMs,
    message:    fetchOk
      ? `Entregue com sucesso — ${responseStatus} em ${durationMs} ms`
      : `Falha — ${responseStatus ?? 'sem resposta'} (${durationMs} ms)`,
  }
}

/* ── loadDeliveriesAction ───────────────────────────────────────────────────── */

export interface RawDelivery {
  id:              string
  event_type:      string
  response_status: number | null
  duration_ms:     number | null
  success:         boolean
  attempt:         number
  created_at:      string
}

export interface DeliveryDetail {
  payload:       Record<string, unknown>
  response_body: string | null
}

export async function loadDeliveryDetailAction(deliveryId: string): Promise<DeliveryDetail> {
  const { supabase, user } = await getAuthedUser()

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('payload, response_body')
    .eq('id', deliveryId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) throw new Error('Entrega não encontrada.')
  return data as DeliveryDetail
}

export async function loadDeliveriesAction(
  webhookId: string,
  page = 0,
): Promise<RawDelivery[]> {
  const { supabase, user } = await getAuthedUser()

  const limit = 20
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, event_type, response_status, duration_ms, success, attempt, created_at')
    .eq('webhook_id', webhookId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1)

  if (error) throw new Error('Erro ao carregar entregas.')
  return (data ?? []) as RawDelivery[]
}

/* ── resendDeliveryAction ───────────────────────────────────────────────────── */

export async function resendDeliveryAction(deliveryId: string): Promise<TestWebhookResult> {
  const { supabase, user } = await getAuthedUser()

  const rl = await rateLimit(`webhook-resend:${user.id}`, 10, 60 * 1000)
  if (!rl.ok) throw new Error('Muitas requisições. Aguarde 1 minuto.')

  // Busca a entrega original + webhook para obter URL e secret
  const { data: delivery, error: dlvErr } = await supabase
    .from('webhook_deliveries')
    .select('id, webhook_id, event_type, payload, attempt')
    .eq('id', deliveryId)
    .eq('user_id', user.id)
    .single()

  if (dlvErr || !delivery) throw new Error('Entrega não encontrada.')

  const { data: webhook, error: whErr } = await supabase
    .from('webhooks')
    .select('id, url, secret, active')
    .eq('id', delivery.webhook_id)
    .eq('user_id', user.id)
    .single()

  if (whErr || !webhook) throw new Error('Webhook não encontrado.')
  if (!webhook.active) throw new Error('Webhook está pausado.')

  const plainSecret = decryptToken(webhook.secret)
  const newDeliveryId = randomBytes(8).toString('hex')
  const payload = JSON.stringify(delivery.payload)
  const signature = 'sha256=' + createHmac('sha256', plainSecret).update(payload).digest('hex')

  const start = Date.now()
  let responseStatus: number | null = null
  let responseBody = ''
  let fetchOk = false

  try {
    const res = await fetch(webhook.url, {
      method:  'POST',
      headers: {
        'Content-Type':           'application/json',
        'X-Umbra-Signature-256':  signature,
        'X-Umbra-Event':          delivery.event_type,
        'X-Umbra-Delivery':       newDeliveryId,
        'X-Umbra-Timestamp':      String(Date.now()),
        'User-Agent':             'Umbra-Bot-Webhook/1.0',
      },
      body:    payload,
      signal:  AbortSignal.timeout(8000),
    })
    responseStatus = res.status
    responseBody   = await res.text().catch(() => '')
    fetchOk        = res.ok
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'Erro de conexão'
  }

  const durationMs = Date.now() - start

  void (async () => {
    try {
      await supabase.from('webhook_deliveries').insert({
        webhook_id:      delivery.webhook_id,
        user_id:         user.id,
        event_type:      delivery.event_type,
        payload:         delivery.payload,
        response_status: responseStatus,
        response_body:   responseBody.slice(0, 2000),
        duration_ms:     durationMs,
        success:         fetchOk,
        attempt:         delivery.attempt + 1,
      })
      try { await supabase.rpc('sync_webhook_stats', { p_webhook_id: delivery.webhook_id }) } catch { /* ignore */ }
      if (fetchOk) {
        try {
          await supabase
            .from('webhooks')
            .update({ last_delivery: Date.now() })
            .eq('id', delivery.webhook_id)
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  })()

  return {
    ok:         fetchOk,
    status:     responseStatus,
    durationMs,
    message:    fetchOk
      ? `Reenviado com sucesso — ${responseStatus} em ${durationMs} ms`
      : `Falha no reenvio — ${responseStatus ?? 'sem resposta'}`,
  }
}
