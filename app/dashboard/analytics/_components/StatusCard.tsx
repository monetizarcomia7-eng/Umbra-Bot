'use client'

import React from 'react'
import { TrendingUp } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { fmtNum, fmtPct } from '../_utils'
import type { StatusData } from '../_types'

function Card({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="text-[14px] font-semibold text-text">{title}</div>
        <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  )
}

export function StatusCard({ data }: { data: StatusData[] }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <Card title="Status dos pagamentos" subtitle="Distribuição por status no período">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <TrendingUp size={28} className="text-text-subtle mb-2" />
          <p className="text-[13px] text-text-muted">Nenhum pagamento no período.</p>
        </div>
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
                <Pie
                  data={data}
                  innerRadius={46}
                  outerRadius={66}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: 'var(--shadow-md)',
                    color: 'var(--text)',
                  }}
                  formatter={(v: unknown) => [fmtNum(Number(v)), '']}
                  separator=""
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full rounded-full bg-surface-2 border border-border" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[20px] font-semibold tnum text-text leading-none tracking-tight">
              {fmtNum(total)}
            </div>
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
                <span className="tnum text-text shrink-0 w-12 text-right font-medium">
                  {fmtPct(pct, 1)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
