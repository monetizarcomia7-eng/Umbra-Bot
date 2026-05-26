import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshLongLivedToken } from '@/lib/instagram/tokens'
import * as Sentry from '@sentry/nextjs'

// GET /api/cron/refresh-instagram-tokens
// Renova tokens com expiração nos próximos 30 dias.
// Chamado por cron-job.org 1x a cada 12h.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const t0 = Date.now()

  const cutoff = new Date(Date.now() + 30 * 86_400_000).toISOString()

  const { data: accounts, error } = await supabase
    .from('instagram_accounts')
    .select('id, access_token, user_id, username')
    .eq('is_active', true)
    .lte('token_expires_at', cutoff)

  if (error) {
    Sentry.captureException(new Error(error.message), {
      extra: { context: 'refresh_instagram_tokens_fetch' },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!accounts || accounts.length === 0) {
    Sentry.captureCheckIn({ monitorSlug: 'refresh-instagram-tokens', status: 'ok' })
    return NextResponse.json({ refreshed: 0, failed: 0, duration_ms: Date.now() - t0 })
  }

  let refreshed = 0
  let failed    = 0

  for (const acc of accounts) {
    try {
      const { encryptedToken, expiresAt } = await refreshLongLivedToken(acc.access_token as string)

      await supabase
        .from('instagram_accounts')
        .update({
          access_token:     encryptedToken,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', acc.id)

      refreshed++
    } catch (err) {
      // Token irrecuperável: desativa conta e cria alerta
      await supabase
        .from('instagram_accounts')
        .update({ is_active: false })
        .eq('id', acc.id)

      void supabase.from('alerts').insert({
        user_id:     acc.user_id,
        type:        'system',
        severity:    'critical',
        title:       'Instagram desconectado',
        description: `Falha ao renovar token de @${acc.username ?? 'conta'}. Reconecte em /dashboard/instagram.`,
        source:      'cron',
      }).then(() => {})

      Sentry.captureException(err, {
        extra: { accountId: acc.id, username: acc.username, context: 'refresh_token_per_account' },
      })
      failed++
    }
  }

  Sentry.captureCheckIn({ monitorSlug: 'refresh-instagram-tokens', status: 'ok' })

  return NextResponse.json({
    refreshed,
    failed,
    duration_ms: Date.now() - t0,
  })
}
