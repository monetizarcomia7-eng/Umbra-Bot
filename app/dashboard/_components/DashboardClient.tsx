'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useDashboard } from '@/providers/DashboardProvider'
import {
  TrendingUp, ShoppingBag, Target, Bot, Users, Wallet,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Circle, ArrowRight, HelpCircle,
  Wifi, WifiOff, AlertTriangle, Zap, ShoppingCart, Send, GraduationCap,
  RefreshCcw, XCircle, Activity, BarChart2, FileText, Settings,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard'

type Period = '7d' | '30d' | '90d'

interface ChartPoint { day: string; value: number }

interface KpiItem {
  id: string
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  Icon: React.ElementType
  tooltip: string
}

interface RealKpi {
  revenue: number
  sales: number
  botsActive: number
  avgTicket: number
  leads: number
  revenueD: string
  salesD: string
  leadsD: string
}

interface RealFlow { id: number; name: string; sales: number; conv: number; color: string }
type KpiCache = { kpi: RealKpi; chart: ChartPoint[]; flows: RealFlow[] }

export interface ActivityEvent {
  id: string
  type: string
  title: string
  description: string | null
  bot: string | null
  amount: number | null
  created_at: string
}

export interface BotSummary {
  id: string
  name: string
  username: string | null
  status: string
  color: string
}

export interface InitialDashboardData {
  transactions:     Array<{ amount: number; net: number | null; created_at: string; product_name: string | null }>
  prevTransactions: Array<{ net: number | null; amount: number }>
  botsActiveCount:  number
  botsTotalCount:   number
  balance:          number
  leadsCount:       number
  prevLeadsCount:   number
  recentActivity:   ActivityEvent[]
  botsList:         BotSummary[]
}

const ONBOARDING_STEPS = [
  { label: 'Criar conta',                      href: null,                  done: true  },
  { label: 'Conectar seu primeiro bot',         href: '/dashboard/bots',     done: false },
  { label: 'Configurar gateway de pagamento',   href: '/dashboard/gateways', done: false },
  { label: 'Criar seu primeiro fluxo de venda', href: '/dashboard/flows',    done: false },
]

const ACTIVITY_META: Record<string, { label: string; color: string }> = {
  sale:         { label: 'Venda',           color: 'var(--success)'  },
  lead:         { label: 'Novo lead',       color: 'var(--primary)'  },
  payment:      { label: 'Pagamento',       color: 'var(--success)'  },
  refund:       { label: 'Reembolso',       color: 'var(--danger)'   },
  reconnect:    { label: 'Bot reconectado', color: 'var(--success)'  },
  disconnect:   { label: 'Desconectado',    color: 'var(--warning)'  },
  limit:        { label: 'Limite',          color: 'var(--warning)'  },
  newBot:       { label: 'Novo bot',        color: 'var(--primary)'  },
  webhookFailed:{ label: 'Webhook falhou',  color: 'var(--danger)'   },
  flowPublished:{ label: 'Fluxo publicado', color: 'var(--primary)'  },
  cancellation: { label: 'Cancelamento',    color: 'var(--warning)'  },
  failure:      { label: 'Falha',           color: 'var(--danger)'   },
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  sale:         ShoppingCart,
  lead:         Users,
  payment:      Wallet,
  refund:       RefreshCcw,
  reconnect:    Wifi,
  disconnect:   WifiOff,
  limit:        AlertTriangle,
  newBot:       Bot,
  webhookFailed:XCircle,
  flowPublished:Zap,
  cancellation: XCircle,
  failure:      AlertTriangle,
}

const QUICK_ACTIONS = [
  { label: 'Gerenciar bots',    href: '/dashboard/bots',      Icon: Bot,       desc: 'Ver e configurar seus bots'    },
  { label: 'Ver finanças',      href: '/dashboard/finance',   Icon: Wallet,    desc: 'Saques, saldo e transações'    },
  { label: 'Ver clientes',      href: '/dashboard/customers', Icon: Users,     desc: 'Lista completa de contatos'    },
  { label: 'Criar fluxo',       href: '/dashboard/flows',     Icon: Zap,       desc: 'Automatize suas vendas'        },
  { label: 'Disparos',          href: '/dashboard/broadcasts',Icon: Send,      desc: 'Enviar mensagens em massa'     },
  { label: 'Ver analytics',     href: '/dashboard/analytics', Icon: BarChart2, desc: 'Funil, coorte e métricas'      },
]

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)

function getRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'agora'
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

function computeDelta(curr: number, prev: number): string {
  if (prev === 0) return ''
  const pct = ((curr - prev) / prev) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function txNet(r: { net: number | null; amount: number }): number {
  return Number(r.net ?? r.amount ?? 0)
}

function buildKpiCache(
  txs:       Array<{ amount: number; net: number | null; created_at: string; product_name: string | null }>,
  prevTxs:   Array<{ net: number | null; amount: number }>,
  botsActive: number,
  days:       number,
  leads:      number,
  prevLeads:  number,
): KpiCache {
  const revenue     = txs.reduce((s, t) => s + txNet(t), 0)
  const prevRevenue = prevTxs.reduce((s, t) => s + txNet(t), 0)
  const sales       = txs.length
  const prevSales   = prevTxs.length
  const avgTicket   = sales > 0 ? revenue / sales : 0

  const kpi: RealKpi = {
    revenue,
    sales,
    botsActive,
    avgTicket,
    leads,
    revenueD: computeDelta(revenue, prevRevenue),
    salesD:   computeDelta(sales, prevSales),
    leadsD:   computeDelta(leads, prevLeads),
  }

  const byDay: Record<string, number> = {}
  for (const tx of txs) {
    const key = String(tx.created_at).slice(0, 10)
    byDay[key] = (byDay[key] ?? 0) + txNet(tx)
  }
  const chart: ChartPoint[] = Array.from({ length: days }, (_, i) => {
    const d   = new Date(Date.now() - (days - 1 - i) * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    return { day: String(i + 1).padStart(2, '0'), value: byDay[key] ?? 0 }
  })

  const flowMap: Record<string, number> = {}
  for (const tx of txs) {
    const name = String(tx.product_name || 'Sem nome')
    flowMap[name] = (flowMap[name] ?? 0) + 1
  }
  const COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--danger)']
  const flows: RealFlow[] = Object.entries(flowMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, sales], i) => ({ id: i + 1, name, sales, conv: 0, color: COLORS[i] }))

  return { kpi, chart, flows }
}

/* ── Skeletons ───────────────────────────────────────────────────────── */

function KpiSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-3 w-24 bg-surface-2 rounded" />
        <div className="w-7 h-7 rounded-md bg-surface-2" />
      </div>
      <div className="h-7 w-28 bg-surface-2 rounded mb-3" />
      <div className="h-4 w-16 bg-surface-2 rounded" />
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-[240px] bg-surface-2 rounded-lg animate-pulse" />
}

function FlowSkeleton() {
  return (
    <div className="space-y-3.5 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="flex justify-between mb-1.5">
            <div className="h-3 w-32 bg-surface-2 rounded" />
            <div className="h-3 w-16 bg-surface-2 rounded" />
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/* ── KPI Card ────────────────────────────────────────────────────────── */

function KpiCard({ label, value, delta, trend, Icon, tooltip }: KpiItem) {
  const positive = trend === 'up'
  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="text-[12px] text-text-muted font-medium">{label}</div>
          <div className="relative group">
            <HelpCircle size={11} className="text-text-subtle cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <div className="bg-text text-surface text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg shadow-lg text-center">
                {tooltip}
              </div>
            </div>
          </div>
        </div>
        <div className="w-7 h-7 rounded-md bg-surface-2 flex items-center justify-center text-text-muted">
          <Icon size={14} />
        </div>
      </div>
      <div className="text-[24px] font-semibold tnum tracking-tight text-text leading-none">{value}</div>
      {delta && (
        <div className="text-[11.5px] mt-2.5 flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium',
            positive ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
          )}>
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {delta}
          </span>
          <span className="text-text-muted">vs. anterior</span>
        </div>
      )}
    </div>
  )
}

/* ── Revenue Chart ───────────────────────────────────────────────────── */

function RevenueChart({ data, loading }: { data: ChartPoint[]; loading: boolean }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted || loading) return <ChartSkeleton />

  const interval = data.length <= 7 ? 0 : data.length <= 30 ? 4 : 13

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          interval={interval}
          tick={{ fill: 'var(--text-muted)' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={48}
          tick={{ fill: 'var(--text-muted)' }}
          tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 12,
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text)',
          }}
          labelStyle={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}
          formatter={(value: unknown) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Receita']}
          labelFormatter={(d) => `Dia ${d}`}
        />
        <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#revGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ── Status Badge ────────────────────────────────────────────────────── */

function BotStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    online:  { label: 'Online',    color: 'var(--success)',        bg: 'var(--success-soft)'  },
    offline: { label: 'Offline',   color: 'var(--text-muted)',     bg: 'var(--surface-2)'     },
    banned:  { label: 'Banido',    color: 'var(--danger)',         bg: 'var(--danger-soft)'   },
    paused:  { label: 'Pausado',   color: 'var(--warning)',        bg: 'var(--warning-soft)'  },
  }
  const s = map[status] ?? map.offline
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md"
      style={{ color: s.color, background: s.bg }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: s.color }}
      />
      {s.label}
    </span>
  )
}

/* ── Empty State ─────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-[520px] text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'var(--primary-soft, #ede9fe)' }}
        >
          <Bot size={28} style={{ color: 'var(--primary, #7c3aed)' }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text, #0f172a)' }}>
          Boas-vindas ao Umbra Bot!
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--text-muted, #64748b)' }}>
          Você está a 3 passos de começar a vender no Telegram no piloto automático.
          Conecte seu primeiro bot para ver os dados reais aqui.
        </p>
        <div className="text-left space-y-3 mb-8">
          {ONBOARDING_STEPS.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e2e8f0)' }}
            >
              {step.done
                ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                : <Circle size={18} className="shrink-0" style={{ color: 'var(--border, #e2e8f0)' }} />
              }
              <span
                className="flex-1 text-sm font-medium"
                style={{ color: step.done ? 'var(--text-muted, #64748b)' : 'var(--text, #0f172a)' }}
              >
                {step.label}
              </span>
              {step.done && (
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md text-emerald-700 bg-emerald-50">
                  Feito
                </span>
              )}
            </div>
          ))}
        </div>
        <Link
          href="/dashboard/bots"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'var(--primary, #7c3aed)' }}
        >
          Conectar meu bot agora
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}

/* ── DashboardClient ─────────────────────────────────────────────────── */

export function DashboardClient({
  transactions,
  prevTransactions,
  botsActiveCount,
  botsTotalCount,
  balance,
  leadsCount,
  prevLeadsCount,
  recentActivity,
  botsList,
}: InitialDashboardData) {
  const router = useRouter()
  const { user, userLoaded, botsCount, refreshBotsCount } = useDashboard()

  const [period, setPeriod]           = useState<Period>('30d')
  const [showWizard, setShowWizard]   = useState(false)
  const [kpiLoading, setKpiLoading]   = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [liveLeads, setLiveLeads]     = useState(leadsCount)
  const [livePrevLeads, setLivePrevLeads] = useState(prevLeadsCount)

  const initial30d = useMemo(
    () => buildKpiCache(transactions, prevTransactions, botsActiveCount, 30, leadsCount, prevLeadsCount),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [realKpi,       setRealKpi]       = useState<RealKpi | null>(initial30d.kpi)
  const [realChartData, setRealChartData] = useState<ChartPoint[]>(initial30d.chart)
  const [realFlows,     setRealFlows]     = useState<RealFlow[]>(initial30d.flows)

  const kpiCacheRef = useRef<Partial<Record<Period, KpiCache>>>({ '30d': initial30d })

  const effectiveBotsTotal = userLoaded ? (botsCount ?? botsTotalCount) : botsTotalCount

  useEffect(() => {
    if (!userLoaded || !user.id) return
    const seen = localStorage.getItem(`umbra_onboarding_seen_${user.id}`)
    if (effectiveBotsTotal === 0 && !seen) setShowWizard(true)
  }, [userLoaded, user.id, effectiveBotsTotal])

  useEffect(() => {
    if (effectiveBotsTotal === 0) {
      setKpiLoading(false)
      setChartLoading(false)
      return
    }

    const cached = kpiCacheRef.current[period]
    if (cached) {
      setRealKpi(cached.kpi)
      setRealChartData(cached.chart)
      setRealFlows(cached.flows)
      setKpiLoading(false)
      setChartLoading(false)
      return
    }

    setKpiLoading(true)
    setChartLoading(true)

    const days      = period === '7d' ? 7 : 90
    const since     = new Date(Date.now() - days * 86_400_000).toISOString()
    const prevSince = new Date(Date.now() - 2 * days * 86_400_000).toISOString()
    const supabase  = createClient()

    Promise.all([
      supabase
        .from('transactions')
        .select('amount, net, created_at, product_name')
        .eq('status', 'approved')
        .gte('created_at', since),
      supabase
        .from('bots')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'online'),
      supabase
        .from('transactions')
        .select('net, amount')
        .eq('status', 'approved')
        .gte('created_at', prevSince)
        .lt('created_at', since),
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', prevSince)
        .lt('created_at', since),
    ]).then(([txRes, botsRes, prevTxRes, leadsRes, prevLeadsRes]) => {
      const txs      = txRes.data     ?? []
      const prevTxs  = prevTxRes.data ?? []
      const newLeads = leadsRes.count  ?? 0
      const prevLds  = prevLeadsRes.count ?? 0

      setLiveLeads(newLeads)
      setLivePrevLeads(prevLds)

      const cache = buildKpiCache(txs, prevTxs, botsRes.count ?? 0, days, newLeads, prevLds)
      kpiCacheRef.current[period] = cache
      setRealKpi(cache.kpi)
      setRealChartData(cache.chart)
      setRealFlows(cache.flows)
      setKpiLoading(false)
      setChartLoading(false)
    })
  }, [effectiveBotsTotal, period])

  const displayKpis: KpiItem[] = realKpi ? [
    {
      id: 'revenue',
      label: `Receita (${period})`,
      value: fmtBRL(realKpi.revenue),
      delta: realKpi.revenueD,
      trend: realKpi.revenueD.startsWith('-') ? 'down' : 'up',
      Icon: TrendingUp,
      tooltip: 'Valor líquido recebido (após taxas) no período selecionado.',
    },
    {
      id: 'sales',
      label: 'Novas vendas',
      value: realKpi.sales.toLocaleString('pt-BR'),
      delta: realKpi.salesD,
      trend: realKpi.salesD.startsWith('-') ? 'down' : 'up',
      Icon: ShoppingBag,
      tooltip: 'Número de transações aprovadas no período.',
    },
    {
      id: 'leads',
      label: 'Leads capturados',
      value: (period === '30d' ? liveLeads : realKpi.leads).toLocaleString('pt-BR'),
      delta: realKpi.leadsD,
      trend: realKpi.leadsD.startsWith('-') ? 'down' : 'up',
      Icon: Users,
      tooltip: 'Novos contatos que iniciaram conversa com seu bot no período.',
    },
    {
      id: 'avgTicket',
      label: 'Ticket médio',
      value: realKpi.avgTicket > 0 ? fmtBRL(realKpi.avgTicket) : '—',
      delta: '',
      trend: 'up',
      Icon: Target,
      tooltip: 'Valor médio por venda aprovada no período.',
    },
    {
      id: 'bots',
      label: 'Bots online',
      value: String(realKpi.botsActive),
      delta: '',
      trend: 'up',
      Icon: Bot,
      tooltip: 'Total de bots com status online no momento.',
    },
  ] : []

  const maxSales = realFlows.length > 0 ? Math.max(...realFlows.map((f) => f.sales)) : 1

  if (effectiveBotsTotal === 0 && !showWizard) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Visão geral da sua operação em tempo real." />
        <EmptyState />
      </>
    )
  }

  return (
    <>
      {showWizard && user.id && (
        <OnboardingWizard
          userId={user.id}
          onComplete={() => {
            localStorage.setItem(`umbra_onboarding_seen_${user.id}`, 'true')
            setShowWizard(false)
            refreshBotsCount()
          }}
        />
      )}

      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da sua operação em tempo real."
        actions={
          <>
            <Link
              href="/dashboard/finance"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium border border-border bg-surface text-text-muted hover:text-text hover:border-border-strong transition-colors"
            >
              <FileText size={13} />
              Financeiro
            </Link>
            <Link
              href="/dashboard/flows"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--primary)' }}
            >
              <Zap size={13} />
              Nova automação
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        {/* Row 1 — KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {kpiLoading
            ? [1, 2, 3, 4, 5].map((i) => <KpiSkeleton key={i} />)
            : displayKpis.map((k) => <KpiCard key={k.id} {...k} />)
          }
        </div>

        {/* Row 2 — Saldo + Bots Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Saldo disponível */}
          <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--success-soft)' }}
            >
              <Wallet size={22} style={{ color: 'var(--success)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-text-muted font-medium mb-0.5">Saldo disponível</div>
              <div className="text-[26px] font-bold tnum tracking-tight text-text leading-none">
                {fmtBRL(balance)}
              </div>
              <div className="text-[11.5px] text-text-muted mt-1">Disponível para saque</div>
            </div>
            <Link
              href="/dashboard/finance"
              className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium px-3 h-8 rounded-lg border border-border hover:border-border-strong transition-colors text-text-muted hover:text-text"
            >
              Ver extrato
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Status dos bots */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[14px] font-semibold text-text">Seus bots</div>
              <Link
                href="/dashboard/bots"
                className="text-[12px] text-text-muted hover:text-text transition-colors flex items-center gap-0.5"
              >
                Ver todos <ArrowRight size={12} />
              </Link>
            </div>
            {botsList.length === 0 ? (
              <p className="text-[12.5px] text-text-muted">Nenhum bot cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {botsList.slice(0, 4).map((bot) => (
                  <div key={bot.id} className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                      style={{ background: bot.color || 'var(--primary)' }}
                    >
                      {bot.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-text truncate">{bot.name}</div>
                      {bot.username && (
                        <div className="text-[11px] text-text-muted">@{bot.username}</div>
                      )}
                    </div>
                    <BotStatusBadge status={bot.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 3 — Gráfico + Top produtos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[14px] font-semibold text-text">Receita ao longo do tempo</div>
                <div className="text-[12px] text-text-muted">
                  Últimos {period === '7d' ? 7 : period === '30d' ? 30 : 90} dias
                </div>
              </div>
              <div className="flex gap-0.5 bg-surface-2 p-0.5 rounded-lg">
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'px-2.5 h-7 text-[11px] font-medium rounded-md tnum transition-colors',
                      period === p
                        ? 'bg-surface text-text border border-border'
                        : 'text-text-muted hover:text-text',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <RevenueChart data={realChartData} loading={chartLoading} />
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[14px] font-semibold text-text">Top produtos</div>
            <div className="text-[12px] text-text-muted mb-4">
              Últimos {period === '7d' ? 7 : period === '30d' ? 30 : 90} dias · dados reais
            </div>
            {chartLoading ? (
              <FlowSkeleton />
            ) : realFlows.length === 0 ? (
              <p className="text-[12.5px] text-text-muted">Nenhuma venda no período.</p>
            ) : (
              <div className="space-y-3.5">
                {realFlows.map((f) => (
                  <div key={f.id}>
                    <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                      <span className="truncate font-medium text-text">{f.name}</span>
                      <span className="tnum text-text-muted shrink-0 ml-2">{f.sales} vendas</span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(f.sales / maxSales) * 100}%`, background: f.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 4 — Atividade Recente + Ações Rápidas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Atividade recente */}
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-semibold text-text">Atividade recente</div>
              <Link
                href="/dashboard/activity"
                className="text-[12px] text-text-muted hover:text-text transition-colors flex items-center gap-0.5"
              >
                Ver tudo <ArrowRight size={12} />
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity size={28} className="text-text-subtle mb-2" />
                <p className="text-[12.5px] text-text-muted">Nenhuma atividade ainda.</p>
                <p className="text-[11.5px] text-text-subtle mt-0.5">Os eventos aparecerão aqui em tempo real.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.map((ev) => {
                  const meta = ACTIVITY_META[ev.type] ?? { label: ev.type, color: 'var(--text-muted)' }
                  const Icon = ACTIVITY_ICONS[ev.type] ?? Activity
                  return (
                    <div key={ev.id} className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `color-mix(in oklab, ${meta.color} 15%, transparent)` }}
                      >
                        <Icon size={13} style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12.5px] font-medium text-text">{ev.title}</span>
                          <span
                            className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ color: meta.color, background: `color-mix(in oklab, ${meta.color} 12%, transparent)` }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.description && (
                            <span className="text-[11.5px] text-text-muted truncate">{ev.description}</span>
                          )}
                          {ev.amount && ev.amount > 0 && (
                            <span className="text-[11.5px] font-semibold shrink-0" style={{ color: 'var(--success)' }}>
                              {fmtBRL(ev.amount)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-subtle mt-0.5">
                          {ev.bot && <span className="mr-2">@{ev.bot.replace(/^@/, '')}</span>}
                          {getRelTime(ev.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[14px] font-semibold text-text mb-4">Ações rápidas</div>
            <div className="space-y-1.5">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <action.Icon size={14} className="text-text-muted group-hover:text-text transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-text">{action.label}</div>
                    <div className="text-[11px] text-text-muted truncate">{action.desc}</div>
                  </div>
                  <ArrowRight size={13} className="text-text-subtle group-hover:text-text-muted transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
