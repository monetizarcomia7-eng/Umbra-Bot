import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient }              from '@/lib/supabase/admin'
import { rateLimit }                      from '@/lib/rate-limit'

/* ─── GET /api/checkout/status ───────────────────────────────
 * Endpoint público para polling de status de uma transação PIX.
 * Requer tx_id + checkout_id para evitar enumeração de IDs.
 * Retorna apenas { status } — sem dados sensíveis.
 * Rate limit: 30 req/min por IP.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`checkout_status:${ip}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um momento.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const { searchParams } = new URL(request.url)
  const txId       = searchParams.get('tx_id')
  const checkoutId = searchParams.get('checkout_id')

  if (!txId || !checkoutId) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes.' }, { status: 400 })
  }

  // UUID básico — evita injeção antes de chegar no DB
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(txId)) {
    return NextResponse.json({ status: 'pending' })
  }

  const admin = createAdminClient()

  const { data: tx } = await admin
    .from('transactions')
    .select('status')
    .eq('id', txId)
    .eq('checkout_id', checkoutId)
    .maybeSingle()

  // Se não encontrou (ainda não persistiu ou IDs errados), devolve pending
  // sem revelar se o ID existe ou não
  return NextResponse.json({ status: tx?.status ?? 'pending' })
}
