import { randomBytes, createHmac } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type WebhookEventType =
  | 'sale.approved'
  | 'sale.pending'
  | 'sale.refunded'
  | 'sale.chargeback'
  | 'lead.created'
  | 'lead.tagged'
  | 'lead.unsubscribed'
  | 'subscription.created'
  | 'subscription.canceled'
  | 'subscription.renewed'
  | 'bot.disconnected'
  | 'flow.completed'
  | 'test.ping'

interface RawWebhook {
  id:     string
  url:    string
  secret: string
  name:   string
}

/* ── Config ─────────────────────────────────────────────────────────────────── */

const MAX_ATTEMPTS    = 3
const RETRY_DELAYS_MS = [0, 1_000, 5_000] // delay before attempt 1, 2, 3

/* ── dispatchWebhookEvent ───────────────────────────────────────────────────── */
// Fire-and-forget — nunca lança exceção.

export function dispatchWebhookEvent(
  userId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): void {
  void _dispatchAsync(userId, eventType, data)
}

async function _dispatchAsync(
  userId:    string,
  eventType: WebhookEventType,
  data:      Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: webhooks, error } = await admin
      .from('webhooks')
      .select('id, url, secret, name')
      .eq('user_id', userId)
      .eq('active', true)
      .contains('events', [eventType])

    if (error || !webhooks || webhooks.length === 0) return

    await Promise.allSettled(
      (webhooks as RawWebhook[]).map((wh) => _sendWithRetry(admin, wh, userId, eventType, data)),
    )
  } catch (err) {
    Sentry.captureException(err, { extra: { userId, eventType, context: 'webhooks_dispatch_outer' } })
  }
}

async function _sendWithRetry(
  admin:     ReturnType<typeof createAdminClient>,
  webhook:   RawWebhook,
  userId:    string,
  eventType: WebhookEventType,
  data:      Record<string, unknown>,
): Promise<void> {
  const deliveryId  = randomBytes(8).toString('hex')
  const plainSecret = decryptToken(webhook.secret)

  const payloadObj = {
    id:      deliveryId,
    event:   eventType,
    created: Date.now(),
    data,
  }
  const payloadStr = JSON.stringify(payloadObj)

  let lastSuccess = false

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await new Promise<void>((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]))
    }

    const signature = 'sha256=' + createHmac('sha256', plainSecret).update(payloadStr).digest('hex')
    const start = Date.now()
    let responseStatus: number | null = null
    let responseBody = ''
    let success = false

    try {
      const res = await fetch(webhook.url, {
        method:  'POST',
        headers: {
          'Content-Type':           'application/json',
          'X-Umbra-Signature-256':  signature,
          'X-Umbra-Event':          eventType,
          'X-Umbra-Delivery':       deliveryId,
          'X-Umbra-Timestamp':      String(Date.now()),
          'X-Umbra-Retry':          String(attempt - 1), // 0 = primeira tentativa
          'User-Agent':             'Umbra-Bot-Webhook/1.0',
        },
        body:    payloadStr,
        signal:  AbortSignal.timeout(8_000),
      })
      responseStatus = res.status
      responseBody   = await res.text().catch(() => '')
      success        = res.ok
    } catch (err) {
      responseBody = err instanceof Error ? err.message : 'Erro de conexão'
    }

    const durationMs = Date.now() - start

    try {
      await admin.from('webhook_deliveries').insert({
        webhook_id:      webhook.id,
        user_id:         userId,
        event_type:      eventType,
        payload:         payloadObj,
        response_status: responseStatus,
        response_body:   responseBody.slice(0, 2_000),
        duration_ms:     durationMs,
        success,
        attempt,
      })
    } catch (err) {
      Sentry.captureException(err, { extra: { webhookId: webhook.id, eventType, context: 'webhooks_insert_delivery' } })
    }

    lastSuccess = success
    if (success) break
  }

  // Atualiza stats
  try { await admin.rpc('sync_webhook_stats', { p_webhook_id: webhook.id }) } catch { /* ignore */ }

  if (lastSuccess) {
    try {
      await admin.from('webhooks').update({ last_delivery: Date.now() }).eq('id', webhook.id)
    } catch { /* ignore */ }
    // Auto-resolve alerta de falha se existir
    void _resolveFailureAlert(admin, webhook.id, userId)
  } else {
    // Cria alerta se ainda não existe
    void _createFailureAlert(admin, webhook, userId, eventType)
  }
}

/* ── Alert helpers ──────────────────────────────────────────────────────────── */

async function _createFailureAlert(
  admin:     ReturnType<typeof createAdminClient>,
  webhook:   RawWebhook,
  userId:    string,
  eventType: string,
): Promise<void> {
  try {
    const { data: existing } = await admin
      .from('alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'webhookFailed')
      .eq('resolved', false)
      .filter('context->>webhook_id', 'eq', webhook.id)
      .maybeSingle()

    if (existing) return

    await admin.from('alerts').insert({
      user_id:  userId,
      type:     'webhookFailed',
      severity: 'warning',
      title:    'Webhook com falhas repetidas',
      message:  `O endpoint "${webhook.name}" falhou em todas as ${MAX_ATTEMPTS} tentativas de entrega do evento "${eventType}". Verifique se o servidor está online e aceitando requisições.`,
      context:  { webhook_id: webhook.id, url: webhook.url },
      source:   'webhook',
    })
  } catch { /* ignore */ }
}

async function _resolveFailureAlert(
  admin:     ReturnType<typeof createAdminClient>,
  webhookId: string,
  userId:    string,
): Promise<void> {
  try {
    await admin
      .from('alerts')
      .update({
        resolved:    true,
        resolved_at: new Date().toISOString(),
        resolved_by: 'sistema (auto)',
      })
      .eq('user_id', userId)
      .eq('type', 'webhookFailed')
      .eq('resolved', false)
      .filter('context->>webhook_id', 'eq', webhookId)
  } catch { /* ignore */ }
}
