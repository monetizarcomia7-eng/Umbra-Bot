'use client'

import React from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/dashboard/Button'
import { TrendingUp, ShoppingBag, Target, Bot, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'

const revenue30d = Array.from({ length: 30 }, (_, i) => {
  const base = 4200 + i * 95
  const noise = Math.sin(i * 0.9) * 700 + (i % 6 === 0 ? 1200 : 0)
  return { day: String(i + 1).padStart(2, '0'), value: Math.round(base + noise) }
})

const kpis = [
  { id: 'revenue',    label: 'Receita (30 d)',    value: 'R$ 184.320,00', delta: '+12,4%', trend: 'up'   as const, Icon: TrendingUp  },
  { id: 'sales',      label: 'Novas vendas',      value: '1.284',         delta: '+8,1%',  trend: 'up'   as const, Icon: ShoppingBag },
  { id: 'conversion', label: 'Taxa de conversão', value: '6,82%',         delta: '–0,4%',  trend: 'down' as const, Icon: Target      },
  { id: 'bots',       label: 'Bots ativos',       value: '14',            delta: '+2',     trend: 'up'   as const, Icon: Bot         },
]

const topFlows = [
  { id: 1, name: 'Funil VIP → Mentoria',    sales: 287, conv: 9.4, color: 'var(--primary)' },
  { id: 2, name: 'Upsell Pós-compra',       sales: 198, conv: 7.1, color: 'var(--success)' },
  { id: 3, name: 'Carrinho abandonado 24h', sales: 142, conv: 5.8, color: 'var(--warning)' },
  { id: 4, name: 'Lançamento Black',        sales: 96,  conv: 4.2, color: 'var(--danger)'  },
]

function KpiCard({ label, value, delta, trend, Icon }: {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  Icon: React.ElementType
}) {
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

function RevenueChart() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return <div style={{ height: 240 }} />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={revenue30d} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
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
          interval={4}
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

export default function DashboardPage() {
  const maxSales = Math.max(...topFlows.map((f) => f.sales))

  return (
    <DashboardLayout>
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
          {kpis.map((k) => <KpiCard key={k.id} {...k} />)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[14px] font-semibold text-text">Receita ao longo do tempo</div>
                <div className="text-[12px] text-text-muted">Últimos 30 dias</div>
              </div>
              <div className="flex gap-0.5 bg-surface-2 p-0.5 rounded-lg">
                {(['7d', '30d', '90d'] as const).map((p, i) => (
                  <button
                    key={p}
                    className={cn(
                      'px-2.5 h-7 text-[11px] font-medium rounded-md tnum',
                      i === 1
                        ? 'bg-surface text-text border border-border'
                        : 'text-text-muted hover:text-text',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <RevenueChart />
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
