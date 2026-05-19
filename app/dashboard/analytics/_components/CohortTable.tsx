import { TrendingUp } from 'lucide-react'
import { fmtNum } from '../_utils'
import type { CohortRow } from '../_types'

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

export function CohortTable({ rows }: { rows: CohortRow[] }) {
  if (rows.length === 0) {
    return (
      <Card
        title="Coorte de recompra"
        subtitle="% de clientes que voltaram a comprar nas semanas seguintes"
      >
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <TrendingUp size={28} className="text-text-subtle mb-2" />
          <p className="text-[13px] text-text-muted">Dados insuficientes para calcular coorte.</p>
        </div>
      </Card>
    )
  }

  const nWeeks = rows[0]?.weeks.length ?? 6

  return (
    <Card
      title="Coorte de recompra"
      subtitle="% de clientes que voltaram a comprar nas semanas seguintes"
    >
      <div className="overflow-x-auto -mx-5 px-5 mt-1">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left font-medium pb-2 pr-3 whitespace-nowrap">Coorte</th>
              <th className="text-right font-medium pb-2 pr-4 whitespace-nowrap">Clientes</th>
              {Array.from({ length: nWeeks }, (_, i) => (
                <th key={i} className="text-center font-medium pb-2 px-1 tnum w-[11%]">S{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="py-2 pr-3 text-text whitespace-nowrap">{row.label}</td>
                <td className="py-2 pr-4 text-right text-text-muted tnum whitespace-nowrap">
                  {fmtNum(row.size)}
                </td>
                {Array.from({ length: nWeeks }, (_, i) => {
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
                          title={`${row.label} · S${i} · ${v}%`}
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
        <span>S0 = semana da primeira compra. Células vazias = período ainda não decorrido.</span>
        <div className="flex items-center gap-2">
          <span>Menor</span>
          <span className="flex h-2 w-24 rounded overflow-hidden border border-border">
            {[0.08, 0.2, 0.32, 0.45, 0.58].map((a, i) => (
              <span
                key={i}
                className="flex-1"
                style={{ background: `color-mix(in oklab, var(--primary) ${a * 100}%, transparent)` }}
              />
            ))}
          </span>
          <span>Maior</span>
        </div>
      </div>
    </Card>
  )
}
