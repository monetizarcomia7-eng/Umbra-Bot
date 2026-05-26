import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as Sentry from '@sentry/nextjs'

// GET /api/cron/cleanup-instagram-logs
// Apaga logs com +30 dias. Cron-job.org 1x/dia (07:00).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const t0 = Date.now()

  const { data, error } = await supabase.rpc('cleanup_instagram_logs', { p_days: 30 })
  if (error) {
    Sentry.captureException(new Error(error.message), {
      extra: { context: 'cleanup_instagram_logs' },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const deleted = Number(data ?? 0)
  Sentry.captureCheckIn({ monitorSlug: 'cleanup-instagram-logs', status: 'ok' })

  return NextResponse.json({ ok: true, deleted, duration_ms: Date.now() - t0 })
}
