import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import CheckoutClient   from './CheckoutClient'

/* ─── Tipos exportados para o CheckoutClient ─────────────── */

export interface RawCheckout {
  id:            string
  name:          string
  slug:          string
  product_name:  string
  product_desc:  string
  price:         number
  installments:  number
  gateway:       string
  pixel:         string
  primary_color: string
  bg_variant:    'light' | 'dark'
  font:          string
  logo:          string
  badge:         string | null
  fields:        Record<string, boolean>
  methods:       Record<string, boolean>
  layout:        'two_col' | 'one_col'
  status:        'published' | 'draft' | 'archived'
  visits:        number
  conversions:   number
  conversion:    number
  created_at:    string
  updated_at:    string
}

export interface RawGateway {
  id:       string
  provider: string
  account:  string | null
}

export interface RawPixel {
  id:       string
  provider: string
  pixel_id: string | null
  capi:     boolean
}

/* ─── Server Component ───────────────────────────────────── */

export default async function CheckoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: checkouts },
    { data: gateways  },
    { data: pixels    },
  ] = await Promise.all([
    supabase
      .from('checkouts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('gateways')
      .select('id, provider, account')
      .eq('user_id', user.id)
      .eq('connected', true),
    supabase
      .from('pixels')
      .select('id, provider, pixel_id, capi')
      .eq('user_id', user.id),
  ])

  const appUrl = process.env.APP_URL ?? 'https://umbra.bot'

  return (
    <CheckoutClient
      initialCheckouts={(checkouts ?? []) as RawCheckout[]}
      userId={user.id}
      connectedGateways={(gateways ?? []) as RawGateway[]}
      configuredPixels={(pixels ?? []) as RawPixel[]}
      appUrl={appUrl}
    />
  )
}
