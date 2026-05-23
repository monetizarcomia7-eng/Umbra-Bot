import type { KpiSummary } from '../_types'
import { fmtBRL, fmtNum } from '../_utils'

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) return null
  const pct = ((cur - prev) / prev) * 100
  const up  = pct >= 0
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md"
      style={{
        background: up
          ? 'color-mix(in oklab, var(--success) 14%, transparent)'
          : 'color-mix(in oklab, var(--danger) 14%, transparent)',
        color: up ? 'var(--success)' : 'var(--danger)',
      }}
    >
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

interface Props {
  kpi:     KpiSummary
  compare: boolean
}

export function KpiSummaryRow({ kpi, compare }: Props) {
  const prevAvgTicket = kpi.prevSales > 0 ? kpi.prevRevenue / kpi.prevSales : 0

  const cards: Array<{
    label:    string
    value:    string
    sub:      string
    cur?:     number
    prev?:    number
  }> = [
    {
      label: 'Receita aprovada',
      value: fmtBRL(kpi.totalRevenue),
      sub:   'Líquida no período',
      cur:   kpi.totalRevenue,
      prev:  kpi.prevRevenue,
    },
    {
      label: 'Vendas aprovadas',
      value: fmtNum(kpi.totalSales),
      sub:   'Transações no período',
      cur:   kpi.totalSales,
      prev:  kpi.prevSales,
    },
    {
      label: 'Ticket médio',
      value: fmtBRL(kpi.avgTicket),
      sub:   'Receita ÷ vendas',
      cur:   kpi.avgTicket,
      prev:  prevAvgTicket,
    },
    {
      label: 'Conv. visitou→comprou',
      value: `${kpi.conversionRate.toFixed(1)}%`,
      sub:   kpi.conversionRate === 0 ? 'Sem visitas registradas' : 'Das visitas registradas',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-border bg-surface p-4"
        >
          <p className="text-[11.5px] font-medium text-text-muted mb-1.5 truncate">{c.label}</p>
          <p className="text-[22px] font-bold text-text leading-none mb-2">{c.value}</p>
          <div className="flex items-center gap-2 min-h-[20px]">
            {compare && c.cur !== undefined && c.prev !== undefined ? (
              <DeltaBadge cur={c.cur} prev={c.prev} />
            ) : (
              <p className="text-[11px] text-text-subtle">{c.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
