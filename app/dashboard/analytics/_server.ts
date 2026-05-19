// Funções de computação server-side — usadas apenas por page.tsx.
// Rodam em Node.js, sem custo para o browser.

import type {
  BotStat, ProductStat, FlowStat, UtmStat,
  StatusData, FunnelStage, CohortRow, ExportRow,
} from './_types'

// ── Tipos raw vindos do Supabase ─────────────────────────────

export interface RawTx {
  bot_id:               string | null
  flow_id:              string | null
  status:               string
  amount:               number
  net:                  number | null
  fee:                  number
  product_name:         string
  utm_source:           string | null
  utm_campaign:         string | null
  created_at:           string
}

export interface RawContact {
  bot_id: string | null
}

export interface RawCheckoutEvent {
  event_type: string
  bot_id:     string | null
  flow_id:    string | null
}

export interface RawBot {
  id:       string
  name:     string
  username: string
}

export interface RawFlow {
  id:         string
  name:       string
  executions: number
  conversion: number
}

export interface CohortRpcRow {
  cohort_date:   string
  cohort_label:  string
  cohort_size:   number
  week_index:    number
  retention_pct: number | null
}

// ── Helper ───────────────────────────────────────────────────

const txNet = (tx: RawTx) => tx.net ?? (tx.amount - tx.fee)

const STATUS_META: Record<string, { label: string; color: string }> = {
  approved:  { label: 'Aprovados',    color: 'var(--success)' },
  pending:   { label: 'Pendentes',    color: 'var(--warning)' },
  cancelled: { label: 'Cancelados',   color: 'var(--danger)' },
  refunded:  { label: 'Reembolsados', color: 'var(--text-muted)' },
}

// ── Funnel ───────────────────────────────────────────────────

export function computeFunnel(
  curTxs:      RawTx[],
  curContacts: RawContact[],
  curEvents:   RawCheckoutEvent[],
  prevTxs:     RawTx[],
  prevContacts: RawContact[],
  prevEvents:  RawCheckoutEvent[],
): FunnelStage[] {
  const ev = (type: string, src: RawCheckoutEvent[]) =>
    src.filter((e) => e.event_type === type).length

  return [
    {
      stage: 'Visitou',
      value: ev('visited', curEvents),
      prev:  ev('visited', prevEvents),
    },
    {
      stage: 'Iniciou conversa',
      value: curContacts.length,
      prev:  prevContacts.length,
    },
    {
      stage: 'Adicionou ao carrinho',
      value: ev('cart_added', curEvents),
      prev:  ev('cart_added', prevEvents),
    },
    {
      stage: 'Comprou',
      value: curTxs.filter((t) => t.status === 'approved').length,
      prev:  prevTxs.filter((t) => t.status === 'approved').length,
    },
  ]
}

// ── By bot ───────────────────────────────────────────────────

export function computeByBot(txs: RawTx[], bots: RawBot[]): BotStat[] {
  const botMap = new Map(bots.map((b) => [b.id, b]))
  const groups = new Map<string, { revenue: number; sales: number }>()

  for (const tx of txs.filter((t) => t.status === 'approved')) {
    const key = tx.bot_id ?? '__none__'
    const cur = groups.get(key) ?? { revenue: 0, sales: 0 }
    cur.revenue += txNet(tx)
    cur.sales++
    groups.set(key, cur)
  }

  return [...groups.entries()]
    .map(([botId, s]) => {
      const bot = botId !== '__none__' ? botMap.get(botId) : undefined
      return {
        name:   bot ? (bot.username ? `@${bot.username}` : bot.name) : 'Sem bot vinculado',
        sales:  s.sales,
        revenue: s.revenue,
        ticket: s.sales > 0 ? s.revenue / s.sales : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

// ── By product ───────────────────────────────────────────────

export function computeByProduct(txs: RawTx[]): ProductStat[] {
  const groups = new Map<string, { revenue: number; units: number }>()

  for (const tx of txs.filter((t) => t.status === 'approved')) {
    const key = tx.product_name || 'Sem produto'
    const cur = groups.get(key) ?? { revenue: 0, units: 0 }
    cur.revenue += txNet(tx)
    cur.units++
    groups.set(key, cur)
  }

  return [...groups.entries()]
    .map(([name, s]) => ({
      name,
      revenue: s.revenue,
      units:   s.units,
      ticket:  s.units > 0 ? s.revenue / s.units : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

// ── By flow (dados reais → fallback estático) ─────────────────

export function computeByFlow(txs: RawTx[], flows: RawFlow[]): FlowStat[] {
  const flowMap = new Map(flows.map((f) => [f.id, f]))
  const groups  = new Map<string, { name: string; revenue: number; sales: number }>()

  for (const tx of txs.filter((t) => t.status === 'approved' && t.flow_id)) {
    const flow = flowMap.get(tx.flow_id!)
    const cur  = groups.get(tx.flow_id!) ?? {
      name: flow?.name ?? 'Fluxo',
      revenue: 0,
      sales: 0,
    }
    cur.revenue += txNet(tx)
    cur.sales++
    groups.set(tx.flow_id!, cur)
  }

  if (groups.size > 0) {
    return [...groups.values()]
      .map((g) => ({ ...g, ticket: g.sales > 0 ? g.revenue / g.sales : 0, isReal: true }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }

  // Fallback: executions estático da tabela flows
  return flows
    .slice(0, 5)
    .map((f) => ({ name: f.name, revenue: 0, sales: f.executions, ticket: 0, isReal: false }))
}

// ── By UTM origin ────────────────────────────────────────────

export function computeByUtm(txs: RawTx[]): UtmStat[] {
  const groups = new Map<string, { revenue: number; sales: number }>()

  for (const tx of txs.filter((t) => t.status === 'approved')) {
    const key = tx.utm_source ?? '(direto)'
    const cur = groups.get(key) ?? { revenue: 0, sales: 0 }
    cur.revenue += txNet(tx)
    cur.sales++
    groups.set(key, cur)
  }

  return [...groups.entries()]
    .map(([source, s]) => ({
      source,
      revenue: s.revenue,
      sales:   s.sales,
      ticket:  s.sales > 0 ? s.revenue / s.sales : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
}

// ── Status breakdown ─────────────────────────────────────────

export function computeStatusBreakdown(txs: RawTx[]): StatusData[] {
  const groups = new Map<string, number>()
  for (const tx of txs) {
    groups.set(tx.status, (groups.get(tx.status) ?? 0) + 1)
  }
  return [...groups.entries()]
    .map(([status, value]) => ({
      name:  STATUS_META[status]?.label ?? status,
      value,
      color: STATUS_META[status]?.color ?? 'var(--text-subtle)',
    }))
    .sort((a, b) => b.value - a.value)
}

// ── Export rows ───────────────────────────────────────────────

export function computeExportRows(
  txs:     RawTx[],
  bots:    RawBot[],
  flows:   RawFlow[],
): ExportRow[] {
  const botMap  = new Map(bots.map((b)  => [b.id,  b.username || b.name]))
  const flowMap = new Map(flows.map((f) => [f.id,  f.name]))

  return txs
    .filter((tx) => tx.status === 'approved')
    .map((tx) => ({
      date:        tx.created_at.slice(0, 10),
      product:     tx.product_name,
      amount:      tx.amount,
      fee:         tx.fee,
      net:         txNet(tx),
      bot:         tx.bot_id  ? (botMap.get(tx.bot_id)   ?? '') : '',
      flow:        tx.flow_id ? (flowMap.get(tx.flow_id)  ?? '') : '',
      utmSource:   tx.utm_source   ?? '(direto)',
      utmCampaign: tx.utm_campaign ?? '',
    }))
}

// ── Cohort RPC → CohortRow[] ─────────────────────────────────

export function transformCohortRpc(
  rows:   CohortRpcRow[],
  nWeeks: number = 6,
): CohortRow[] {
  const byDate = new Map<string, CohortRow>()

  for (const row of rows) {
    if (!byDate.has(row.cohort_date)) {
      byDate.set(row.cohort_date, {
        label: row.cohort_label,
        size:  Number(row.cohort_size),
        weeks: Array<number | null>(nWeeks).fill(null),
      })
    }
    const cohort = byDate.get(row.cohort_date)!
    if (row.week_index >= 0 && row.week_index < nWeeks) {
      cohort.weeks[row.week_index] = row.retention_pct
    }
  }

  return [...byDate.values()]
}
