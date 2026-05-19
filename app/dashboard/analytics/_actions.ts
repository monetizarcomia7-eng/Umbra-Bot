'use server'

import { createClient } from '@/lib/supabase/server'
import { getDateRange } from './_utils'
import type { Filters, ExportRow } from './_types'
import { computeExportRows } from './_server'
import type { RawTx, RawBot, RawFlow } from './_server'

const TX_SEL =
  'bot_id, flow_id, status, amount, net, fee, product_name, utm_source, utm_campaign, created_at'

export async function getExportRows(filters: Filters): Promise<ExportRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const uid = user.id
  const { start, end } = getDateRange(filters.period)
  const isAll = filters.period === 'all'

  let txQ = supabase
    .from('transactions')
    .select(TX_SEL)
    .eq('user_id', uid)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (!isAll) txQ = txQ.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
  if (filters.botId !== 'all')       txQ = txQ.eq('bot_id', filters.botId)
  if (filters.productName !== 'all') txQ = txQ.eq('product_name', filters.productName)
  if (filters.flowId !== 'all')      txQ = txQ.eq('flow_id', filters.flowId)
  if (filters.utmSource !== 'all') {
    txQ = filters.utmSource === '(direto)'
      ? txQ.is('utm_source', null)
      : txQ.eq('utm_source', filters.utmSource)
  }

  const [txRes, botsRes, flowsRes] = await Promise.all([
    txQ,
    supabase.from('bots').select('id, name, username').eq('user_id', uid),
    supabase.from('flows').select('id, name, executions, conversion').eq('user_id', uid).limit(50),
  ])

  const txs   = (txRes.data   as unknown as RawTx[])   ?? []
  const bots  = (botsRes.data as unknown as RawBot[])  ?? []
  const flows = (flowsRes.data as unknown as RawFlow[]) ?? []

  return computeExportRows(txs, bots, flows)
}
