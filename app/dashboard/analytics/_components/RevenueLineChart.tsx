'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DayRevenue } from '../_types'
import { fmtBRL, fmtNum } from '../_utils'

interface Props {
  data: DayRevenue[]
}

export function RevenueLineChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<'revenue' | 'sales'>('revenue')

  useEffect(() => setMounted(true), [])

  const isEmpty = data.length === 0 || data.every((d) =>
    (mode === 'revenue' ? d.revenue : d.sales) === 0,
  )

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] font-semibold text-text">Evolução no período</p>
          <p className="text-[11.5px] text-text-muted">
            {mode === 'revenue'
              ? 'Receita líquida aprovada por dia'
              : 'Vendas aprovadas por dia'}
          </p>
        </div>
        <div
          className="flex gap-0.5 p-0.5 rounded-lg border border-border"
          style={{ background: 'var(--surface-2)' }}
        >
          {(['revenue', 'sales'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 h-7 text-[12px] font-medium rounded-md transition-colors"
              style={{
                background: mode === m ? 'var(--surface)' : 'transparent',
                color:      mode === m ? 'var(--text)'    : 'var(--text-muted)',
                boxShadow:  mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {m === 'revenue' ? 'Receita' : 'Vendas'}
            </button>
          ))}
        </div>
      </div>

      {!mounted ? (
        <div className="h-[160px] animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
      ) : isEmpty ? (
        <div
          className="h-[160px] flex items-center justify-center text-[13px]"
          style={{ color: 'var(--text-subtle)' }}
        >
          Nenhuma venda no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) =>
                mode === 'revenue'
                  ? v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                  : String(v)
              }
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              formatter={(v) => {
                const n = Number(v ?? 0)
                return mode === 'revenue'
                  ? [fmtBRL(n), 'Receita']
                  : [fmtNum(n), 'Vendas']
              }}
              labelStyle={{ color: 'var(--text)', fontSize: 12 }}
              contentStyle={{
                background:   'var(--surface)',
                border:       '1px solid var(--border)',
                borderRadius: 8,
                fontSize:     12,
                color:        'var(--text)',
              }}
            />
            <Area
              type="monotone"
              dataKey={mode === 'revenue' ? 'revenue' : 'sales'}
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
