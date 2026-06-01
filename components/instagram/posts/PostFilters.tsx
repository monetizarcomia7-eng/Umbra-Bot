'use client'

import { Search, X } from 'lucide-react'
import type { RawIgPost, RawIgAccount } from '@/app/dashboard/instagram/page'

type StatusFilter = 'all' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all:        'Todos',
  scheduled:  'Agendados',
  publishing: 'Publicando',
  published:  'Publicados',
  failed:     'Falhos',
  cancelled:  'Cancelados',
}

interface Props {
  posts:           RawIgPost[]
  accounts:        RawIgAccount[]
  statusFilter:    StatusFilter
  accountFilter:   string
  search:          string
  onStatusChange:  (s: StatusFilter) => void
  onAccountChange: (a: string) => void
  onSearchChange:  (q: string) => void
}

export default function PostFilters({
  posts, accounts, statusFilter, accountFilter, search,
  onStatusChange, onAccountChange, onSearchChange,
}: Props) {
  const statusCounts = (Object.keys(STATUS_LABELS) as StatusFilter[]).reduce((acc, s) => {
    acc[s] = s === 'all' ? posts.length : posts.filter(p => p.status === s).length
    return acc
  }, {} as Record<StatusFilter, number>)

  const hasFilters = statusFilter !== 'all' || accountFilter !== 'all' || search.trim() !== ''

  return (
    <div className="rounded-xl p-3 space-y-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Status chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(s => {
          const active = statusFilter === s
          const count = statusCounts[s]
          return (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5"
              style={{
                background: active ? 'var(--primary)' : 'var(--surface-2)',
                color:      active ? 'var(--accent-fg)' : 'var(--text)',
              }}
            >
              {STATUS_LABELS[s]}
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: active ? 'rgba(255,255,255,0.2)' : 'var(--surface)',
                  color:      active ? 'var(--accent-fg)' : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Account + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={accountFilter}
          onChange={e => onAccountChange(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <option value="all">Todas as contas</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>@{a.username ?? '—'}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar na legenda…"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              onStatusChange('all')
              onAccountChange('all')
              onSearchChange('')
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            <X size={12} />
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}
