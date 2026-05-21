import { notFound }          from 'next/navigation'
import { createAdminClient }  from '@/lib/supabase/admin'
import CheckoutPageClient     from './CheckoutPageClient'
import type { PublicPixelConfig } from './PixelScripts'

/* ─── Tipos exportados para o CheckoutPageClient ─────────── */

export interface PublicCheckout {
  id:             string
  slug:           string
  name:           string
  product_name:   string
  product_desc:   string
  product_image:  string | null
  price:          number
  installments:   number
  gateway:        string
  primary_color:  string
  bg_variant:     'light' | 'dark'
  font:           string
  logo:           string
  badge:          string | null
  fields:         Record<string, boolean>
  methods:        Record<string, boolean>
  layout:         'two_col' | 'one_col'
  user_id:        string
  success_url:    string | null
  guarantee_days: number | null
  countdown_end:  string | null
}

/* ─── Server Component público ───────────────────────────── */

export default async function PublicCheckoutPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug }     = await params
  const sp           = await searchParams
  const utm_source   = typeof sp.utm_source   === 'string' ? sp.utm_source   : undefined
  const utm_medium   = typeof sp.utm_medium   === 'string' ? sp.utm_medium   : undefined
  const utm_campaign = typeof sp.utm_campaign === 'string' ? sp.utm_campaign : undefined

  // Admin client — sem sessão de comprador
  const admin = createAdminClient()

  const { data: checkout } = await admin
    .from('checkouts')
    .select(`
      id, slug, name, product_name, product_desc, product_image, price,
      installments, gateway, primary_color, bg_variant, font,
      logo, badge, fields, methods, layout, user_id,
      success_url, guarantee_days, countdown_end
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!checkout) notFound()

  // Busca pixels configurados pelo dono do checkout (pixel_id e pixel_code são públicos)
  // access_token NUNCA exposto — não está no select
  const { data: rawPixels } = await admin
    .from('pixels')
    .select('provider, pixel_id, pixel_code')
    .eq('user_id', checkout.user_id)
    .not('pixel_id', 'is', null)

  const pixels: PublicPixelConfig[] = (rawPixels ?? [])
    .filter((p) => p.pixel_id)
    .map((p) => ({
      provider:  p.provider as PublicPixelConfig['provider'],
      pixelId:   p.pixel_id!,
      pixelCode: p.pixel_code ?? null,
    }))

  const appUrl = process.env.APP_URL ?? 'https://umbra.bot'

  return (
    <CheckoutPageClient
      checkout={checkout as PublicCheckout}
      pixels={pixels}
      utmSource={utm_source}
      utmMedium={utm_medium}
      utmCampaign={utm_campaign}
      appUrl={appUrl}
    />
  )
}
