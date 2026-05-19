import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

// GET /api/cron/process-withdrawals
// Chamado pelo Vercel Cron diariamente (ver vercel.json).
// Marca saques pendentes há mais de 1 dia útil como 'completed'.
// TODO: substituir o bloco de update pela chamada real à API de PIX payout
//       (ex: Mercado Pago Payouts ou PushinPay), salvar o payout_tx_id retornado
//       e verificar idempotência pelo payout_tx_id antes de reprocessar.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = new Date().toISOString()

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

  // Busca saques pendentes criados há mais de 24h que ainda não têm payout_tx_id
  // (evita reprocessar saques já enviados para a API externa)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: pending, error: fetchError } = await supabase
    .from('withdrawals')
    .select('id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .is('payout_tx_id', null)

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

  // TODO: para cada id, chamar a API real de transferência e salvar o payout_tx_id:
  // const payoutResult = await callPayoutApi(withdrawal)
  // await supabase.from('withdrawals').update({ payout_tx_id: payoutResult.id }).eq('id', id)

  const concludedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('withdrawals')
    .update({
      status:       'completed',
      concluded_at: concludedAt,
      processed_by: 'cron',
    })
    .in('id', ids)

  if (updateError) {
    Sentry.captureException(updateError, { extra: { ids, context: 'cron_process_withdrawals_update' } })
    await finalize('error', 0, updateError.message)
    return NextResponse.json({ error: 'Erro ao atualizar saques.' }, { status: 500 })
  }

  await finalize('success', ids.length)
  return NextResponse.json({ processed: ids.length })
}
