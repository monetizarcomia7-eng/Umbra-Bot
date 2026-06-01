import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHmac, timingSafeEqual } from 'crypto'
import * as Sentry from '@sentry/nextjs'

/**
 * Instagram Webhook — recebe eventos da Meta em tempo real
 * (comentários, menções, DMs, story_insights, etc.)
 *
 * Configuração na Meta for Developers:
 *   URL de callback: https://www.umbrabot.com.br/api/webhooks/instagram
 *   Verify Token:    valor de INSTAGRAM_WEBHOOK_VERIFY_TOKEN no .env
 *
 * Fluxo:
 *   1. Meta envia GET com hub.mode=subscribe + hub.verify_token + hub.challenge
 *      → respondemos com o challenge se o token bater
 *   2. Meta envia POST com payload de eventos
 *      → validamos assinatura HMAC (X-Hub-Signature-256)
 *      → persistimos em instagram_webhook_events
 */

// GET — handshake de verificação (Meta valida a URL antes de habilitar)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN

  if (!expected) {
    console.error('[ig-webhook] INSTAGRAM_WEBHOOK_VERIFY_TOKEN não configurado')
    return new NextResponse('Server not configured', { status: 500 })
  }

  if (mode === 'subscribe' && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// POST — recebe eventos
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    return new NextResponse('Server not configured', { status: 500 })
  }

  const signature = request.headers.get('x-hub-signature-256')
  const body      = await request.text()

  // Validação HMAC obrigatória — protege contra POSTs forjados
  if (!signature || !validateSignature(body, signature, appSecret)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let parsed: WebhookPayload
  try {
    parsed = JSON.parse(body) as WebhookPayload
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const supabase = createAdminClient()
  const rows: Array<{
    object:   string
    entry_id: string | null
    field:    string | null
    payload:  Record<string, unknown>
  }> = []

  // Cada entry pode ter vários changes (eventos)
  for (const entry of parsed.entry ?? []) {
    const changes = entry.changes ?? []
    if (changes.length === 0) {
      // Entry sem changes (ex: messaging events em DMs) — persiste como bloco único
      rows.push({
        object:   parsed.object,
        entry_id: String(entry.id ?? ''),
        field:    null,
        payload:  entry as unknown as Record<string, unknown>,
      })
      continue
    }

    for (const change of changes) {
      rows.push({
        object:   parsed.object,
        entry_id: String(entry.id ?? ''),
        field:    change.field ?? null,
        payload:  change.value as Record<string, unknown>,
      })
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('instagram_webhook_events').insert(rows)
    if (error) {
      Sentry.captureException(new Error(error.message), {
        extra: { context: 'instagram_webhook_insert', rowCount: rows.length },
      })
      // Mesmo com erro, retornamos 200 — Meta reenvia se não receber 2xx
      // mas isso pode causar duplicação. Logamos pra investigar depois.
      console.error('[ig-webhook] insert error:', error.message)
    }
  }

  // Meta exige 200 OK — qualquer outro código faz retry agressivo
  return new NextResponse('OK', { status: 200 })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function validateSignature(rawBody: string, signature: string, secret: string): boolean {
  // Formato do header: "sha256=hexdigest"
  if (!signature.startsWith('sha256=')) return false
  const provided = signature.slice('sha256='.length)

  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(provided, 'hex'),
      Buffer.from(computed, 'hex'),
    )
  } catch {
    return false
  }
}

// ─── Tipos do payload ─────────────────────────────────────────────────────

interface WebhookChange {
  field: string
  value: unknown
}

interface WebhookEntry {
  id:       string | number
  time?:    number
  changes?: WebhookChange[]
}

interface WebhookPayload {
  object: string
  entry:  WebhookEntry[]
}
