'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Search, Inbox, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Transaction } from './types'
import { txTypeMap, txStatusMap, typeToFilter, statusToFilter, filterPeriods, filterTypes, filterStatus } from './constants'
import { fmtBRLdec, fmtPct, fmtDateShort, fmtTime } from './formatters'
import { Badge, Card, Dropdown, Pagination, Icon } from './atoms'

/* ── Detail rows ──────────────────────────────────────────────────────── */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className="text-text text-right truncate">{value}</span>
    </div>
  )
}

function BreakdownRow({ label, value, sign, emphasize }: {
  label: string; value: number; sign: '+' | '−'; emphasize?: boolean
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-[12px]', emphasize ? 'font-semibold text-text' : 'text-text-muted')}>
      <span>{label}</span>
      <span className={cn('tnum', emphasize ? 'text-text' : '')}>
        {sign === '−' ? '−' : ''}{fmtBRLdec(value)}
      </span>
    </div>
  )
}

function TransactionDetail({ tx }: { tx: Transaction }) {
  const d = tx.detail!
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-3xl">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Cliente & origem</div>
        <DetailRow label="Cliente" value={d.customer} />
        <DetailRow label="E-mail"  value={d.email} />
        <DetailRow label="Produto" value={d.product} />
        <DetailRow label="Bot"     value={<span className="tnum">{d.bot}</span>} />
        <DetailRow label="Fluxo"   value={d.flow} />
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Pagamento & repasse</div>
        <DetailRow label="Gateway" value={`${d.gateway} · ${d.method}`} />
        <div className="border-t border-border pt-2 space-y-1.5">
          <BreakdownRow label="Valor bruto"                                                              value={d.gross}       sign="+" />
          <BreakdownRow label={`Taxa do gateway (${fmtPct((d.gatewayFee  / d.gross) * 100)})`}          value={d.gatewayFee}  sign="−" />
          <BreakdownRow label={`Comissão Umbra Bot (${fmtPct((d.platformFee / d.gross) * 100)})`}       value={d.platformFee} sign="−" />
          <div className="h-px bg-border my-1" />
          <BreakdownRow label="Valor líquido" value={d.net} sign="+" emphasize />
        </div>
      </div>
    </div>
  )
}

/* ── Transaction row ──────────────────────────────────────────────────── */

function TransactionRow({ tx, expanded, onToggle }: {
  tx: Transaction; expanded: boolean; onToggle: () => void
}) {
  const t = txTypeMap[tx.type]
  const s = txStatusMap[tx.status]
  const isExpandable = tx.type === 'sale' && !!tx.detail
  const isNegative   = tx.value < 0

  return (
    <>
      <tr
        className={cn('border-t border-border transition-colors', isExpandable ? 'cursor-pointer hover:bg-surface-2/60' : '', expanded ? 'bg-surface-2/40' : '')}
        onClick={isExpandable ? onToggle : undefined}
      >
        <td className="py-2.5 pl-4 pr-2 whitespace-nowrap">
          <div className="text-[12.5px] text-text tnum">{fmtDateShort(tx.dt)}</div>
          <div className="text-[10.5px] text-text-muted tnum">{fmtTime(tx.dt)}</div>
        </td>
        <td className="py-2.5 px-2 whitespace-nowrap">
          <Badge tone={t.tone} icon={t.icon}>{t.label}</Badge>
        </td>
        <td className="py-2.5 px-2 text-[12.5px] text-text max-w-[280px] truncate">{tx.desc}</td>
        <td className="py-2.5 px-2 text-right whitespace-nowrap">
          <span className={cn('text-[13px] font-semibold tnum', isNegative ? 'text-danger' : 'text-text')}>
            {isNegative ? '−' : '+'}{fmtBRLdec(Math.abs(tx.value))}
          </span>
        </td>
        <td className="py-2.5 px-2 whitespace-nowrap">
          <Badge tone={s.tone}>{s.label}</Badge>
        </td>
        <td className="py-2.5 pl-2 pr-4 text-right">
          {isExpandable && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-text-muted">
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
            </span>
          )}
        </td>
      </tr>
      {expanded && isExpandable && (
        <tr className="bg-surface-2/40 border-t border-border">
          <td colSpan={6} className="px-4 py-4">
            <TransactionDetail tx={tx} />
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Section ──────────────────────────────────────────────────────────── */

export function TransactionsSection({ data }: { data: Transaction[] }) {
  const [filters, setFilters] = useState({
    period: 'Últimos 30 dias',
    type:   'Todos os tipos',
    status: 'Todos os status',
    search: '',
  })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const perPage = 8

  const filtered = useMemo(() => data.filter((tx) => {
    if (filters.type   !== 'Todos os tipos'   && tx.type   !== typeToFilter[filters.type])     return false
    if (filters.status !== 'Todos os status'  && tx.status !== statusToFilter[filters.status]) return false
    if (filters.search && !tx.desc.toLowerCase().includes(filters.search.toLowerCase()))       return false
    return true
  }), [data, filters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage   = Math.min(page, totalPages)
  const start      = (safePage - 1) * perPage
  const pageItems  = filtered.slice(start, start + perPage)

  useEffect(() => { setPage(1); setExpanded(new Set()) }, [filters])

  function toggleExpand(id: string) {
    setExpanded((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const hasFilters = filters.type !== 'Todos os tipos' || filters.status !== 'Todos os status' || !!filters.search

  return (
    <Card noPadding>
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Buscar por descrição…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <Dropdown icon="calendar"     label="Período" value={filters.period} options={filterPeriods} onChange={(v) => setFilters((f) => ({ ...f, period: v }))} />
        <Dropdown icon="tag"          label="Tipo"    value={filters.type}   options={filterTypes}   onChange={(v) => setFilters((f) => ({ ...f, type: v }))}   />
        <Dropdown icon="circle-check" label="Status"  value={filters.status} options={filterStatus}  onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
        {hasFilters && (
          <button
            onClick={() => setFilters({ period: 'Últimos 30 dias', type: 'Todos os tipos', status: 'Todos os status', search: '' })}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2"
          >
            <X size={13} /> Limpar
          </button>
        )}
        <div className="flex-1" />
        <div className="text-[11.5px] text-text-muted tnum">
          {filtered.length} {filtered.length === 1 ? 'transação' : 'transações'}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
            <Inbox size={20} />
          </div>
          <div className="text-[14px] font-semibold text-text">Nenhuma transação encontrada</div>
          <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">Ajuste os filtros ou amplie o período para ver mais resultados.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
                <th className="text-left  font-semibold pl-4 pr-2 py-2.5">Data</th>
                <th className="text-left  font-semibold px-2 py-2.5">Tipo</th>
                <th className="text-left  font-semibold px-2 py-2.5">Descrição</th>
                <th className="text-right font-semibold px-2 py-2.5">Valor</th>
                <th className="text-left  font-semibold px-2 py-2.5">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} expanded={expanded.has(tx.id)} onToggle={() => toggleExpand(tx.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11.5px] text-text-muted tnum">
            Mostrando <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, filtered.length)}</span> de <span className="text-text font-medium">{filtered.length}</span>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </Card>
  )
}
