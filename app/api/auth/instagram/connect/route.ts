import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/instagram/auth'
import { randomBytes } from 'crypto'

// GET /api/auth/instagram/connect
// Inicia o fluxo OAuth do Meta para vincular uma conta Instagram Business.
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.APP_URL!))
  }

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET || !process.env.META_REDIRECT_URI) {
    return NextResponse.redirect(
      new URL('/dashboard/instagram/accounts?error=config_missing', process.env.APP_URL!),
    )
  }

  // CSRF: state aleatório em cookie HTTP-only
  const state = randomBytes(16).toString('hex')

  const response = NextResponse.redirect(buildAuthUrl(state))
  response.cookies.set('ig_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   600, // 10 min
  })
  return response
}
