'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/dashboard/Button'
import { useDashboard } from '@/providers/DashboardProvider'
import {
  TrendingUp, ShoppingBag, Target, Bot,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Circle, ArrowRight,
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
}

interface RealKpi { revenue: number; sales: number; botsActive: number }
interface RealFlow { id: number; name: string; sales: number; conv: number; color: string }

const ONBOARDING_STEPS = [
  { label: 'Criar conta',                    href: null,                    done: true  },
  { label: 'Conectar seu primeiro bot',       href: '/dashboard/bots',       done: false },
  { label: 'Configurar gateway de pagamento', href: '/dashboard/gateways',   done: false },
  { label: 'Criar seu primeiro fluxo de venda', href: '/dashboard/flows',   done: false },
]

/* ── Skeleton ────────────────────────────────────────────────────────── */

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

function KpiCard({ label, value, delta, trend, Icon }: KpiItem) {
  const positive = trend === 'up'
  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
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
          <span className="text-text-muted">vs. período anterior</span>
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Receita']}
          labelFormatter={(d) => `Dia ${d}`}
        />
        <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#revGrad)" />
      </AreaChart>
    </ResponsiveContainer>
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

/* ── Page ────────────────────────────────────────────────────────────── */

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)

export default function DashboardPage() {
  const { user, userLoaded, botsCount, refreshBotsCount } = useDashboard()
  const [period, setPeriod] = useState<Period>('30d')
  const [showWizard, setShowWizard] = useState(false)

  const [kpiLoading,   setKpiLoading]   = useState(true)
  const [chartLoading, setChartLoading] = useState(true)
  const [realKpi,       setRealKpi]       = useState<RealKpi | null>(null)
  const [realChartData, setRealChartData] = useState<ChartPoint[]>([])
  const [realFlows,     setRealFlows]     = useState<RealFlow[]>([])

  // Decide whether to show onboarding wizard (once, per user)
  useEffect(() => {
    if (!userLoaded || botsCount === null || !user.id) return
    const seen = localStorage.getItem(`umbra_onboarding_seen_${user.id}`)
    if (botsCount === 0 && !seen) setShowWizard(true)
  }, [userLoaded, botsCount, user.id])

  // Fetch real KPIs whenever period or botsCount changes
  useEffect(() => {
    if (botsCount === null || botsCount === 0) {
      setKpiLoading(false)
      setChartLoading(false)
      return
    }

    setKpiLoading(true)
    setChartLoading(true)

    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const supabase = createClient()

    Promise.all([
      supabase
        .from('transactions')
        .select('amount, net, created_at, product_name')
        .eq('status', 'approved')
        .gte('created_at', since),
      supabase.from('bots').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]).then(([txRes, botsRes]) => {
      const txs = txRes.data ?? []

      setRealKpi({
        revenue:    txs.reduce((s, t) => s + Number(t.net ?? t.amount ?? 0), 0),
        sales:      txs.length,
        botsActive: botsRes.count ?? 0,
      })
      setKpiLoading(false)

      const byDay: Record<string, number> = {}
      for (const tx of txs) {
        const key = String(tx.created_at).slice(0, 10)
        byDay[key] = (byDay[key] ?? 0) + Number(tx.net ?? tx.amount ?? 0)
      }
      const points: ChartPoint[] = Array.from({ length: days }, (_, i) => {
        const d   = new Date(Date.now() - (days - 1 - i) * 86_400_000)
        const key = d.toISOString().slice(0, 10)
        return { day: String(i + 1).padStart(2, '0'), value: byDay[key] ?? 0 }
      })
      setRealChartData(points)
      setChartLoading(false)

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
      setRealFlows(flows)
    })
  }, [botsCount, period])

  const displayKpis: KpiItem[] = realKpi ? [
    { id: 'revenue',    label: `Receita (${period})`,  value: fmtBRL(realKpi.revenue),               delta: '', trend: 'up',   Icon: TrendingUp  },
    { id: 'sales',      label: 'Novas vendas',          value: realKpi.sales.toLocaleString('pt-BR'), delta: '', trend: 'up',   Icon: ShoppingBag },
    { id: 'conversion', label: 'Taxa de conversão',     value: '—',                                   delta: '', trend: 'up',   Icon: Target      },
    { id: 'bots',       label: 'Bots ativos',           value: String(realKpi.botsActive),            delta: '', trend: 'up',   Icon: Bot         },
  ] : []

  const maxSales = realFlows.length > 0 ? Math.max(...realFlows.map((f) => f.sales)) : 1

  // Loading: context not yet resolved
  if (!userLoaded || botsCount === null) {
    return (
      <DashboardLayout>
        <PageHeader title="Dashboard" subtitle="Visão geral da sua operação em tempo real." />
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <KpiSkeleton key={i} />)}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // No bots yet — show empty state (wizard handled separately)
  if (botsCount === 0 && !showWizard) {
    return (
      <DashboardLayout>
        <PageHeader title="Dashboard" subtitle="Visão geral da sua operação em tempo real." />
        <EmptyState />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
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
            <Button variant="secondary" icon="download">Exportar</Button>
            <Button variant="primary" icon="plus">Nova automação</Button>
          </>
        }
      />

      <div className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {kpiLoading
            ? [1, 2, 3, 4].map((i) => <KpiSkeleton key={i} />)
            : displayKpis.map((k) => <KpiCard key={k.id} {...k} />)
          }
        </div>

        {/* Chart + top produtos */}
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
      </div>
    </DashboardLayout>
  )
}
