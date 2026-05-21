import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

// GET /api/payments/mercadopago-oauth?bank_account_id=xxx
// Inicia o fluxo OAuth do Mercado Pago — redireciona para a tela de autorização do MP
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const dashboardUrl = `${process.env.APP_URL}/dashboard/gateways`

  if (!user) {
    return NextResponse.redirect(`${process.env.APP_URL}/login`)
  }

  const { searchParams } = new URL(request.url)
  const bankAccountId = searchParams.get('bank_account_id') ?? ''

  if (!bankAccountId) {
    return NextResponse.redirect(`${dashboardUrl}?mp_error=missing_bank_account`)
  }

  // Valida que a conta bancária pertence ao usuário (IDOR-safe)
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', bankAccountId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!account) {
    return NextResponse.redirect(`${dashboardUrl}?mp_error=invalid_bank_account`)
  }

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${dashboardUrl}?mp_error=oauth_not_configured`)
  }

  // State aleatório para proteção CSRF
  const state = randomBytes(20).toString('hex')
  const redirectUri = `${process.env.APP_URL}/api/payments/mercadopago-oauth/callback`

  const cookieStore = await cookies()
  const isProd = process.env.NODE_ENV === 'production'

  cookieStore.set('mp_oauth_state', state, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 600, // 10 minutos
    path: '/',
  })
  cookieStore.set('mp_oauth_bank', bankAccountId, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const authUrl = new URL('https://auth.mercadopago.com/authorization')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('platform_id', 'mp')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(authUrl.toString())
}
