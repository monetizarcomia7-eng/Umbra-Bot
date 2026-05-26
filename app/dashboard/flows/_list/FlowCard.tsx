'use client'
import { MoreHorizontal, Copy, Trash2, Globe, FileText } from 'lucide-react'
import { useState } from 'react'
import { fmtBRLdec, fmtNum, fmtDate, flowStatusMap } from '../_shared/mappers'
import type { FlowMeta } from '../_shared/types'

interface Props {
  flow: FlowMeta
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function FlowCard({ flow, onOpen, onDuplicate, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const st = flowStatusMap[flow.status] ?? flowStatusMap.draft

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md relative group"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ background: flow.botColor || 'var(--primary)', color: '#fff' }}>
            {(flow.bot || 'F')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
              {flow.name}
            </p>
            {flow.bot && (
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                @{flow.bot}
              </p>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-2"
          >
            <MoreHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 rounded-xl shadow-xl py-1 w-40"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setMenuOpen(false); onDuplicate() }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-2"
                  style={{ color: 'var(--text)' }}
                >
                  <Copy size={14} /> Duplicar
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-2"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash2 size={14} /> Apagar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-3"
        style={{ background: st.bg, color: st.color }}>
        {flow.status === 'published' ? <Globe size={10} /> : <FileText size={10} />}
        {st.label}
      </span>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Receita</p>
          {/* Fix #3: always show value, never '—' */}
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {fmtBRLdec(flow.revenue ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Execuções</p>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {fmtNum(flow.executions)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Conversão</p>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {flow.conversion > 0 ? `${flow.conversion.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        Atualizado {fmtDate(flow.updatedAt)}
      </p>
    </div>
  )
}
