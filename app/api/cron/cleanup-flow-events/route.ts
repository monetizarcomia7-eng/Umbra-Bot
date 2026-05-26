import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as Sentry from '@sentry/nextjs'

// GET /api/cron/cleanup-flow-events
// Apaga eventos de telemetria de fluxos com > 30 dias.
// Chamado pelo cron-job.org 1x/dia (06:00).
// Auth: Authorization: Bearer ${CRON_SECRET}
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const t0 = Date.now()

  try {
    const { data, error } = await supabase.rpc('cleanup_flow_node_events', { p_days: 30 })

    if (error) {
      Sentry.captureException(new Error(error.message), {
        extra: { context: 'cleanup_flow_node_events' },
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const deleted = Number(data ?? 0)
    const elapsedMs = Date.now() - t0

    supabase.from('cron_log').insert({
      job: 'cleanup-flow-events',
      updated_count: deleted,
      duration_ms: elapsedMs,
    }).then(({ error: err }) => {
      if (err && err.code !== '42P01') {
        console.error('[cron] cron_log insert:', err.message)
      }
    })

    Sentry.captureCheckIn({
      monitorSlug: 'cleanup-flow-events',
      status: 'ok',
    })

    return NextResponse.json({
      ok: true,
      deleted,
      duration_ms: elapsedMs,
      message: `${deleted} eventos antigos removidos em ${elapsedMs}ms.`,
    })
  } catch (err) {
    Sentry.captureException(err, {
      extra: { context: 'cleanup_flow_node_events_handler' },
    })
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erro desconhecido.',
    }, { status: 500 })
  }
}
