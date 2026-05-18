'use client'

import React, { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { cn } from '@/lib/utils'
import {
  Calendar, Bot, Package, GitBranch, LineChart as LineChartIcon,
  X, ArrowUpRight, ArrowDownRight, RefreshCw, Download, ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

/* ── Icon map ─────────────────────────────────────────────── */

const iconMap: Record<string, LucideIcon> = {
  'calendar': Calendar,
  'bot': Bot,
  'package': Package,
  'git-branch': GitBranch,
  'line-chart': LineChartIcon,
  'x': X,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'refresh-cw': RefreshCw,
  'download': Download,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Comp = iconMap[name]
  if (!Comp) return null
  return <Comp size={size} className={className} />
}

/* ── Formatters ───────────────────────────────────────────── */

const fmtNum = (v: number) => v.toLocaleString('pt-BR')
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number, d = 1) => `${v.toFixed(d)}%`

/* ── Mock data ────────────────────────────────────────────── */

interface FunnelStage { stage: string; value: number; prev: number }
interface BotPerf     { name: string; sales: number; conv: number; delta: number }
interface ProductPerf { name: string; revenue: number; units: number; ticket: number }
interface FlowPerf    { name: string; sales: number; ticket: number; conv: number }
interface SourceData  { name: string; value: number; color: string }
interface CohortRow   { label: string; size: number; weeks: (number | null)[] }

const analyticsMock: {
  funnel: FunnelStage[]
  byBot: BotPerf[]
  byProduct: ProductPerf[]
  byFlow: FlowPerf[]
  bySource: SourceData[]
  cohort: CohortRow[]
} = {
  funnel: [
    { stage: 'Visitou',               value: 15420, prev: 13800 },
    { stage: 'Iniciou conversa',      value: 13456, prev: 11960 },
    { stage: 'Adicionou ao carrinho', value: 5673,  prev: 4856  },
    { stage: 'Pagou',                 value: 4334,  prev: 3702  },
  ],
  byBot: [
    { name: '@mentoria_vip_bot',     sales: 1832, conv: 9.4, delta: 12.4  },
    { name: '@lancamento_black_bot', sales: 1245, conv: 7.1, delta: 8.2   },
    { name: '@upsell_pos_bot',       sales: 742,  conv: 6.6, delta: -2.1  },
    { name: '@vendas_curso_bot',     sales: 515,  conv: 4.2, delta: 3.7   },
  ],
  byProduct: [
    { name: 'Mentoria Premium Anual',  revenue: 78420, units: 142, ticket: 552 },
    { name: 'Curso Intensivo 90 dias', revenue: 42180, units: 287, ticket: 147 },
    { name: 'Pack Templates Pro',      revenue: 28960, units: 412, ticket: 70  },
    { name: 'Consultoria Individual',  revenue: 24300, units: 36,  ticket: 675 },
    { name: 'E-book Estratégias',      revenue: 10160, units: 508, ticket: 20  },
  ],
  byFlow: [
    { name: 'Funil VIP — Lançamento',  sales: 487, ticket: 297, conv: 9.4 },
    { name: 'Upsell pós-compra',       sales: 312, ticket: 197, conv: 7.1 },
    { name: 'Carrinho abandonado 24h', sales: 218, ticket: 247, conv: 5.8 },
    { name: 'Remarketing 7 dias',      sales: 184, ticket: 147, conv: 4.2 },
    { name: 'Bem-vindo + Oferta',      sales: 142, ticket: 97,  conv: 3.1 },
  ],
  bySource: [
    { name: 'Instagram Ads',    value: 1842, color: 'var(--primary)'   },
    { name: 'Google Ads',       value: 1248, color: 'var(--success)'   },
    { name: 'YouTube Ads',      value: 876,  color: 'var(--warning)'   },
    { name: 'Afiliados',        value: 524,  color: 'var(--danger)'    },
    { name: 'Tráfego orgânico', value: 298,  color: 'var(--text-subtle)' },
  ],
  cohort: [
    { label: '23–29 set',     size: 487, weeks: [100, 38,   22,   14,   9,    7   ] },
    { label: '30 set–06 out', size: 542, weeks: [100, 42,   28,   18,   12,   null] },
    { label: '07–13 out',     size: 612, weeks: [100, 45,   31,   22,   null, null] },
    { label: '14–20 out',     size: 538, weeks: [100, 40,   26,   null, null, null] },
    { label: '21–27 out',     size: 624, weeks: [100, 44,   null, null, null, null] },
    { label: '28 out–03 nov', size: 731, weeks: [100, null, null, null, null, null] },
  ],
}

const filterOptions = {
  period:  ['Últimos 7 dias', 'Últimos 30 dias', 'Últimos 90 dias', 'Este mês', 'Personalizado'],
  bot:     ['Todos os bots', '@mentoria_vip_bot', '@lancamento_black_bot', '@upsell_pos_bot', '@vendas_curso_bot'],
  product: ['Todos os produtos', 'Mentoria Premium Anual', 'Curso Intensivo 90 dias', 'Pack Templates Pro', 'Consultoria Individual'],
  flow:    ['Todos os fluxos', 'Funil VIP — Lançamento', 'Upsell pós-compra', 'Carrinho abandonado 24h', 'Remarketing 7 dias'],
  source:  ['Todas as origens', 'Instagram Ads', 'Google Ads', 'YouTube Ads', 'Afiliados', 'Tráfego orgânico'],
}

/* ── Local helpers ────────────────────────────────────────── */

function Card({
  title,
  subtitle,
  action,
  noPadding,
  children,
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  noPadding?: boolean
  children?: React.ReactNode
}) {
  const hasHeader = !!(title || action)
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {hasHeader && (
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

function Btn({
  variant = 'primary',
  iconName,
  children,
  onClick,
  disabled,
  className,
}: {
  variant?: 'primary' | 'secondary'
  iconName?: string
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const Ico = iconName ? (iconMap[iconName] ?? null) : null
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-primary text-primary-fg hover:opacity-90'
          : 'border border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
    >
      {Ico && <Ico size={14} className="shrink-0" />}
      {children}
    </button>
  )
}

function Dropdown({
  icon,
  label,
  value,
  options,
  onChange,
  width,
}: {
  icon?: string
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  width?: number
}) {
  const Ico = icon ? (iconMap[icon] ?? null) : null
  return (
    <div className="relative h-9" style={width ? { width } : { minWidth: 160 }}>
      {Ico && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10">
          <Ico size={13} />
        </span>
      )}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pr-7',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
          Ico ? 'pl-8' : 'pl-3',
        )}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
        <ChevronDown size={12} />
      </span>
    </div>
  )
}

function SwitchToggle({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  label?: string
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none">
      <div className="relative w-8 h-[18px] shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div className={cn('absolute inset-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-surface-3 border border-border')} />
        <div className={cn(
          'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
        )} />
      </div>
      {label && <span className="text-[12.5px] text-text-muted whitespace-nowrap">{label}</span>}
    </label>
  )
}

/* ── Filter bar ───────────────────────────────────────────── */

interface Filters { period: string; bot: string; product: string; flow: string; source: string }

function FilterBar({
  filters,
  setFilters,
  compare,
  setCompare,
  onClear,
  isDefault,
}: {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  compare: boolean
  setCompare: (v: boolean) => void
  onClear: () => void
  isDefault: boolean
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-2.5 flex flex-wrap items-center gap-2 mb-5">
      <Dropdown icon="calendar" label="Período" value={filters.period} options={filterOptions.period} onChange={(v) => setFilters((f) => ({ ...f, period: v }))} />
      <Dropdown icon="bot" label="Bot" value={filters.bot} options={filterOptions.bot} onChange={(v) => setFilters((f) => ({ ...f, bot: v }))} width={240} />
      <Dropdown icon="package" label="Produto" value={filters.product} options={filterOptions.product} onChange={(v) => setFilters((f) => ({ ...f, product: v }))} width={260} />
      <Dropdown icon="git-branch" label="Fluxo" value={filters.flow} options={filterOptions.flow} onChange={(v) => setFilters((f) => ({ ...f, flow: v }))} width={260} />
      <Dropdown icon="line-chart" label="Origem" value={filters.source} options={filterOptions.source} onChange={(v) => setFilters((f) => ({ ...f, source: v }))} width={220} />

      {!isDefault && (
        <button
          onClick={onClear}
          className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-ring"
        >
          <Icon name="x" size={13} />
          Limpar
        </button>
      )}

      <div className="flex-1" />

      <div className="h-9 inline-flex items-center px-2 border-l border-border ml-1 pl-3">
        <SwitchToggle
          id="compare-toggle"
          checked={compare}
          onChange={(e) => setCompare(e.target.checked)}
          label="Comparar período anterior"
        />
      </div>
    </div>
  )
}

/* ── Funnel ───────────────────────────────────────────────── */

function FunnelChart({ stages, compare }: { stages: FunnelStage[]; compare: boolean }) {
  const top = stages[0].value
  const overall = (stages[stages.length - 1].value / top) * 100

  return (
    <Card
      title="Funil de conversão"
      subtitle="Da visita ao pagamento"
      action={
        <div className="text-right">
          <div className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">Conv. total</div>
          <div className="text-[18px] font-semibold tnum text-text leading-none mt-0.5">{fmtPct(overall)}</div>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1] : null
          const stepConv = prev ? (s.value / prev.value) * 100 : null
          const ofTop = (s.value / top) * 100
          const periodDelta = ((s.value - s.prev) / s.prev) * 100

          return (
            <div key={s.stage} className="relative bg-surface-2/40 border border-border rounded-lg p-3.5">
              {stepConv !== null && (
                <div className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 items-center">
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
                <div className="lg:hidden mt-1 text-[11px] text-text-muted">
                  <span className="text-text font-medium tnum">{fmtPct(stepConv, 1)}</span>{' '}da etapa anterior
                </div>
              )}

              {compare && (
                <div className="mt-1.5">
                  <span className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium text-[10.5px]',
                    periodDelta >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                  )}>
                    <Icon name={periodDelta >= 0 ? 'arrow-up-right' : 'arrow-down-right'} size={10} />
                    {fmtPct(Math.abs(periodDelta), 1)}
                  </span>
                  <span className="text-[10.5px] text-text-muted ml-1.5">vs. período anterior</span>
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
  title,
  subtitle,
  items,
  getLabel,
  getValue,
  getSecondary,
  format,
}: {
  title: string
  subtitle: string
  items: T[]
  getLabel: (item: T) => string
  getValue: (item: T) => number
  getSecondary: (item: T) => string
  format: (v: number) => string
}) {
  const max = Math.max(...items.map(getValue))
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-3.5 mt-2">
        {items.map((it, i) => {
          const v = getValue(it)
          const w = (v / max) * 100
          return (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-[12.5px] font-medium text-text truncate">{getLabel(it)}</span>
                <span className="text-[12.5px] tnum font-semibold text-text shrink-0">{format(v)}</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
              </div>
              <div className="mt-1 text-[10.5px] text-text-muted tnum">{getSecondary(it)}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ── BySourceCard ─────────────────────────────────────────── */

function BySourceCard({ data }: { data: SourceData[]; compare?: boolean }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <Card title="Vendas por origem (UTM)" subtitle="Atribuição last-click">
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [fmtNum(Number(v)) + ' vendas', '']}
                  separator=""
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full rounded-full bg-surface-2 border border-border" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[20px] font-semibold tnum text-text leading-none tracking-tight">{fmtNum(total)}</div>
            <div className="text-[10.5px] text-text-muted mt-0.5">vendas totais</div>
          </div>
        </div>

        <div className="flex-1 space-y-1.5 min-w-0">
          {data.map((d) => {
            const pct = (d.value / total) * 100
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

/* ── CohortTable ──────────────────────────────────────────── */

function CohortTable({ rows }: { rows: CohortRow[] }) {
  const numWeeks = 6
  return (
    <Card title="Coorte de recompra" subtitle="% de clientes que voltaram a comprar nas semanas seguintes">
      <div className="overflow-x-auto -mx-5 px-5 mt-1">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left font-medium pb-2 pr-3 whitespace-nowrap">Coorte</th>
              <th className="text-right font-medium pb-2 pr-4 whitespace-nowrap">Clientes</th>
              {Array.from({ length: numWeeks }, (_, i) => (
                <th key={i} className="text-center font-medium pb-2 px-1 tnum w-[11%]">S{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="py-2 pr-3 text-text whitespace-nowrap">{row.label}</td>
                <td className="py-2 pr-4 text-right text-text-muted tnum whitespace-nowrap">{fmtNum(row.size)}</td>
                {row.weeks.map((v, i) => (
                  <td key={i} className="py-1 px-1">
                    {v !== null ? (
                      <div
                        className="h-7 rounded-md flex items-center justify-center text-[11px] tnum font-medium"
                        style={{
                          background: `color-mix(in oklab, var(--primary) ${Math.min(0.65, 0.08 + (v / 100) * 0.55) * 100}%, transparent)`,
                          color: v >= 50 ? 'var(--primary-fg)' : 'var(--text)',
                        }}
                        title={`${row.label} · semana ${i} · ${v}% recompraram`}
                      >
                        {v}%
                      </div>
                    ) : (
                      <div className="h-7 rounded-md bg-surface-2/40 border border-dashed border-border" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10.5px] text-text-subtle">
        <span>S0 = semana da primeira compra. Células vazias = ainda não decorreram.</span>
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

/* ── Page ─────────────────────────────────────────────────── */

const defaultFilters: Filters = {
  period:  'Últimos 30 dias',
  bot:     'Todos os bots',
  product: 'Todos os produtos',
  flow:    'Todos os fluxos',
  source:  'Todas as origens',
}

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [compare, setCompare] = useState(false)
  const [exporting, setExporting] = useState(false)

  const isDefault = useMemo(
    () => (Object.keys(defaultFilters) as (keyof Filters)[]).every((k) => filters[k] === defaultFilters[k]),
    [filters],
  )

  function handleExport() {
    setExporting(true)
    setTimeout(() => setExporting(false), 1400)
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Análises"
        subtitle="Funis, retenção e comportamento dos usuários nos seus bots."
        actions={
          <>
            <Btn variant="secondary" iconName="refresh-cw">Atualizar</Btn>
            <Btn
              variant="primary"
              iconName={exporting ? undefined : 'download'}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <svg viewBox="0 0 24 24" width="13" height="13" className="spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Exportando…
                </>
              ) : 'Exportar CSV'}
            </Btn>
          </>
        }
      />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        compare={compare}
        setCompare={setCompare}
        onClear={() => setFilters(defaultFilters)}
        isDefault={isDefault}
      />

      <div className="space-y-5">
        <FunnelChart stages={analyticsMock.funnel} compare={compare} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BarListCard
            title="Desempenho por bot"
            subtitle="Vendas no período"
            items={analyticsMock.byBot}
            getLabel={(b) => b.name}
            getValue={(b) => b.sales}
            getSecondary={(b) => `Conv. ${fmtPct(b.conv)} · ${b.delta >= 0 ? '+' : ''}${fmtPct(Math.abs(b.delta))} vs. anterior`}
            format={fmtNum}
          />
          <BarListCard
            title="Por produto"
            subtitle="Receita no período"
            items={analyticsMock.byProduct}
            getLabel={(p) => p.name}
            getValue={(p) => p.revenue}
            getSecondary={(p) => `${fmtNum(p.units)} unidades · ticket médio ${fmtBRL(p.ticket)}`}
            format={fmtBRL}
          />
          <BarListCard
            title="Por fluxo de venda"
            subtitle="Conversões no período"
            items={analyticsMock.byFlow}
            getLabel={(f) => f.name}
            getValue={(f) => f.sales}
            getSecondary={(f) => `Ticket ${fmtBRL(f.ticket)} · Conv. ${fmtPct(f.conv)}`}
            format={fmtNum}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BySourceCard data={analyticsMock.bySource} compare={compare} />
          <CohortTable rows={analyticsMock.cohort} />
        </div>
      </div>
    </DashboardLayout>
  )
}
