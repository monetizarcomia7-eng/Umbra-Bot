import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

// GET /api/cron/cleanup-activity
// Chamado pelo Vercel Cron diariamente às 02:00 UTC (ver vercel.json).
// Deleta eventos de atividade com mais de 90 dias para controlar o crescimento da tabela.
// Seguro repetir: idempotente por data de corte.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = new Date().toISOString()

  const { data: logRow } = await supabase
    .from('cron_log')
    .insert({ job: 'cleanup-activity', started_at: startedAt, status: 'running' })
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
          finished_at: new Date().toISOString(),
          error_message: errorMessage ?? null,
        })
        .eq('id', logId)
    }
  }

  // Corte: deleta eventos com mais de 90 dias
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Conta antes de deletar para registrar no log
  const { count: totalBefore } = await supabase
    .from('activity_events')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoff)

  if (!totalBefore) {
    await finalize('success', 0)
    return NextResponse.json({ deleted: 0, message: 'Nenhum evento antigo encontrado.' })
  }

  // Deleta em lotes de 500 para não travar a tabela com um DELETE longo
  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    // Busca IDs do próximo lote
    const { data: batch, error: batchError } = await supabase
      .from('activity_events')
      .select('id')
      .lt('created_at', cutoff)
      .limit(500)

    if (batchError) {
      Sentry.captureException(batchError, { extra: { context: 'cron_cleanup_activity_fetch' } })
      await finalize('error', totalDeleted, batchError.message)
      return NextResponse.json({ error: 'Erro ao buscar eventos antigos.' }, { status: 500 })
    }

    if (!batch || batch.length === 0) {
      hasMore = false
      break
    }

    const ids = batch.map((r) => r.id)

    const { error: deleteError } = await supabase
      .from('activity_events')
      .delete()
      .in('id', ids)

    if (deleteError) {
      Sentry.captureException(deleteError, { extra: { context: 'cron_cleanup_activity_delete', ids } })
      await finalize('error', totalDeleted, deleteError.message)
      return NextResponse.json({ error: 'Erro ao deletar eventos.' }, { status: 500 })
    }

    totalDeleted += batch.length

    // Se retornou menos de 500, não há mais registros
    if (batch.length < 500) hasMore = false
  }

  await finalize('success', totalDeleted)
  return NextResponse.json({
    deleted: totalDeleted,
    cutoff,
    message: `${totalDeleted} evento(s) com mais de 90 dias removido(s).`,
  })
}
