'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/dashboard/Button'
import { TrendingUp, ShoppingBag, Target, Bot, ArrowUpRight, ArrowDownRight, CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard'

type Period = '7d' | '30d' | '90d'

interface KpiItem {
  id: string
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  Icon: React.ElementType
}

interface ChartPoint { day: string; value: number }

function genChartData(days: number): ChartPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const base  = 4200 + i * (95 * 30 / days)
    const noise = Math.sin(i * 0.9) * 700 + (i % 6 === 0 ? 1200 : 0)
    return { day: String(i + 1).padStart(2, '0'), value: Math.round(base + noise) }
  })
}

const KPI_BY_PERIOD: Record<Period, KpiItem[]> = {
  '7d': [
    { id: 'revenue',    label: 'Receita (7 d)',     value: 'R$ 42.180,00',   delta: '+9,2%',  trend: 'up',   Icon: TrendingUp  },
    { id: 'sales',      label: 'Novas vendas',       value: '294',            delta: '+6,4%',  trend: 'up',   Icon: ShoppingBag },
    { id: 'conversion', label: 'Taxa de conversão',  value: '7,14%',          delta: '+0,3%',  trend: 'up',   Icon: Target      },
    { id: 'bots',       label: 'Bots ativos',        value: '14',             delta: '+2',     trend: 'up',   Icon: Bot         },
  ],
  '30d': [
    { id: 'revenue',    label: 'Receita (30 d)',    value: 'R$ 184.320,00',  delta: '+12,4%', trend: 'up',   Icon: TrendingUp  },
    { id: 'sales',      label: 'Novas vendas',      value: '1.284',          delta: '+8,1%',  trend: 'up',   Icon: ShoppingBag },
    { id: 'conversion', label: 'Taxa de conversão', value: '6,82%',          delta: '–0,4%',  trend: 'down', Icon: Target      },
    { id: 'bots',       label: 'Bots ativos',       value: '14',             delta: '+2',     trend: 'up',   Icon: Bot         },
  ],
  '90d': [
    { id: 'revenue',    label: 'Receita (90 d)',    value: 'R$ 527.840,00',  delta: '+18,7%', trend: 'up',   Icon: TrendingUp  },
    { id: 'sales',      label: 'Novas vendas',      value: '3.812',          delta: '+14,3%', trend: 'up',   Icon: ShoppingBag },
    { id: 'conversion', label: 'Taxa de conversão', value: '6,61%',          delta: '–0,8%',  trend: 'down', Icon: Target      },
    { id: 'bots',       label: 'Bots ativos',       value: '14',             delta: '+2',     trend: 'up',   Icon: Bot         },
  ],
}

const topFlows = [
  { id: 1, name: 'Funil VIP → Mentoria',    sales: 287, conv: 9.4, color: 'var(--primary)' },
  { id: 2, name: 'Upsell Pós-compra',       sales: 198, conv: 7.1, color: 'var(--success)' },
  { id: 3, name: 'Carrinho abandonado 24h', sales: 142, conv: 5.8, color: 'var(--warning)' },
  { id: 4, name: 'Lançamento Black',        sales: 96,  conv: 4.2, color: 'var(--danger)'  },
]

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
    </div>
  )
}

function RevenueChart({ data }: { data: ChartPoint[] }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return <div style={{ height: 240 }} />

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

const ONBOARDING_STEPS = [
  { label: 'Criar conta',             href: null,                  done: true  },
  { label: 'Conectar seu primeiro bot', href: '/dashboard/bots',   done: false },
  { label: 'Configurar gateway de pagamento', href: '/dashboard/gateways', done: false },
  { label: 'Criar seu primeiro fluxo de venda', href: '/dashboard/flows', done: false },
]

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-[520px] text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'var(--primary-soft, #ede9fe)' }}>
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
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e2e8f0)' }}>
              {step.done
                ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                : <Circle size={18} className="shrink-0" style={{ color: 'var(--border, #e2e8f0)' }} />
              }
              <span className="flex-1 text-sm font-medium" style={{ color: step.done ? 'var(--text-muted, #64748b)' : 'var(--text, #0f172a)' }}>
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

        <Link href="/dashboard/bots"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'var(--primary, #7c3aed)' }}>
          Conectar meu bot agora
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}

interface RealKpi { revenue: number; sales: number; botsActive: number }

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [botsCount,  setBotsCount]  = useState<number | null>(null)
  const [userId,     setUserId]     = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [realKpi,    setRealKpi]    = useState<RealKpi | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })

    supabase
      .from('bots')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        const n = count ?? 0
        setBotsCount(n)
        if (n === 0) setShowWizard(true)
      })
  }, [])

  // Fetch real KPIs from transactions table
  useEffect(() => {
    if (!botsCount) return
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const supabase = createClient()

    Promise.all([
      supabase.from('transactions').select('amount, net').eq('status', 'approved').gte('created_at', since),
      supabase.from('bots').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]).then(([txRes, botsRes]) => {
      const txs = txRes.data ?? []
      setRealKpi({
        revenue: txs.reduce((s, t) => s + Number(t.net ?? t.amount ?? 0), 0),
        sales: txs.length,
        botsActive: botsRes.count ?? 0,
      })
    })
  }, [botsCount, period])

  const chartData = useMemo(() => genChartData(period === '7d' ? 7 : period === '30d' ? 30 : 90), [period])
  const kpis      = KPI_BY_PERIOD[period]
  const maxSales  = Math.max(...topFlows.map((f) => f.sales))

  const fmtBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)

  const displayKpis: KpiItem[] = realKpi ? [
    { id: 'revenue',    label: `Receita (${period})`,  value: fmtBRL(realKpi.revenue),          delta: '',      trend: 'up',   Icon: TrendingUp  },
    { id: 'sales',      label: 'Novas vendas',          value: realKpi.sales.toLocaleString('pt-BR'), delta: '', trend: 'up',   Icon: ShoppingBag },
    { id: 'conversion', label: 'Taxa de conversão',     value: '—',                              delta: '',      trend: 'up',   Icon: Target      },
    { id: 'bots',       label: 'Bots ativos',           value: String(realKpi.botsActive),       delta: '',      trend: 'up',   Icon: Bot         },
  ] : kpis

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
      {showWizard && userId && (
        <OnboardingWizard
          userId={userId}
          onComplete={() => {
            setShowWizard(false)
            // Refresh bots count after wizard
            const supabase = createClient()
            supabase.from('bots').select('id', { count: 'exact', head: true })
              .then(({ count }) => setBotsCount(count ?? 0))
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {displayKpis.map((k) => <KpiCard key={k.id} {...k} />)}
        </div>

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
            <RevenueChart data={chartData} />
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[14px] font-semibold text-text">Top fluxos de venda</div>
            <div className="text-[12px] text-text-muted mb-4">Últimos 7 dias</div>
            <div className="space-y-3.5">
              {topFlows.map((f) => (
                <div key={f.id}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                    <span className="truncate font-medium text-text">{f.name}</span>
                    <span className="tnum text-text-muted shrink-0 ml-2">{f.sales}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(f.sales / maxSales) * 100}%`, background: f.color }}
                    />
                  </div>
                  <div className="text-[11px] text-text-muted mt-1 tnum">
                    Conversão {String(f.conv).replace('.', ',')}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
