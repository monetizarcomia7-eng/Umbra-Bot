import { notFound }        from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import CheckoutPageClient   from './CheckoutPageClient'

/* ─── Tipos exportados para o CheckoutPageClient ─────────── */

export interface PublicCheckout {
  id:            string
  slug:          string
  name:          string
  product_name:  string
  product_desc:  string
  price:         number
  installments:  number
  gateway:       string
  primary_color: string
  bg_variant:    'light' | 'dark'
  font:          string
  logo:          string
  badge:         string | null
  fields:        Record<string, boolean>
  methods:       Record<string, boolean>
  layout:        'two_col' | 'one_col'
}

/* ─── Server Component público ───────────────────────────── */

export default async function PublicCheckoutPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug }                 = await params
  const sp                       = await searchParams
  const utm_source               = typeof sp.utm_source   === 'string' ? sp.utm_source   : undefined
  const utm_medium               = typeof sp.utm_medium   === 'string' ? sp.utm_medium   : undefined
  const utm_campaign             = typeof sp.utm_campaign === 'string' ? sp.utm_campaign : undefined

  // Admin client — sem sessão de comprador
  const admin = createAdminClient()

  const { data: checkout } = await admin
    .from('checkouts')
    .select(`
      id, slug, name, product_name, product_desc, price,
      installments, gateway, primary_color, bg_variant, font,
      logo, badge, fields, methods, layout
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!checkout) notFound()

  const appUrl = process.env.APP_URL ?? 'https://umbra.bot'

  return (
    <CheckoutPageClient
      checkout={checkout as PublicCheckout}
      utmSource={utm_source}
      utmMedium={utm_medium}
      utmCampaign={utm_campaign}
      appUrl={appUrl}
    />
  )
}
