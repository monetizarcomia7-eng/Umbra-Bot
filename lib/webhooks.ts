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
}

/* ── dispatchWebhookEvent ───────────────────────────────────────────────────── */
// Fire-and-forget — nunca lança exceção.
// Chamado nos route handlers de eventos (MP webhook, Telegram webhook, etc.)
// após registrar a transação/lead no banco.

export function dispatchWebhookEvent(
  userId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): void {
  // Executa de forma assíncrona sem bloquear o route handler
  void _dispatchAsync(userId, eventType, data)
}

async function _dispatchAsync(
  userId:    string,
  eventType: WebhookEventType,
  data:      Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient()

    // Busca webhooks ativos que assinam este evento
    const { data: webhooks, error } = await admin
      .from('webhooks')
      .select('id, url, secret')
      .eq('user_id', userId)
      .eq('active', true)
      .contains('events', [eventType])

    if (error || !webhooks || webhooks.length === 0) return

    await Promise.allSettled(
      (webhooks as RawWebhook[]).map((wh) => _sendOne(admin, wh, userId, eventType, data)),
    )
  } catch (err) {
    Sentry.captureException(err, { extra: { userId, eventType, context: 'webhooks_dispatch_outer' } })
  }
}

async function _sendOne(
  admin:     ReturnType<typeof createAdminClient>,
  webhook:   RawWebhook,
  userId:    string,
  eventType: WebhookEventType,
  data:      Record<string, unknown>,
): Promise<void> {
  const deliveryId = randomBytes(8).toString('hex')
  const plainSecret = decryptToken(webhook.secret)

  const payloadObj = {
    id:      deliveryId,
    event:   eventType,
    created: Date.now(),
    data,
  }
  const payloadStr = JSON.stringify(payloadObj)
  const signature  = 'sha256=' + createHmac('sha256', plainSecret).update(payloadStr).digest('hex')

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
        'User-Agent':             'Umbra-Bot-Webhook/1.0',
      },
      body:    payloadStr,
      signal:  AbortSignal.timeout(8000),
    })
    responseStatus = res.status
    responseBody   = await res.text().catch(() => '')
    success        = res.ok
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'Erro de conexão'
  }

  const durationMs = Date.now() - start

  // Persiste a entrega
  await admin.from('webhook_deliveries').insert({
    webhook_id:      webhook.id,
    user_id:         userId,
    event_type:      eventType,
    payload:         payloadObj,
    response_status: responseStatus,
    response_body:   responseBody.slice(0, 2000),
    duration_ms:     durationMs,
    success,
    attempt:         1,
  }).catch((err) => {
    Sentry.captureException(err, { extra: { webhookId: webhook.id, eventType, context: 'webhooks_insert_delivery' } })
  })

  // Atualiza stats e last_delivery
  await admin.rpc('sync_webhook_stats', { p_webhook_id: webhook.id }).catch(() => {})
  if (success) {
    await admin
      .from('webhooks')
      .update({ last_delivery: Date.now() })
      .eq('id', webhook.id)
      .catch(() => {})
  }
}
