'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, TrendingUp, TrendingDown, AlertCircle, Activity } from 'lucide-react'
import { nodeTypes } from '../../_shared/nodeTypes'

interface FlowMeta {
  id:          string
  name:        string
  status:      string
  bot:         string
  nodes:       Array<{ id: string; type: string; data: Record<string, unknown> }>
  executions:  number
  conversion:  number
  description: string
}

interface NodeStat {
  node_id:        string
  node_type:      string
  entered:        number
  sent:           number
  failed:         number
  completed:      number
  abandoned:      number
  avg_latency_ms: number | null
}

interface TsRow {
  day:        string
  entered:    number
  sent:       number
  failed:     number
  completed:  number
}

interface Kpis {
  totalRevenue: number
  totalSales:   number
  totalLeads:   number
}

interface Props {
  flow:        FlowMeta
  days:        number
  nodesStats:  NodeStat[]
  timeseries:  TsRow[]
  kpis:        Kpis
}

const DAYS_OPTIONS = [7, 14, 30, 90]

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR')
}

export default function AnalyticsClient({ flow, days, nodesStats, timeseries, kpis }: Props) {
  const router = useRouter()
  const [daysOpen, setDaysOpen] = useState(false)

  function changeDays(d: number) {
    setDaysOpen(false)
    router.push(`/dashboard/flows/${flow.id}/analytics?days=${d}`)
  }

  // Conversão calculada: completed / entered no nó inicial × 100
  const startNode = flow.nodes.find(n => !flow.nodes.some(other => false))  // placeholder
  // Conversão real: vamos somar todos os entered do primeiro nó (start)
  // Mas como não temos referência direta ao start aqui, calculamos avg de entered total / total events
  const totalEntered = nodesStats.reduce((s, n) => s + n.entered, 0)
  const totalCompleted = nodesStats.reduce((s, n) => s + n.completed, 0)
  const conversionPeriod = totalEntered > 0 ? (totalCompleted / totalEntered) * 100 : 0

  // Para o funil: pega os 6 primeiros nós únicos (por ordem do array de nodes)
  const orderedNodeIds = flow.nodes.map(n => n.id)
  const nodesStatsMap = new Map(nodesStats.map(s => [s.node_id, s]))
  const funnel = orderedNodeIds
    .map(id => {
      const n = flow.nodes.find(x => x.id === id)
      const s = nodesStatsMap.get(id)
      if (!n) return null
      return {
        id,
        type: n.type,
        label: nodeTypes[n.type]?.label ?? n.type,
        entered: s?.entered ?? 0,
        sent:    s?.sent ?? 0,
        failed:  s?.failed ?? 0,
        completed: s?.completed ?? 0,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 10)

  const maxEntered = funnel.reduce((m, n) => Math.max(m, n.entered), 0) || 1

  // Max do timeseries para escala do gráfico
  const maxTs = timeseries.reduce((m, r) => Math.max(m, r.entered, r.sent, r.failed), 0) || 1

  // Top falhas (nós com mais failed)
  const topFailures = [...nodesStats]
    .filter(s => s.failed > 0)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 5)
    .map(s => ({
      ...s,
      label: nodeTypes[s.node_type]?.label ?? s.node_type,
    }))

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/flows"
            className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>
              Análises · {flow.name}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {flow.status === 'published' ? 'Publicado' : 'Rascunho'}
              {flow.bot && ` · ${flow.bot}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Período */}
          <div className="relative">
            <button
              onClick={() => setDaysOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
            >
              Últimos {days} dias
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
            {daysOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDaysOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[140px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {DAYS_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => changeDays(d)}
                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-2"
                      style={{
                        color: 'var(--text)',
                        background: d === days ? 'color-mix(in oklab, var(--primary) 8%, transparent)' : undefined,
                      }}>
                      Últimos {d} dias
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Link href={`/dashboard/flows`}
            className="px-3 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
            Editar fluxo
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Receita" value={fmtBRL(kpis.totalRevenue)} />
        <KpiCard label="Vendas" value={fmtNum(kpis.totalSales)} />
        <KpiCard label="Leads atribuídos" value={fmtNum(kpis.totalLeads)} />
        <KpiCard label="Conversão (período)" value={
          totalEntered > 0
            ? `${conversionPeriod.toFixed(1)}%`
            : '—'
        } />
      </div>

      {/* Timeseries chart */}
      <div className="rounded-xl p-4 mb-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
          <Activity size={14} className="inline -mt-0.5 mr-1.5" />
          Eventos por dia
        </h2>
        {timeseries.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
            Nenhum evento no período.
          </p>
        ) : (
          <div className="flex items-end gap-1 h-[180px]">
            {timeseries.map(row => {
              const dayLabel = new Date(row.day).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit',
              })
              return (
                <div key={row.day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="flex flex-col items-stretch gap-0.5 w-full" style={{ height: 150 }}>
                    <div title={`Entradas: ${row.entered}`}
                      style={{
                        height: `${(row.entered / maxTs) * 100}%`,
                        background: 'var(--primary)',
                        borderRadius: '2px 2px 0 0',
                        minHeight: row.entered > 0 ? 2 : 0,
                      }}
                    />
                    {row.failed > 0 && (
                      <div title={`Falhas: ${row.failed}`}
                        style={{
                          height: `${(row.failed / maxTs) * 50}%`,
                          background: 'var(--danger)',
                          borderRadius: '0 0 2px 2px',
                        }}
                      />
                    )}
                  </div>
                  <span className="text-[9px] truncate w-full text-center" style={{ color: 'var(--text-muted)' }}>
                    {dayLabel}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex items-center gap-3 mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--primary)' }} /> Entradas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--danger)' }} /> Falhas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Funil */}
        <div className="lg:col-span-2 rounded-xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
            <TrendingDown size={14} className="inline -mt-0.5 mr-1.5" />
            Funil por nó
          </h2>
          {funnel.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
              Sem dados no período.
            </p>
          ) : (
            <div className="space-y-2">
              {funnel.map((n, i) => {
                const pct = (n.entered / maxEntered) * 100
                const dropRate = i > 0 && funnel[i - 1].entered > 0
                  ? ((funnel[i - 1].entered - n.entered) / funnel[i - 1].entered) * 100
                  : 0
                return (
                  <div key={n.id} className="rounded-lg p-2"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                          {i + 1}
                        </span>
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                          {n.label}
                        </span>
                        <span className="text-[10px] font-mono opacity-60" style={{ color: 'var(--text)' }}>
                          {n.id.slice(0, 6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                          {fmtNum(n.entered)}
                        </span>
                        {i > 0 && dropRate > 30 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              background: 'color-mix(in oklab, var(--danger) 12%, transparent)',
                              color: 'var(--danger)',
                            }}>
                            -{dropRate.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface)' }}>
                      <div className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: n.failed > 0 ? 'var(--warning)' : 'var(--primary)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    {(n.sent > 0 || n.failed > 0 || n.completed > 0) && (
                      <div className="flex gap-3 text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {n.sent > 0 && <span>✓ {n.sent} enviados</span>}
                        {n.failed > 0 && <span style={{ color: 'var(--danger)' }}>✗ {n.failed} falhas</span>}
                        {n.completed > 0 && <span style={{ color: 'var(--success)' }}>★ {n.completed} concluíram</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top falhas */}
        <div className="rounded-xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
            <AlertCircle size={14} className="inline -mt-0.5 mr-1.5" style={{ color: 'var(--danger)' }} />
            Nós com mais falhas
          </h2>
          {topFailures.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
              🎉 Nenhuma falha registrada.
            </p>
          ) : (
            <div className="space-y-1.5">
              {topFailures.map(f => (
                <div key={f.node_id} className="rounded-lg p-2 flex items-center justify-between"
                  style={{ background: 'var(--surface-2)' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                      {f.label}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {f.node_id.slice(0, 12)}
                    </p>
                  </div>
                  <span className="text-xs font-bold shrink-0"
                    style={{ color: 'var(--danger)' }}>
                    {fmtNum(f.failed)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela completa */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold p-4 pb-3" style={{ color: 'var(--text)' }}>
          <TrendingUp size={14} className="inline -mt-0.5 mr-1.5" />
          Estatísticas detalhadas por nó
        </h2>
        {nodesStats.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
            Sem dados no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left py-2 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Nó</th>
                  <th className="text-right py-2 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Entrou</th>
                  <th className="text-right py-2 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Enviado</th>
                  <th className="text-right py-2 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Falhou</th>
                  <th className="text-right py-2 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Concluiu</th>
                  <th className="text-right py-2 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Abandonou</th>
                  <th className="text-right py-2 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Latência média</th>
                </tr>
              </thead>
              <tbody>
                {nodesStats.map(s => {
                  const label = nodeTypes[s.node_type]?.label ?? s.node_type
                  return (
                    <tr key={s.node_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 px-4">
                        <div className="font-medium" style={{ color: 'var(--text)' }}>{label}</div>
                        <div className="font-mono text-[10px] opacity-60" style={{ color: 'var(--text)' }}>
                          {s.node_id.slice(0, 14)}
                        </div>
                      </td>
                      <td className="text-right py-2 px-4" style={{ color: 'var(--text)' }}>{fmtNum(s.entered)}</td>
                      <td className="text-right py-2 px-4" style={{ color: 'var(--text)' }}>{fmtNum(s.sent)}</td>
                      <td className="text-right py-2 px-4" style={{
                        color: s.failed > 0 ? 'var(--danger)' : 'var(--text)',
                        fontWeight: s.failed > 0 ? 600 : undefined,
                      }}>{fmtNum(s.failed)}</td>
                      <td className="text-right py-2 px-4" style={{ color: 'var(--success)' }}>{fmtNum(s.completed)}</td>
                      <td className="text-right py-2 px-4" style={{ color: 'var(--text-muted)' }}>{fmtNum(s.abandoned)}</td>
                      <td className="text-right py-2 px-4 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {s.avg_latency_ms != null ? `${s.avg_latency_ms}ms` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
        Dados de telemetria gravados em <code>flow_node_events</code>. TTL: 30 dias.
      </p>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
