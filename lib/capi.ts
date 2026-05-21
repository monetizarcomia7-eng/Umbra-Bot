import crypto from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'

export interface CapiPurchaseData {
  txId:           string
  userId:         string
  amount:         number
  currency?:      string
  productName?:   string | null
  customerEmail?: string | null
  customerName?:  string | null
}

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

async function fireMetaCapi(
  pixelId: string,
  accessToken: string,
  data: CapiPurchaseData,
): Promise<void> {
  const eventTime = Math.floor(Date.now() / 1000)
  const userData: Record<string, string> = {
    client_ip_address: '0.0.0.0',
    client_user_agent: 'umbra-bot/1.0',
  }
  if (data.customerEmail) userData.em = sha256hex(data.customerEmail)
  if (data.customerName) {
    const parts = data.customerName.trim().split(/\s+/)
    userData.fn = sha256hex(parts[0])
    if (parts.length > 1) userData.ln = sha256hex(parts.slice(1).join(' '))
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name:    'Purchase',
          event_time:    eventTime,
          event_id:      data.txId,   // deduplication key
          action_source: 'website',
          user_data:     userData,
          custom_data: {
            currency: data.currency ?? 'BRL',
            value:    Number(data.amount.toFixed(2)),
            content_name: data.productName ?? undefined,
          },
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  )
  const json = await res.json() as { error?: { message: string } }
  if (json.error) throw new Error(`Meta CAPI: ${json.error.message}`)
}

async function fireTikTokEvents(
  pixelCode: string,
  accessToken: string,
  data: CapiPurchaseData,
): Promise<void> {
  const userDataRaw: Record<string, string> = {}
  if (data.customerEmail) userDataRaw.sha256_email = sha256hex(data.customerEmail)

  const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/pixel/track/', {
    method: 'POST',
    headers: {
      'Access-Token':  accessToken,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      pixel_code: pixelCode,
      event:      'CompletePayment',
      event_id:   data.txId,
      timestamp:  new Date().toISOString(),
      context: {
        user_agent: 'umbra-bot/1.0',
        ip:         '0.0.0.0',
        user:       Object.keys(userDataRaw).length > 0 ? userDataRaw : undefined,
      },
      properties: {
        currency:     data.currency ?? 'BRL',
        value:        String(Number(data.amount.toFixed(2))),
        content_name: data.productName ?? undefined,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const json = await res.json() as { code?: number; message?: string }
  if (json.code !== 0) throw new Error(`TikTok Events API: ${json.message ?? 'unknown error'}`)
}

async function fireGoogleMp(
  measurementId: string,
  apiSecret: string,
  data: CapiPurchaseData,
): Promise<void> {
  const res = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: data.txId,
        events: [{
          name: 'purchase',
          params: {
            currency:       data.currency ?? 'BRL',
            value:          Number(data.amount.toFixed(2)),
            transaction_id: data.txId,
            items: data.productName
              ? [{ item_name: data.productName, price: Number(data.amount.toFixed(2)), quantity: 1 }]
              : [],
          },
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  )
  // GA4 /mp/collect returns 204 on success, no body to validate
  if (!res.ok) throw new Error(`Google MP: HTTP ${res.status}`)
}

/**
 * Fires a Purchase conversion event to all pixels configured with CAPI enabled
 * for the given user. Called fire-and-forget from the MP webhook after a payment
 * is approved. Each provider error is captured in Sentry independently.
 */
export async function fireCapiPurchase(data: CapiPurchaseData): Promise<void> {
  const supabase = createAdminClient()

  const { data: pixels } = await supabase
    .from('pixels')
    .select('id, provider, pixel_id, pixel_code, access_token')
    .eq('user_id', data.userId)
    .eq('capi', true)
    .not('access_token', 'is', null)
    .not('pixel_id', 'is', null)

  if (!pixels || pixels.length === 0) return

  await Promise.allSettled(pixels.map(async (pixel) => {
    const plainToken = decryptToken(pixel.access_token as string)
    try {
      switch (pixel.provider) {
        case 'meta':
          await fireMetaCapi(pixel.pixel_id as string, plainToken, data)
          break
        case 'tiktok':
          await fireTikTokEvents(
            (pixel.pixel_code ?? pixel.pixel_id) as string,
            plainToken,
            data,
          )
          break
        case 'google':
          await fireGoogleMp(pixel.pixel_id as string, plainToken, data)
          break
      }
    } catch (err) {
      Sentry.captureException(err, {
        extra: {
          userId:   data.userId,
          provider: pixel.provider,
          txId:     data.txId,
          context:  'capi_purchase',
        },
      })
    }
  }))
}
