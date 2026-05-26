'use client'
import { Plus, LayoutTemplate } from 'lucide-react'
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

export default function FlowsList({ flows, onCreate, onOpenTemplates, onOpen, onDuplicate, onDelete }: Props) {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Fluxos de venda</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {flows.length} {flows.length === 1 ? 'fluxo' : 'fluxos'}
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

      {/* Content — Fix #4: no dashed "Criar novo fluxo" card */}
      {flows.length === 0 ? (
        <NoDataState onCreate={onCreate} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {flows.map(flow => (
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
