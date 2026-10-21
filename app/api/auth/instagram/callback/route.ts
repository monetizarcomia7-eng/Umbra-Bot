import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getFacebookPages,
  getInstagramBusinessAccount,
  MetaAuthError,
} from '@/lib/instagram/auth'
import { encryptToken } from '@/lib/crypto'

const APP_URL = process.env.APP_URL ?? 'https://www.umbrabot.com.br'

// O resultado do OAuth é exibido na aba Contas (AccountsClient lê ?success / ?error / ?code).
// Redireciona direto pra /accounts: /dashboard/instagram faz redirect() para /posts e perde a query string.
function redirectWith(query: string) {
  return NextResponse.redirect(new URL(`/dashboard/instagram/accounts?${query}`, APP_URL))
}

// GET /api/auth/instagram/callback?code=...&state=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', APP_URL))

  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const err   = searchParams.get('error')

  if (err) return redirectWith('error=cancelled')

  // Valida CSRF
  const storedState = request.cookies.get('ig_oauth_state')?.value
  if (!state || state !== storedState) return redirectWith('error=invalid_state')

  if (!code) return redirectWith('error=no_code')

  try {
    // 1. code → token curto
    const shortToken = await exchangeCodeForToken(code)

    // 2. token curto → token longo (60 dias)
    const { access_token: longToken, expires_in } = await getLongLivedToken(shortToken)
    const expiresAt = new Date(Date.now() + expires_in * 1_000)

    // 3. lista de páginas do FB
    const pages = await getFacebookPages(longToken)
    if (pages.length === 0) return redirectWith('error=no_pages')

    // 4. para cada página com conta IG vinculada, faz upsert
    let connected = 0
    const failures: Array<{ stage: 'meta' | 'db'; code: string }> = []

    for (const page of pages) {
      let igAccount: Awaited<ReturnType<typeof getInstagramBusinessAccount>>
      try {
        igAccount = await getInstagramBusinessAccount(page.id, page.access_token)
      } catch (e) {
        // Erro real da API do Meta (permissão, token…) é registrado; "página sem IG Business" só pula.
        if (e instanceof MetaAuthError) {
          console.error('[ig callback] Meta API error', {
            pageId: page.id, code: e.code, subcode: e.subcode, message: e.message,
          })
          failures.push({ stage: 'meta', code: String(e.code) })
        }
        continue
      }

      // O supabase-js NÃO lança exceção em erro de banco: devolve { error }.
      // Sem checar, a conta "conectava" (count=1) mas nunca era gravada.
      const { error: upsertError } = await supabase.from('instagram_accounts').upsert(
        {
          user_id:          user.id,
          ig_user_id:       igAccount.id,
          username:         igAccount.username ?? null,
          profile_picture:  igAccount.profile_picture_url ?? null,
          access_token:     encryptToken(longToken),
          token_expires_at: expiresAt.toISOString(),
          page_id:          page.id,
          page_token:       encryptToken(page.access_token),
          is_active:        true,
        },
        { onConflict: 'user_id,ig_user_id' },
      )

      if (upsertError) {
        console.error('[ig callback] upsert instagram_accounts failed', {
          code: upsertError.code, message: upsertError.message,
          details: upsertError.details, hint: upsertError.hint,
        })
        failures.push({ stage: 'db', code: upsertError.code || 'unknown' })
        continue
      }

      connected++
    }

    if (connected === 0) {
      const dbFail = failures.find(f => f.stage === 'db')
      if (dbFail) return redirectWith(`error=save_failed&code=${encodeURIComponent(dbFail.code)}`)
      const metaFail = failures.find(f => f.stage === 'meta')
      if (metaFail) return redirectWith(`error=meta_error&code=${encodeURIComponent(metaFail.code)}`)
      return redirectWith('error=no_ig_business')
    }

    // Sucesso — limpa cookie state
    const response = redirectWith(`success=connected&count=${connected}`)
    response.cookies.delete('ig_oauth_state')

    // activity_event (fire-and-forget)
    void supabase.from('activity_events').insert({
      user_id:     user.id,
      type:        'newBot',
      title:       'Instagram conectado',
      description: `${connected} conta(s) Instagram vinculada(s).`,
    }).then(({ error }) => {
      if (error) console.error('[ig callback] activity_event:', error.message)
    })

    return response
  } catch (e) {
    console.error('[ig callback] OAuth failed:', e)
    const metaCode = e instanceof MetaAuthError ? `&code=${encodeURIComponent(String(e.code))}` : ''
    return redirectWith(`error=oauth_failed${metaCode}`)
  }
}
