import { createClient } from '@/lib/supabase/server'
import { captureEvent } from '@/lib/analytics-server'
import { AnalyticsClient } from './AnalyticsClient'
import type { AnalyticsSummary, Filters, Period } from './_types'
import { getDateRange } from './_utils'
import {
  computeFunnel, computeByBot, computeByProduct,
  computeByFlow, computeByUtm, computeStatusBreakdown,
  computeExportRows, transformCohortRpc,
} from './_server'
import type { RawTx, RawContact, RawCheckoutEvent, RawBot, RawFlow, CohortRpcRow } from './_server'

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
  const uid  = user.id
  const isAll = period === 'all'
  const { start, end, prevStart, prevEnd } = getDateRange(period)

  // ── Query builders (lazy — requests fire only when awaited) ──

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
      .select('bot_id')
      .eq('user_id', uid)
      .limit(QUERY_LIMIT)
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

  // ── Fire all queries in parallel ────────────────────────────

  const mainBatch = Promise.all([
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
    supabase.from('transactions').select('product_name').eq('user_id', uid).not('product_name', 'is', null).limit(500),
    supabase.from('transactions').select('utm_source').eq('user_id', uid).not('utm_source', 'is', null).limit(500),
  ])

  const prevBatch = canCompare
    ? Promise.all([
        buildTx(prevStart, prevEnd, true),
        buildCnt(prevStart, prevEnd, true),
        buildEvt(prevStart, prevEnd, true),
      ])
    : null

  // Await both batches (they ran in parallel)
  const [txRes, cntRes, evtRes, botsRes, flowsRes, cohortRes, prodRes, utmSrcRes] = await mainBatch
  const prevResults = prevBatch ? await prevBatch : null

  // ── Extract data ─────────────────────────────────────────────

  const error =
    txRes.error?.message ??
    cntRes.error?.message ??
    evtRes.error?.message ??
    cohortRes.error?.message ??
    null

  if (cohortRes.error) {
    void captureEvent(uid, 'analytics_cohort_error', { error: cohortRes.error.message })
  }
  const limitReached =
    (txRes.data?.length ?? 0) >= QUERY_LIMIT ||
    (cntRes.data?.length ?? 0) >= QUERY_LIMIT ||
    (evtRes.data?.length ?? 0) >= QUERY_LIMIT

  const curTxs    = (txRes.data    as unknown as RawTx[])             ?? []
  const curConts  = (cntRes.data   as unknown as RawContact[])        ?? []
  const curEvts   = (evtRes.data   as unknown as RawCheckoutEvent[])  ?? []
  const prevTxs   = (prevResults?.[0].data as unknown as RawTx[])            ?? []
  const prevConts = (prevResults?.[1].data as unknown as RawContact[])       ?? []
  const prevEvts  = (prevResults?.[2].data as unknown as RawCheckoutEvent[]) ?? []
  const bots      = (botsRes.data   as unknown as RawBot[])           ?? []
  const flows     = (flowsRes.data  as unknown as RawFlow[])          ?? []
  const cohortRaw = (cohortRes.data as unknown as CohortRpcRow[])     ?? []

  // ── Build dropdown option lists (all-time distinct values) ───

  const productOptions = [...new Set(
    (prodRes.data ?? []).map((r) => (r as { product_name: string }).product_name).filter(Boolean),
  )].sort()

  const utmOptions = [...new Set(
    (utmSrcRes.data ?? []).map((r) => (r as { utm_source: string }).utm_source).filter(Boolean),
  )].sort()

  // ── Assemble summary ─────────────────────────────────────────

  const summary: AnalyticsSummary = {
    filters,
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
    exportRows:      computeExportRows(curTxs, bots, flows),
    error,
    limitReached,
    queryLimit:      QUERY_LIMIT,
  }

  return <AnalyticsClient summary={summary} />
}
