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
  const [confirmDel, setConfirmDel] = useState(false)
  const st = flowStatusMap[flow.status] ?? flowStatusMap.draft

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md relative group"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ background: flow.botColor || 'var(--primary)', color: '#fff' }}>
            {(flow.bot || flow.name || 'F')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
              {flow.name}
            </p>
            {flow.bot ? (
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {flow.bot.startsWith('@') ? flow.bot : `@${flow.bot}`}
              </p>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                Sem bot vinculado
              </p>
            )}
          </div>
        </div>

        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-2"
          >
            <MoreHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setMenuOpen(false); setConfirmDel(false) }} />
              <div className="absolute right-0 top-8 z-20 rounded-xl shadow-xl py-1 w-44"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setMenuOpen(false); onDuplicate() }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-2"
                  style={{ color: 'var(--text)' }}
                >
                  <Copy size={14} /> Duplicar
                </button>
                {confirmDel ? (
                  <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                      Apagar fluxo permanentemente?
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setMenuOpen(false); setConfirmDel(false); onDelete() }}
                        className="flex-1 px-2 py-1 text-xs rounded font-medium"
                        style={{ background: 'var(--danger)', color: '#fff' }}
                      >
                        Apagar
                      </button>
                      <button
                        onClick={() => setConfirmDel(false)}
                        className="flex-1 px-2 py-1 text-xs rounded"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDel(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-2"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} /> Apagar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-3"
        style={{ background: st.bg, color: st.color }}>
        {flow.status === 'published' ? <Globe size={10} /> : <FileText size={10} />}
        {st.label}
      </span>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Receita</p>
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

      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        Atualizado {fmtDate(flow.updatedAt)}
      </p>
    </div>
  )
}
