import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { rateLimit }          from '@/lib/rate-limit'

// GET /api/checkout/validate-coupon?checkout_id=...&code=...
// Valida o cupom sem incrementar o uso — apenas preview para o comprador.
// O incremento real acontece em /api/checkout/pay.

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl  = await rateLimit(`coupon_validate:${ip}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ valid: false, error: 'Muitas tentativas.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const checkout_id = searchParams.get('checkout_id')
  const code        = searchParams.get('code')?.trim().toUpperCase()

  if (!checkout_id || !code) {
    return NextResponse.json({ valid: false, error: 'Parâmetros ausentes.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Busca checkout para obter user_id e price
  const { data: checkout } = await admin
    .from('checkouts')
    .select('user_id, price')
    .eq('id', checkout_id)
    .eq('status', 'published')
    .maybeSingle()

  if (!checkout) {
    return NextResponse.json({ valid: false, error: 'Checkout não encontrado.' }, { status: 404 })
  }

  // Busca cupom sem incrementar
  const { data: coupon } = await admin
    .from('checkout_coupons')
    .select('id, type, value, max_uses, uses, valid_until, active')
    .eq('user_id', checkout.user_id)
    .ilike('code', code)
    .eq('active', true)
    .maybeSingle()

  if (!coupon) {
    return NextResponse.json({ valid: false, error: 'Cupom inválido ou expirado.' })
  }

  // Verifica expiração
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Cupom expirado.' })
  }

  // Verifica limite de uso
  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses) {
    return NextResponse.json({ valid: false, error: 'Cupom atingiu o limite de usos.' })
  }

  const price    = Number(checkout.price)
  const discount = coupon.type === 'percent'
    ? Math.round(price * (coupon.value / 100) * 100) / 100
    : Math.min(coupon.value, price)
  const final    = Math.max(0, price - discount)

  return NextResponse.json({
    valid:     true,
    coupon_id: coupon.id,
    type:      coupon.type,
    value:     coupon.value,
    discount,
    final,
  })
}
