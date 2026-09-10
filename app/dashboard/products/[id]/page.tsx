import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductEditor from '../ProductEditor'
import type { RawCheckout, RawGateway, RawPixel, RawCoupon } from '@/app/dashboard/checkout/page'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [product, checkouts, partners, offers, gateways, pixels, coupons] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('checkouts').select('id, name, slug, product_name, product_desc, product_image, price, installments, gateway, pixel, primary_color, bg_variant, font, logo, badge, fields, methods, layout, status, visits, conversions, conversion, created_at, updated_at, success_url, guarantee_days, countdown_end, extra_components, bg_image, bg_fixed, bg_repeat, bg_cover, order_bump, logo_image, two_step, upsell, visitor_tracking').eq('user_id', user.id).eq('product_id', id).order('updated_at', { ascending: false }),
    supabase.from('product_partnerships').select('id,partner_email,role,commission_pct,status,expires_at').eq('product_id', id).eq('producer_id', user.id),
    supabase.from('product_offers').select('*').eq('product_id', id).eq('user_id', user.id).order('created_at'),
    supabase.from('gateways').select('id,provider,account').eq('user_id', user.id).eq('connected', true),
    supabase.from('pixels').select('id,provider,pixel_id,capi').eq('user_id', user.id),
    supabase.from('checkout_coupons').select('id,checkout_id,code,type,value,max_uses,uses,valid_until,active,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
  ])
  if (!product.data) notFound()
  return <ProductEditor userId={user.id} initial={product.data} partners={partners.data ?? []} initialOffers={offers.data ?? []} checkoutBuilder={{ checkouts: (checkouts.data ?? []) as RawCheckout[], gateways: (gateways.data ?? []) as RawGateway[], pixels: (pixels.data ?? []) as RawPixel[], coupons: (coupons.data ?? []) as RawCoupon[], appUrl: process.env.APP_URL ?? 'https://www.umbrabot.com.br' }} />
}
