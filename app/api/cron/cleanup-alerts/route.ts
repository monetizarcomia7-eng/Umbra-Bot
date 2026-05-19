import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

// GET /api/cron/cleanup-alerts
// Chamado pelo Vercel Cron às 04:00 UTC (ver vercel.json).
// Deleta alertas resolvidos com mais de 30 dias para evitar crescimento irrestrito
// da tabela — especialmente de alertas do tipo 'sale' gerados a cada venda aprovada.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase  = await createClient()
  const startedAt = new Date().toISOString()

  const { data: logRow } = await supabase
    .from('cron_log')
    .insert({ job: 'cleanup-alerts', started_at: startedAt, status: 'running' })
    .select('id')
    .single()
  const logId = logRow?.id ?? null

  async function finalize(status: 'success' | 'error', processed: number, errorMessage?: string) {
    if (logId) {
      await supabase
        .from('cron_log')
        .update({
          status,
          processed,
          finished_at:   new Date().toISOString(),
          error_message: errorMessage ?? null,
        })
        .eq('id', logId)
    }
  }

  // Corte: deleta alertas resolvidos com mais de 30 dias
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { count: totalBefore } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('resolved', true)
    .lt('created_at', cutoff)

  if (!totalBefore) {
    await finalize('success', 0)
    return NextResponse.json({ deleted: 0, message: 'Nenhum alerta antigo encontrado.' })
  }

  let totalDeleted = 0
  let hasMore      = true

  while (hasMore) {
    const { data: batch, error: batchError } = await supabase
      .from('alerts')
      .select('id')
      .eq('resolved', true)
      .lt('created_at', cutoff)
      .limit(500)

    if (batchError) {
      Sentry.captureException(batchError, { extra: { context: 'cron_cleanup_alerts_fetch' } })
      await finalize('error', totalDeleted, batchError.message)
      return NextResponse.json({ error: 'Erro ao buscar alertas antigos.' }, { status: 500 })
    }

    if (!batch?.length) { hasMore = false; break }

    const ids = batch.map((r) => r.id)

    const { error: deleteError } = await supabase
      .from('alerts')
      .delete()
      .in('id', ids)

    if (deleteError) {
      Sentry.captureException(deleteError, { extra: { context: 'cron_cleanup_alerts_delete', ids } })
      await finalize('error', totalDeleted, deleteError.message)
      return NextResponse.json({ error: 'Erro ao deletar alertas.' }, { status: 500 })
    }

    totalDeleted += ids.length
    if (ids.length < 500) hasMore = false
  }

  await finalize('success', totalDeleted)
  return NextResponse.json({
    deleted: totalDeleted,
    cutoff,
    message: `${totalDeleted} alerta(s) resolvido(s) com mais de 30 dias removido(s).`,
  })
}
