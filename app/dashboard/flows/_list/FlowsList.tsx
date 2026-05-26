'use client'
import { Plus, LayoutTemplate, Search, X, ChevronDown } from 'lucide-react'
import { useState, useMemo } from 'react'
import FlowCard from './FlowCard'
import NoDataState from './NoDataState'
import type { FlowMeta } from '../_shared/types'

interface Props {
  flows: FlowMeta[]
  onCreate: () => void
  onOpenTemplates: () => void
  onOpen: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

type SortKey = 'updated' | 'name' | 'revenue' | 'executions' | 'conversion'
type StatusFilter = 'all' | 'published' | 'draft'

const SORT_LABELS: Record<SortKey, string> = {
  updated:     'Mais recentes',
  name:        'Nome (A→Z)',
  revenue:     'Maior receita',
  executions:  'Mais execuções',
  conversion:  'Maior conversão',
}

export default function FlowsList({ flows, onCreate, onOpenTemplates, onOpen, onDuplicate, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [botFilter, setBotFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [sortOpen, setSortOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [botOpen, setBotOpen] = useState(false)

  // Lista de bots vinculados aos fluxos (para o filtro)
  const botOptions = useMemo(() => {
    const m = new Map<string, string>()
    flows.forEach(f => { if (f.bot) m.set(f.bot, f.bot) })
    return Array.from(m.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [flows])

  // Aplica filtros
  const filtered = useMemo(() => {
    let list = flows

    if (search.trim().length > 0) {
      const q = search.toLowerCase().trim()
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.bot.toLowerCase().includes(q)
      )
    }

    if (status !== 'all') {
      list = list.filter(f => f.status === status)
    }

    if (botFilter !== 'all') {
      list = list.filter(f => f.bot === botFilter)
    }

    // Ordenação
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':       return a.name.localeCompare(b.name, 'pt-BR')
        case 'revenue':    return (b.revenue ?? 0) - (a.revenue ?? 0)
        case 'executions': return b.executions - a.executions
        case 'conversion': return b.conversion - a.conversion
        case 'updated':
        default:           return b.updatedAt - a.updatedAt
      }
    })

    return list
  }, [flows, search, status, botFilter, sortKey])

  const hasFilter = search.trim() !== '' || status !== 'all' || botFilter !== 'all'

  function clearAll() {
    setSearch('')
    setStatus('all')
    setBotFilter('all')
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Fluxos de venda</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} {filtered.length === 1 ? 'fluxo' : 'fluxos'}
            {hasFilter && flows.length !== filtered.length && (
              <span style={{ color: 'var(--text-muted)' }}> · {flows.length} no total</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-surface-2"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <LayoutTemplate size={16} />
            Templates
          </button>
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
          >
            <Plus size={16} />
            Novo fluxo
          </button>
        </div>
      </div>

      {/* Filter bar (só aparece se já tem fluxos) */}
      {flows.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, descrição, bot…"
              className="w-full pl-9 pr-9 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-2"
              >
                <X size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="relative">
            <button
              onClick={() => setStatusOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
            >
              Status: {status === 'all' ? 'Todos' : status === 'published' ? 'Publicados' : 'Rascunhos'}
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-lg shadow-xl py-1 w-44"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {(['all', 'published', 'draft'] as StatusFilter[]).map(s => (
                    <button
                      key={s}
                      onClick={() => { setStatus(s); setStatusOpen(false) }}
                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-2"
                      style={{
                        color: 'var(--text)',
                        background: s === status ? 'color-mix(in oklab, var(--primary) 8%, transparent)' : undefined,
                      }}
                    >
                      {s === 'all' ? 'Todos' : s === 'published' ? 'Publicados' : 'Rascunhos'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bot filter (só se tiver 2+ bots vinculados) */}
          {botOptions.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setBotOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
              >
                Bot: {botFilter === 'all' ? 'Todos' : botFilter}
                <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
              {botOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBotOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[180px] max-h-60 overflow-y-auto"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <button
                      onClick={() => { setBotFilter('all'); setBotOpen(false) }}
                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-2"
                      style={{
                        color: 'var(--text)',
                        background: botFilter === 'all' ? 'color-mix(in oklab, var(--primary) 8%, transparent)' : undefined,
                      }}>
                      Todos os bots
                    </button>
                    {botOptions.map(b => (
                      <button
                        key={b}
                        onClick={() => { setBotFilter(b); setBotOpen(false) }}
                        className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-2"
                        style={{
                          color: 'var(--text)',
                          background: b === botFilter ? 'color-mix(in oklab, var(--primary) 8%, transparent)' : undefined,
                        }}>
                        {b}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
            >
              Ordenar: {SORT_LABELS[sortKey]}
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[180px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {(Object.entries(SORT_LABELS) as Array<[SortKey, string]>).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => { setSortKey(k); setSortOpen(false) }}
                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-2"
                      style={{
                        color: 'var(--text)',
                        background: k === sortKey ? 'color-mix(in oklab, var(--primary) 8%, transparent)' : undefined,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {hasFilter && (
            <button
              onClick={clearAll}
              className="px-3 py-2 rounded-lg text-sm transition-colors hover:bg-surface-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {flows.length === 0 ? (
        <NoDataState onCreate={onCreate} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Nenhum fluxo encontrado
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Ajuste os filtros ou crie um novo fluxo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(flow => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onOpen={() => onOpen(flow.id)}
              onDuplicate={() => onDuplicate(flow.id)}
              onDelete={() => onDelete(flow.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
