'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { cn } from '@/lib/utils'
import { exportCSV } from '@/lib/csv'
import {
  X, ArrowUpRight, ArrowDownRight, RefreshCw, Download, ChevronDown, TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

/* ── Types ─────────────────────────────────────────────────── */

export type AnalyticsTx = {
  id: string
  bot_id: string | null
  status: string
  amount: number
  net: number | null
  fee: number
  product_name: string
  customer_telegram_id: string | null
  customer_email: string | null
  created_at: string
}

export type AnalyticsContact = {
  id: string
  bot_id: string | null
  orders_count: number
  created_at: string
}

export type AnalyticsBot = {
  id: string
  name: string
  username: string
}

export type AnalyticsFlow = {
  id: string
  name: string
  executions: number
  conversion: number
}

/* ── Formatters ───────────────────────────────────────────── */

const fmtNum = (v: number) => v.toLocaleString('pt-BR')
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number, d = 1) => `${v.toFixed(d)}%`

/* ── Date range ───────────────────────────────────────────── */

type Period = '7d' | '30d' | '90d' | 'all'

function getRange(period: Period) {
  const now = new Date()
  if (period === 'all') {
    return { start: new Date(0), end: now, prevStart: new Date(0), prevEnd: new Date(0) }
  }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const ms = days * 86400 * 1000
  const start = new Date(now.getTime() - ms)
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(start.getTime() - ms)
  return { start, end: now, prevStart, prevEnd }
}

/* ── Cohort computation ───────────────────────────────────── */

interface CohortRow { label: string; size: number; weeks: (number | null)[] }

function computeCohort(txs: AnalyticsTx[]): CohortRow[] {
  const approved = txs.filter(
    (t) => t.status === 'approved' && (t.customer_telegram_id || t.customer_email),
  )
  if (approved.length === 0) return []

  const firstPurchase = new Map<string, string>()
  const purchaseMonths = new Set<string>()

  for (const tx of approved) {
    const cid = tx.customer_telegram_id ?? tx.customer_email!
    const date = new Date(tx.created_at)
    const mk = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const cur = firstPurchase.get(cid)
    if (!cur || mk < cur) firstPurchase.set(cid, mk)
    purchaseMonths.add(`${cid}:${mk}`)
  }

  const cohortGroups = new Map<string, string[]>()
  for (const [cid, mk] of firstPurchase) {
    const list = cohortGroups.get(mk) ?? []
    list.push(cid)
    cohortGroups.set(mk, list)
  }

  const now = new Date()
  const nowMk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const rows: (CohortRow & { _mk: string })[] = []

  for (const [mk, customers] of cohortGroups) {
    const [y, m] = mk.split('-').map(Number)
    const weeks: (number | null)[] = [100]

    for (let offset = 1; offset <= 5; offset++) {
      const targetDate = new Date(y, m - 1 + offset)
      const targetMk = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`
      if (targetMk > nowMk) { weeks.push(null); continue }

      let returned = 0
      for (const cid of customers) {
        if (purchaseMonths.has(`${cid}:${targetMk}`)) returned++
      }
      weeks.push(Math.round((returned / customers.length) * 100))
    }

    const label = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    rows.push({ _mk: mk, label, size: customers.length, weeks })
  }

  return rows
    .sort((a, b) => a._mk.localeCompare(b._mk))
    .slice(-6)
    .map((r): CohortRow => ({ label: r.label, size: r.size, weeks: r.weeks }))
}

/* ── UI primitives ────────────────────────────────────────── */

function Card({
  title, subtitle, action, noPadding, children,
}: {
  title?: string; subtitle?: string; action?: React.ReactNode; noPadding?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          {title && (
            <div>
              <div className="text-[14px] font-semibold text-text">{title}</div>
              {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
            </div>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'px-5 pb-5'}>{children}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <TrendingUp size={28} className="text-text-subtle mb-2" />
      <p className="text-[13px] text-text-muted">{message}</p>
    </div>
  )
}

function Btn({
  variant = 'primary', icon: Icon, children, onClick, disabled, loading, className,
}: {
  variant?: 'primary' | 'secondary'; icon?: LucideIcon; children?: React.ReactNode
  onClick?: () => void; disabled?: boolean; loading?: boolean; className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-primary text-primary-fg hover:opacity-90'
          : 'border border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
    >
      {loading ? (
        <svg viewBox="0 0 24 24" width="13" height="13" className="spin shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : Icon ? <Icon size={14} className="shrink-0" /> : null}
      {children}
    </button>
  )
}

function Select({
  label, value, options, onChange, width,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  width?: number
}) {
  return (
    <div className="relative h-9" style={{ width: width ?? 180 }}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pl-3 pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
        <ChevronDown size={12} />
      </span>
    </div>
  )
}

/* ── Filter bar ───────────────────────────────────────────── */

interface Filters { period: Period; botId: string; productName: string }

const PERIOD_OPTS: { value: Period; label: string }[] = [
  { value: '7d',  label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo o período' },
]

function FilterBar({
  filters, setFilters, compare, setCompare, botOpts, productOpts, isDefault, onClear,
}: {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  compare: boolean
  setCompare: (v: boolean) => void
  botOpts: { value: string; label: string }[]
  productOpts: { value: string; label: string }[]
  isDefault: boolean
  onClear: () => void
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-2.5 flex flex-wrap items-center gap-2 mb-5">
      <Select
        label="Período"
        value={filters.period}
        options={PERIOD_OPTS}
        onChange={(v) => setFilters((f) => ({ ...f, period: v as Period }))}
        width={165}
      />
      <Select
        label="Bot"
        value={filters.botId}
        options={botOpts}
        onChange={(v) => setFilters((f) => ({ ...f, botId: v }))}
        width={220}
      />
      <Select
        label="Produto"
        value={filters.productName}
        options={productOpts}
        onChange={(v) => setFilters((f) => ({ ...f, productName: v }))}
        width={240}
      />

      {!isDefault && (
        <button
          onClick={onClear}
          className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2"
        >
          <X size={13} />
          Limpar
        </button>
      )}

      <div className="flex-1" />

      <label className="flex items-center gap-2 cursor-pointer select-none h-9 px-2 border-l border-border ml-1 pl-3">
        <div className="relative w-8 h-[18px] shrink-0">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="sr-only"
          />
          <div className={cn('absolute inset-0 rounded-full transition-colors', compare ? 'bg-primary' : 'bg-surface-3 border border-border')} />
          <div className={cn(
            'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform',
            compare ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )} />
        </div>
        <span className="text-[12.5px] text-text-muted whitespace-nowrap">Comparar período anterior</span>
      </label>
    </div>
  )
}

/* ── Funnel ───────────────────────────────────────────────── */

interface FunnelStage { stage: string; value: number; prev: number }

function FunnelChart({ stages, compare }: { stages: FunnelStage[]; compare: boolean }) {
  if (stages.every((s) => s.value === 0)) {
    return (
      <Card title="Funil de conversão" subtitle="Contatos, pagamentos gerados e aprovações">
        <EmptyState message="Nenhum dado no período selecionado." />
      </Card>
    )
  }

  const top = stages[0].value || 1
  const last = stages[stages.length - 1]
  const overall = (last.value / top) * 100

  return (
    <Card
      title="Funil de conversão"
      subtitle="Contatos, pagamentos gerados e aprovações"
      action={
        <div className="text-right">
          <div className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">Conversão geral</div>
          <div className="text-[18px] font-semibold tnum text-text leading-none mt-0.5">{fmtPct(overall)}</div>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1] : null
          const stepConv = prev && prev.value > 0 ? (s.value / prev.value) * 100 : null
          const ofTop = top > 0 ? (s.value / top) * 100 : 0
          const periodDelta = s.prev > 0 ? ((s.value - s.prev) / s.prev) * 100 : null

          return (
            <div key={s.stage} className="relative bg-surface-2/40 border border-border rounded-lg p-3.5">
              {stepConv !== null && (
                <div className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 items-center">
                  <span className="bg-surface border border-border rounded-md px-1.5 py-0.5 text-[10px] font-semibold tnum text-text shadow-sm">
                    {fmtPct(stepConv, 0)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-md bg-surface border border-border text-[10.5px] font-semibold text-text-muted flex items-center justify-center tnum">
                  {i + 1}
                </span>
                <div className="text-[12px] font-medium text-text-muted truncate">{s.stage}</div>
              </div>

              <div className="text-[22px] font-semibold tnum text-text leading-none tracking-tight">
                {fmtNum(s.value)}
              </div>

              {stepConv !== null && (
                <div className="sm:hidden mt-1 text-[11px] text-text-muted">
                  <span className="text-text font-medium tnum">{fmtPct(stepConv, 1)}</span>{' '}da etapa anterior
                </div>
              )}

              {compare && periodDelta !== null && (
                <div className="mt-1.5">
                  <span className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium text-[10.5px]',
                    periodDelta >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                  )}>
                    {periodDelta >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {fmtPct(Math.abs(periodDelta), 1)}
                  </span>
                  <span className="text-[10.5px] text-text-muted ml-1.5">vs. anterior</span>
                </div>
              )}

              <div className="mt-3 h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                <div className="h-full bg-primary rounded-full" style={{ width: `${ofTop}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-text-subtle tnum">{fmtPct(ofTop)} do topo</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ── BarListCard ──────────────────────────────────────────── */

function BarListCard<T>({
  title, subtitle, items, getLabel, getValue, getSecondary, format,
}: {
  title: string
  subtitle: string
  items: T[]
  getLabel: (item: T) => string
  getValue: (item: T) => number
  getSecondary: (item: T) => string
  format: (v: number) => string
}) {
  if (items.length === 0) {
    return (
      <Card title={title} subtitle={subtitle}>
        <EmptyState message="Nenhum dado no período." />
      </Card>
    )
  }

  const max = Math.max(...items.map(getValue)) || 1
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-3.5 mt-2">
        {items.map((it, i) => {
          const v = getValue(it)
          return (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-[12.5px] font-medium text-text truncate">{getLabel(it)}</span>
                <span className="text-[12.5px] tnum font-semibold text-text shrink-0">{format(v)}</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <div className="mt-1 text-[10.5px] text-text-muted tnum">{getSecondary(it)}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ── Status breakdown card ────────────────────────────────── */

interface StatusData { name: string; value: number; color: string }

const STATUS_META: Record<string, { label: string; color: string }> = {
  approved:  { label: 'Aprovados',    color: 'var(--success)' },
  pending:   { label: 'Pendentes',    color: 'var(--warning)' },
  cancelled: { label: 'Cancelados',   color: 'var(--danger)' },
  refunded:  { label: 'Reembolsados', color: 'var(--text-muted)' },
  expired:   { label: 'Expirados',    color: 'var(--text-subtle)' },
}

function StatusCard({ data }: { data: StatusData[] }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <Card title="Status dos pagamentos" subtitle="Distribuição por status no período">
        <EmptyState message="Nenhum pagamento no período." />
      </Card>
    )
  }

  return (
    <Card title="Status dos pagamentos" subtitle="Distribuição por status no período">
      <div className="flex items-center gap-5 mt-2">
        <div className="relative w-[136px] h-[136px] shrink-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} innerRadius={46} outerRadius={66} paddingAngle={2} dataKey="value" stroke="var(--surface)" strokeWidth={2}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-md)', color: 'var(--text)' }}
                  formatter={(v: unknown) => [fmtNum(Number(v)), '']}
                  separator=""
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full rounded-full bg-surface-2 border border-border" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[20px] font-semibold tnum text-text leading-none tracking-tight">{fmtNum(total)}</div>
            <div className="text-[10.5px] text-text-muted mt-0.5">total</div>
          </div>
        </div>

        <div className="flex-1 space-y-1.5 min-w-0">
          {data.map((d) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0
            return (
              <div key={d.name} className="flex items-center gap-2.5 text-[12px]">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="flex-1 text-text truncate">{d.name}</span>
                <span className="tnum text-text-muted shrink-0">{fmtNum(d.value)}</span>
                <span className="tnum text-text shrink-0 w-12 text-right font-medium">{fmtPct(pct, 1)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ── Cohort table ─────────────────────────────────────────── */

function CohortTable({ rows }: { rows: CohortRow[] }) {
  if (rows.length === 0) {
    return (
      <Card title="Coorte de recompra" subtitle="% de clientes que voltaram a comprar nos meses seguintes">
        <EmptyState message="Dados insuficientes para calcular coorte." />
      </Card>
    )
  }

  return (
    <Card title="Coorte de recompra" subtitle="% de clientes que voltaram a comprar nos meses seguintes">
      <div className="overflow-x-auto -mx-5 px-5 mt-1">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left font-medium pb-2 pr-3 whitespace-nowrap">Coorte</th>
              <th className="text-right font-medium pb-2 pr-4 whitespace-nowrap">Clientes</th>
              {Array.from({ length: 6 }, (_, i) => (
                <th key={i} className="text-center font-medium pb-2 px-1 tnum w-[11%]">M{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="py-2 pr-3 text-text whitespace-nowrap">{row.label}</td>
                <td className="py-2 pr-4 text-right text-text-muted tnum whitespace-nowrap">{fmtNum(row.size)}</td>
                {Array.from({ length: 6 }, (_, i) => {
                  const v = row.weeks[i] ?? null
                  return (
                    <td key={i} className="py-1 px-1">
                      {v !== null ? (
                        <div
                          className="h-7 rounded-md flex items-center justify-center text-[11px] tnum font-medium"
                          style={{
                            background: `color-mix(in oklab, var(--primary) ${Math.min(0.65, 0.08 + (v / 100) * 0.55) * 100}%, transparent)`,
                            color: v >= 50 ? 'var(--primary-fg)' : 'var(--text)',
                          }}
                          title={`${row.label} · M${i} · ${v}%`}
                        >
                          {v}%
                        </div>
                      ) : (
                        <div className="h-7 rounded-md bg-surface-2/40 border border-dashed border-border" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10.5px] text-text-subtle">
        <span>M0 = mês da primeira compra. Células vazias = período ainda não decorrido.</span>
        <div className="flex items-center gap-2">
          <span>Menor</span>
          <span className="flex h-2 w-24 rounded overflow-hidden border border-border">
            {[0.08, 0.2, 0.32, 0.45, 0.58].map((a, i) => (
              <span key={i} className="flex-1" style={{ background: `color-mix(in oklab, var(--primary) ${a * 100}%, transparent)` }} />
            ))}
          </span>
          <span>Maior</span>
        </div>
      </div>
    </Card>
  )
}

/* ── Main component ───────────────────────────────────────── */

const DEFAULT_FILTERS: Filters = { period: '30d', botId: 'all', productName: 'all' }

export function AnalyticsClient({
  transactions,
  contacts,
  bots,
  flows,
}: {
  transactions: AnalyticsTx[]
  contacts: AnalyticsContact[]
  bots: AnalyticsBot[]
  flows: AnalyticsFlow[]
}) {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [compare, setCompare] = useState(false)
  const [exporting, setExporting] = useState(false)

  const isDefault = useMemo(
    () => (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).every((k) => filters[k] === DEFAULT_FILTERS[k]),
    [filters],
  )

  const { start, end, prevStart, prevEnd } = useMemo(() => getRange(filters.period), [filters.period])

  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.period !== 'all') {
        const d = new Date(tx.created_at)
        if (d < start || d > end) return false
      }
      if (filters.botId !== 'all' && tx.bot_id !== filters.botId) return false
      if (filters.productName !== 'all' && tx.product_name !== filters.productName) return false
      return true
    })
  }, [transactions, filters.period, filters.botId, filters.productName, start, end])

  const prevTxs = useMemo(() => {
    if (!compare || filters.period === 'all') return []
    return transactions.filter((tx) => {
      const d = new Date(tx.created_at)
      return d >= prevStart && d <= prevEnd
    })
  }, [transactions, compare, filters.period, prevStart, prevEnd])

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (filters.period !== 'all') {
        const d = new Date(c.created_at)
        if (d < start || d > end) return false
      }
      if (filters.botId !== 'all' && c.bot_id !== filters.botId) return false
      return true
    })
  }, [contacts, filters.period, filters.botId, start, end])

  const prevContacts = useMemo(() => {
    if (!compare || filters.period === 'all') return []
    return contacts.filter((c) => {
      const d = new Date(c.created_at)
      return d >= prevStart && d <= prevEnd
    })
  }, [contacts, compare, filters.period, prevStart, prevEnd])

  const funnel = useMemo((): FunnelStage[] => [
    { stage: 'Contatos novos',      value: filteredContacts.length, prev: prevContacts.length },
    { stage: 'Pagamentos gerados',  value: filteredTxs.length,      prev: prevTxs.length },
    { stage: 'Compras aprovadas',   value: filteredTxs.filter((t) => t.status === 'approved').length, prev: prevTxs.filter((t) => t.status === 'approved').length },
  ], [filteredTxs, filteredContacts, prevTxs, prevContacts])

  const byBot = useMemo(() => {
    const botMap = new Map(bots.map((b) => [b.id, b]))
    const groups = new Map<string, { revenue: number; sales: number }>()
    for (const tx of filteredTxs.filter((t) => t.status === 'approved')) {
      const key = tx.bot_id ?? '__none__'
      const cur = groups.get(key) ?? { revenue: 0, sales: 0 }
      cur.revenue += tx.net ?? (tx.amount - tx.fee)
      cur.sales++
      groups.set(key, cur)
    }
    return [...groups.entries()]
      .map(([botId, s]) => {
        const bot = botId !== '__none__' ? botMap.get(botId) : undefined
        return {
          name: bot ? (bot.username ? `@${bot.username}` : bot.name) : 'Sem bot vinculado',
          sales: s.sales,
          revenue: s.revenue,
          ticket: s.sales > 0 ? s.revenue / s.sales : 0,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [filteredTxs, bots])

  const byProduct = useMemo(() => {
    const groups = new Map<string, { revenue: number; units: number }>()
    for (const tx of filteredTxs.filter((t) => t.status === 'approved')) {
      const key = tx.product_name || 'Sem produto'
      const cur = groups.get(key) ?? { revenue: 0, units: 0 }
      cur.revenue += tx.net ?? (tx.amount - tx.fee)
      cur.units++
      groups.set(key, cur)
    }
    return [...groups.entries()]
      .map(([name, s]) => ({
        name,
        revenue: s.revenue,
        units: s.units,
        ticket: s.units > 0 ? s.revenue / s.units : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [filteredTxs])

  const statusBreakdown = useMemo((): StatusData[] => {
    const groups = new Map<string, number>()
    for (const tx of filteredTxs) {
      groups.set(tx.status, (groups.get(tx.status) ?? 0) + 1)
    }
    return [...groups.entries()]
      .map(([status, value]) => ({
        name: STATUS_META[status]?.label ?? status,
        value,
        color: STATUS_META[status]?.color ?? 'var(--text-subtle)',
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredTxs])

  const cohort = useMemo(() => computeCohort(transactions), [transactions])

  const botOpts = useMemo(() => [
    { value: 'all', label: 'Todos os bots' },
    ...bots.map((b) => ({ value: b.id, label: b.username ? `@${b.username}` : b.name })),
  ], [bots])

  const productOpts = useMemo(() => {
    const names = new Set<string>()
    for (const tx of transactions) {
      if (tx.product_name) names.add(tx.product_name)
    }
    return [
      { value: 'all', label: 'Todos os produtos' },
      ...[...names].sort().map((n) => ({ value: n, label: n })),
    ]
  }, [transactions])

  const handleExport = useCallback(() => {
    setExporting(true)
    const botMap = new Map(bots.map((b) => [b.id, b.username || b.name]))
    const approved = filteredTxs.filter((t) => t.status === 'approved')
    exportCSV(
      `analytics-${filters.period}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Data', 'Produto', 'Valor bruto (R$)', 'Taxa (R$)', 'Valor líquido (R$)', 'Bot'],
      approved.map((tx) => [
        tx.created_at.slice(0, 10),
        tx.product_name,
        tx.amount,
        tx.fee,
        tx.net ?? (tx.amount - tx.fee),
        tx.bot_id ? (botMap.get(tx.bot_id) ?? '') : '',
      ]),
    )
    setTimeout(() => setExporting(false), 600)
  }, [filteredTxs, bots, filters.period])

  return (
    <DashboardLayout>
      <PageHeader
        title="Análises"
        subtitle="Funis, retenção e desempenho dos seus bots — dados reais."
        actions={
          <>
            <Btn variant="secondary" icon={RefreshCw} onClick={() => router.refresh()}>Atualizar</Btn>
            <Btn
              variant="primary"
              icon={exporting ? undefined : Download}
              onClick={handleExport}
              loading={exporting}
            >
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Btn>
          </>
        }
      />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        compare={compare}
        setCompare={setCompare}
        botOpts={botOpts}
        productOpts={productOpts}
        isDefault={isDefault}
        onClear={() => setFilters(DEFAULT_FILTERS)}
      />

      <div className="space-y-5">
        <FunnelChart stages={funnel} compare={compare} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BarListCard
            title="Desempenho por bot"
            subtitle="Receita aprovada no período"
            items={byBot}
            getLabel={(b) => b.name}
            getValue={(b) => b.revenue}
            getSecondary={(b) => `${fmtNum(b.sales)} vendas · ticket médio ${fmtBRL(b.ticket)}`}
            format={fmtBRL}
          />
          <BarListCard
            title="Por produto"
            subtitle="Receita aprovada no período"
            items={byProduct}
            getLabel={(p) => p.name}
            getValue={(p) => p.revenue}
            getSecondary={(p) => `${fmtNum(p.units)} unidades · ticket ${fmtBRL(p.ticket)}`}
            format={fmtBRL}
          />
          <BarListCard
            title="Por fluxo de venda"
            subtitle="Execuções totais (todos os períodos)"
            items={flows.slice(0, 5)}
            getLabel={(f) => f.name}
            getValue={(f) => f.executions}
            getSecondary={(f) => `Conversão ${fmtPct(f.conversion)}`}
            format={fmtNum}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatusCard data={statusBreakdown} />
          <CohortTable rows={cohort} />
        </div>
      </div>
    </DashboardLayout>
  )
}
