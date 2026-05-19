import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

// GET /api/cron/process-withdrawals
// Chamado pelo Vercel Cron diariamente (ver vercel.json).
// Marca como 'completed' saques que estejam pendentes há mais de 1 dia útil.
// Em produção real, substituir pela chamada à API de transferência bancária/PIX.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = new Date().toISOString()

  // Registra início da execução no cron_log
  const { data: logRow } = await supabase
    .from('cron_log')
    .insert({ job: 'process-withdrawals', started_at: startedAt, status: 'running' })
    .select('id')
    .single()
  const logId = logRow?.id ?? null

  async function finalize(status: 'success' | 'error', processed: number, errorMessage?: string) {
    if (logId) {
      await supabase
        .from('cron_log')
        .update({ status, processed, finished_at: new Date().toISOString(), error_message: errorMessage ?? null })
        .eq('id', logId)
    }
  }

  // Busca saques pendentes criados há mais de 24 horas
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: pending, error: fetchError } = await supabase
    .from('withdrawals')
    .select('id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  if (fetchError) {
    Sentry.captureException(fetchError, { extra: { context: 'cron_process_withdrawals_fetch' } })
    await finalize('error', 0, fetchError.message)
    return NextResponse.json({ error: 'Erro ao buscar saques.' }, { status: 500 })
  }

  if (!pending || pending.length === 0) {
    await finalize('success', 0)
    return NextResponse.json({ processed: 0 })
  }

  const ids = pending.map((w) => w.id)

  // TODO: aqui viria a chamada real à API de transferência (PIX payout, TED, etc.)
  // Por ora marca como 'completed' automaticamente após 24h.

  const { error: updateError } = await supabase
    .from('withdrawals')
    .update({ status: 'completed', concluded_at: new Date().toISOString() })
    .in('id', ids)

  if (updateError) {
    Sentry.captureException(updateError, { extra: { ids, context: 'cron_process_withdrawals_update' } })
    await finalize('error', 0, updateError.message)
    return NextResponse.json({ error: 'Erro ao atualizar saques.' }, { status: 500 })
  }

  await finalize('success', ids.length)
  return NextResponse.json({ processed: ids.length })
}
