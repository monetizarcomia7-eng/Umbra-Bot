import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as Sentry from '@sentry/nextjs'

// GET /api/cron/recompute-flow-conversion
// Atualiza conversion% para todos os fluxos com executions > 0.
// Chamado pelo cron-job.org 1x/dia (ou Vercel Cron).
// Auth: header Authorization: Bearer ${CRON_SECRET}
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const t0 = Date.now()

  try {
    const { data, error } = await supabase.rpc('recompute_all_flow_conversions')

    if (error) {
      Sentry.captureException(new Error(error.message), {
        extra: { context: 'recompute_flow_conversion' },
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const updated = Number(data ?? 0)
    const elapsedMs = Date.now() - t0

    // cron_log fire-and-forget (tabela opcional)
    supabase.from('cron_log').insert({
      job: 'recompute-flow-conversion',
      updated_count: updated,
      duration_ms: elapsedMs,
    }).then(({ error: err }) => {
      // Silencioso se tabela cron_log não existe (42P01)
      if (err && err.code !== '42P01') {
        console.error('[cron] cron_log insert:', err.message)
      }
    })

    Sentry.captureCheckIn({
      monitorSlug: 'recompute-flow-conversion',
      status: 'ok',
    })

    return NextResponse.json({
      ok: true,
      updated,
      duration_ms: elapsedMs,
      message: `${updated} fluxos atualizados em ${elapsedMs}ms.`,
    })
  } catch (err) {
    Sentry.captureException(err, {
      extra: { context: 'recompute_flow_conversion_handler' },
    })
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erro desconhecido.',
    }, { status: 500 })
  }
}
