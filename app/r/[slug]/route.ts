import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface ClickResult {
  found: boolean
  affiliate_id?: string
  cookie_window?: number
  redirect_url?: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const appUrl = process.env.APP_URL ?? 'https://umbra.bot'

  const supabase = await createClient()

  const { data } = await supabase.rpc('track_affiliate_click', { p_slug: slug })
  const result = data as ClickResult | null

  if (!result?.found || !result.affiliate_id) {
    return NextResponse.redirect(appUrl)
  }

  const destination = result.redirect_url || appUrl
  const res = NextResponse.redirect(destination)

  // Cookie de atribuição: lido por /api/payments/pix para vincular a venda ao afiliado
  const maxAge = (result.cookie_window ?? 30) * 24 * 60 * 60 // dias → segundos
  res.cookies.set('umbra_aff', result.affiliate_id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
  })

  return res
}
