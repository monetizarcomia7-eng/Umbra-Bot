import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { encryptToken } from '@/lib/crypto'

// GET /api/payments/mercadopago-oauth/callback?code=xxx&state=xxx
// Callback do OAuth — troca o code pelo access_token e salva no banco
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const dashboardUrl = `${process.env.APP_URL}/dashboard/gateways`

  if (error || !code) {
    return NextResponse.redirect(
      `${dashboardUrl}?mp_error=${encodeURIComponent(error ?? 'authorization_denied')}`,
    )
  }

  const cookieStore = await cookies()
  const savedState    = cookieStore.get('mp_oauth_state')?.value
  const bankAccountId = cookieStore.get('mp_oauth_bank')?.value

  // CSRF: verifica que o state bate
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${dashboardUrl}?mp_error=invalid_state`)
  }

  // Limpa cookies de sessão OAuth
  cookieStore.delete('mp_oauth_state')
  cookieStore.delete('mp_oauth_bank')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${process.env.APP_URL}/login`)
  }

  // Troca o code pelo access_token
  const redirectUri = `${process.env.APP_URL}/api/payments/mercadopago-oauth/callback`
  let tokenRes: Response
  try {
    tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     process.env.MERCADOPAGO_CLIENT_ID!,
        client_secret: process.env.MERCADOPAGO_CLIENT_SECRET!,
        code,
        redirect_uri:  redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return NextResponse.redirect(`${dashboardUrl}?mp_error=token_timeout`)
  }

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${dashboardUrl}?mp_error=token_exchange_failed`)
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    user_id?: number
  }
  const accessToken = tokenData.access_token

  // Busca info da conta MP para exibir na UI
  let accountInfo = 'Conta Mercado Pago'
  try {
    const meRes = await fetch('https://api.mercadopago.com/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(6_000),
    })
    if (meRes.ok) {
      const me = (await meRes.json()) as { email?: string; nickname?: string }
      accountInfo = me.email ?? me.nickname ?? accountInfo
    }
  } catch { /* não crítico */ }

  // Resolve o label da conta bancária
  let accountLabel = ''
  if (bankAccountId) {
    const { data: ba } = await supabase
      .from('bank_accounts')
      .select('label')
      .eq('id', bankAccountId)
      .eq('user_id', user.id)
      .maybeSingle()
    accountLabel = ba?.label ?? ''
  }

  // Salva o token criptografado no banco
  // token_expires_at = 180 dias a partir de agora (limite do MP OAuth)
  const encryptedToken  = encryptToken(accessToken)
  const tokenIssuedAt   = new Date()
  const tokenExpiresAt  = new Date(tokenIssuedAt.getTime() + 180 * 24 * 60 * 60 * 1000)

  const { error: dbErr } = await supabase
    .from('gateways')
    .upsert(
      {
        user_id:          user.id,
        provider:         'mercadopago',
        name:             'Mercado Pago',
        connected:        true,
        status:           'active',
        account:          accountLabel || accountInfo,
        account_id:       bankAccountId || null,
        credentials:      { token: encryptedToken, account_info: accountInfo, oauth: true },
        token_expires_at: tokenExpiresAt.toISOString(),
        updated_at:       tokenIssuedAt.toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )

  if (dbErr) {
    return NextResponse.redirect(`${dashboardUrl}?mp_error=db_save_failed`)
  }

  // activity_event — fire-and-forget
  supabase.from('activity_events').insert({
    user_id:     user.id,
    type:        'newBot',
    title:       'Mercado Pago conectado via OAuth',
    description: `Conta ${accountInfo} autorizada com sucesso.`,
  }).then(() => {})

  return NextResponse.redirect(`${dashboardUrl}?mp_connected=1`)
}
