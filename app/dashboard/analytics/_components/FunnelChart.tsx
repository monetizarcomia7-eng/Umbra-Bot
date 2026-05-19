import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtNum, fmtPct } from '../_utils'
import type { FunnelStage } from '../_types'

function Card({ title, subtitle, action, children }: {
  title?: string; subtitle?: string; action?: React.ReactNode; children?: React.ReactNode
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
      <div className="px-5 pb-5">{children}</div>
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

export function FunnelChart({
  stages,
  compare,
}: {
  stages: FunnelStage[]
  compare: boolean
}) {
  const hasData = stages.some((s) => s.value > 0)

  if (!hasData) {
    return (
      <Card title="Funil de conversão" subtitle="Do primeiro clique à compra aprovada">
        <EmptyState message="Nenhum dado no período selecionado." />
      </Card>
    )
  }

  const top     = stages[0].value || 1
  const last    = stages[stages.length - 1]
  const overall = (last.value / top) * 100

  return (
    <Card
      title="Funil de conversão"
      subtitle="Do primeiro clique à compra aprovada"
      action={
        <div className="text-right">
          <div className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">Conv. total</div>
          <div className="text-[18px] font-semibold tnum text-text leading-none mt-0.5">
            {fmtPct(overall)}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
        {stages.map((s, i) => {
          const prev       = i > 0 ? stages[i - 1] : null
          const stepConv   = prev && prev.value > 0 ? (s.value / prev.value) * 100 : null
          const ofTop      = top > 0 ? (s.value / top) * 100 : 0
          const periodDelta =
            compare && s.prev > 0
              ? ((s.value - s.prev) / s.prev) * 100
              : null

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
                  <span className="text-text font-medium tnum">{fmtPct(stepConv, 1)}</span>{' '}da anterior
                </div>
              )}

              {periodDelta !== null && (
                <div className="mt-1.5">
                  <span className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium text-[10.5px]',
                    periodDelta >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                  )}>
                    {periodDelta >= 0
                      ? <ArrowUpRight size={10} />
                      : <ArrowDownRight size={10} />}
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
