import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import * as Sentry from '@sentry/nextjs'

// Cabeçalhos CORS — o endpoint é chamado por páginas externas de checkout
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Preflight CORS para requisições de outras origens (checkout pages externas)
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

const trackSchema = z.object({
  bot_id:       z.string().uuid('bot_id inválido.'),
  event_type:   z.enum(['visited', 'cart_added', 'payment_initiated']),
  product_name: z.string().max(200).optional(),
  flow_id:      z.string().uuid().optional(),
  utm_source:   z.string().max(100).optional(),
  utm_medium:   z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
})

// POST /api/checkout/track
// Endpoint público (sem autenticação) para páginas de checkout registrarem
// eventos no funil de conversão (especialmente 'visited').
// Usa RPC track_checkout_event (security definer) para bypassar RLS.
//
// Uso a partir de uma página de checkout:
//   fetch('/api/checkout/track', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       bot_id: '<uuid do bot>',
//       event_type: 'visited',
//       product_name: 'Meu Produto',
//       utm_source: 'instagram',
//       utm_campaign: 'lancamento-junho',
//     }),
//   })
export async function POST(request: NextRequest) {
  // Rate limit por IP: 60 req/min — suficiente para tráfego legítimo de checkout
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`checkout_track:${ip}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas requisições.' },
      { status: 429, headers: { ...CORS, 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400, headers: CORS })
  }

  const parsed = trackSchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return NextResponse.json({ error: message }, { status: 400, headers: CORS })
  }

  const { bot_id, event_type, product_name, flow_id, utm_source, utm_medium, utm_campaign } = parsed.data

  const supabase = await createClient()

  // Delega ao RPC com security definer — resolve user_id via bot_id e insere
  const { error } = await supabase.rpc('track_checkout_event', {
    p_bot_id:       bot_id,
    p_event_type:   event_type,
    p_product_name: product_name ?? '',
    p_flow_id:      flow_id ?? null,
    p_utm_source:   utm_source ?? null,
    p_utm_medium:   utm_medium ?? null,
    p_utm_campaign: utm_campaign ?? null,
  })

  if (error) {
    Sentry.captureException(error, { extra: { bot_id, event_type, context: 'checkout_track' } })
  }

  // Sempre retorna 200 — não vaza se o bot existe ou não
  return NextResponse.json({ ok: true }, { headers: CORS })
}
