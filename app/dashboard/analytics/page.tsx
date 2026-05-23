import { createClient } from '@/lib/supabase/server'
import { captureEvent } from '@/lib/analytics-server'
import { AnalyticsClient } from './AnalyticsClient'
import type { AnalyticsSummary, Filters, Period } from './_types'
import { getDateRange } from './_utils'
import {
  computeFunnel, computeByBot, computeByProduct,
  computeByFlow, computeByUtm, computeStatusBreakdown,
  transformCohortRpc, computeKpiSummary, computeRevenueByDay,
} from './_server'
import type { RawTx, RawCheckoutEvent, RawBot, RawFlow, CohortRpcRow } from './_server'

const QUERY_LIMIT = 5000

const TX_SEL =
  'bot_id, flow_id, status, amount, net, fee, product_name, utm_source, utm_campaign, created_at'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const sp  = await searchParams
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)

  const period      = (['7d', '30d', '90d', 'all'].includes(get('period') ?? '') ? get('period')! : '30d') as Period
  const botId       = get('botId')       ?? 'all'
  const productName = get('productName') ?? 'all'
  const flowId      = get('flowId')      ?? 'all'
  const utmSource   = get('utmSource')   ?? 'all'
  const compare     = get('compare') === '1'
  const canCompare  = compare && period !== 'all'

  const filters: Filters = { period, botId, productName, flowId, utmSource, compare }
  const uid   = user.id
  const isAll = period === 'all'
  const { start, end, prevStart, prevEnd } = getDateRange(period)

  // ── Query builders ───────────────────────────────────────────

  const buildTx = (s: Date, e: Date, applyDate: boolean) => {
    let q = supabase
      .from('transactions')
      .select(TX_SEL)
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(QUERY_LIMIT)
    if (applyDate) q = q.gte('created_at', s.toISOString()).lte('created_at', e.toISOString())
    if (botId !== 'all')       q = q.eq('bot_id', botId)
    if (productName !== 'all') q = q.eq('product_name', productName)
    if (flowId !== 'all')      q = q.eq('flow_id', flowId)
    if (utmSource !== 'all') {
      q = utmSource === '(direto)' ? q.is('utm_source', null) : q.eq('utm_source', utmSource)
    }
    return q
  }

  const buildCnt = (s: Date, e: Date, applyDate: boolean) => {
    let q = supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
    if (applyDate) q = q.gte('created_at', s.toISOString()).lte('created_at', e.toISOString())
    if (botId !== 'all') q = q.eq('bot_id', botId)
    return q
  }

  const buildEvt = (s: Date, e: Date, applyDate: boolean) => {
    let q = supabase
      .from('checkout_events')
      .select('event_type, bot_id, flow_id')
      .eq('user_id', uid)
      .limit(QUERY_LIMIT)
    if (applyDate) q = q.gte('created_at', s.toISOString()).lte('created_at', e.toISOString())
    if (botId !== 'all')  q = q.eq('bot_id', botId)
    if (flowId !== 'all') q = q.eq('flow_id', flowId)
    return q
  }

  // ── Kick off prev queries BEFORE the main await ──────────────
  // Garante que todas as queries (main + prev) disparam em paralelo.
  // Promises HTTP já estão no ar antes de qualquer await abaixo.
  const prevTxP  = canCompare ? buildTx(prevStart, prevEnd, true)  : null
  const prevCntP = canCompare ? buildCnt(prevStart, prevEnd, true) : null
  const prevEvtP = canCompare ? buildEvt(prevStart, prevEnd, true) : null

  // ── Await main em paralelo ───────────────────────────────────

  const [txRes, cntRes, evtRes, botsRes, flowsRes, cohortRes, filterOptsRes] = await Promise.all([
    buildTx(start, end, !isAll),
    buildCnt(start, end, !isAll),
    buildEvt(start, end, !isAll),
    supabase.from('bots').select('id, name, username').eq('user_id', uid),
    supabase.from('flows')
      .select('id, name, executions, conversion')
      .eq('user_id', uid)
      .order('executions', { ascending: false })
      .limit(50),
    supabase.rpc('analytics_cohort_weekly', { p_user_id: uid, p_cohorts: 6, p_weeks: 6 }),
    supabase.rpc('analytics_filter_options', { p_user_id: uid }),
  ])

  // Prev já estava rodando — apenas coleta resultados
  const prevRes = canCompare
    ? await Promise.all([prevTxP!, prevCntP!, prevEvtP!])
    : null

  // ── Extract data ─────────────────────────────────────────────

  const error =
    txRes.error?.message ??
    evtRes.error?.message ??
    cohortRes.error?.message ??
    null

  if (cohortRes.error) {
    void captureEvent(uid, 'analytics_cohort_error', { error: cohortRes.error.message })
  }

  const limitReached =
    (txRes.data?.length ?? 0) >= QUERY_LIMIT ||
    (evtRes.data?.length ?? 0) >= QUERY_LIMIT

  const curTxs   = (txRes.data  as unknown as RawTx[])            ?? []
  const curConts = cntRes.count ?? 0
  const curEvts  = (evtRes.data as unknown as RawCheckoutEvent[]) ?? []
  const prevTxs   = (prevRes?.[0].data as unknown as RawTx[])            ?? []
  const prevConts = prevRes?.[1].count ?? 0
  const prevEvts  = (prevRes?.[2].data as unknown as RawCheckoutEvent[]) ?? []
  const cohortRaw = (cohortRes.data as unknown as CohortRpcRow[])  ?? []
  const bots      = (botsRes.data  as unknown as RawBot[])         ?? []
  const flows     = (flowsRes.data as unknown as RawFlow[])        ?? []

  // ── Filter options (SELECT DISTINCT via RPC) ─────────────────

  const filterOpts = (filterOptsRes.data as { products: string[]; utm_sources: string[] } | null)
    ?? { products: [], utm_sources: [] }
  const productOptions = filterOpts.products    ?? []
  const utmOptions     = filterOpts.utm_sources ?? []

  // ── Assemble summary ─────────────────────────────────────────

  const summary: AnalyticsSummary = {
    filters,
    kpi:             computeKpiSummary(curTxs, prevTxs, curEvts),
    revenueByDay:    computeRevenueByDay(curTxs, period),
    funnel:          computeFunnel(curTxs, curConts, curEvts, prevTxs, prevConts, prevEvts),
    byBot:           computeByBot(curTxs, bots),
    byProduct:       computeByProduct(curTxs),
    byFlow:          computeByFlow(curTxs, flows),
    byUtm:           computeByUtm(curTxs),
    statusBreakdown: computeStatusBreakdown(curTxs),
    cohortRows:      transformCohortRpc(cohortRaw),
    botOptions:      bots.map((b) => ({ id: b.id, name: b.name, username: b.username })),
    productOptions,
    flowOptions:     flows.map((f) => ({ id: f.id, name: f.name })),
    utmOptions,
    error,
    limitReached,
    queryLimit:      QUERY_LIMIT,
  }

  return <AnalyticsClient summary={summary} />
}
