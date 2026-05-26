'use client'
import { ArrowRightLeft, Trash2 } from 'lucide-react'
import type { FlowEdgeType, FlowNodeType } from '../_shared/types'

// Fix #6: No absolute positioning — renders as full-width content in the right docked panel

interface Props {
  edge: FlowEdgeType | undefined
  nodes: FlowNodeType[]
  reconnecting: boolean
  onStartReconnect: () => void
  onCancelReconnect: () => void
  onDelete: () => void
}

export default function EdgePanel({ edge, nodes, reconnecting, onStartReconnect, onCancelReconnect, onDelete }: Props) {
  if (!edge) return null

  const srcNode = nodes.find(n => n.id === edge.source)
  const tgtNode = nodes.find(n => n.id === edge.target)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Conexão
        </p>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>De</p>
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
            {srcNode?.data.text ?? srcNode?.type ?? edge.source}
          </p>
          <p className="text-xs mt-2 mb-1" style={{ color: 'var(--text-muted)' }}>Para</p>
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
            {tgtNode?.data.text ?? tgtNode?.type ?? edge.target}
          </p>
        </div>

        {reconnecting ? (
          <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--warning)/10', border: '1px solid var(--warning)' }}>
            <p className="font-medium mb-2" style={{ color: 'var(--warning)' }}>
              Clique no nó de destino para redirecionar
            </p>
            <button
              onClick={onCancelReconnect}
              className="text-xs px-3 py-1 rounded-lg transition-colors hover:bg-surface-2"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={onStartReconnect}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-surface-2"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <ArrowRightLeft size={14} />
            Redirecionar destino
          </button>
        )}

        <button
          onClick={onDelete}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-surface-2"
          style={{ border: '1px solid var(--danger)/30', color: 'var(--danger)' }}
        >
          <Trash2 size={14} />
          Remover conexão
        </button>
      </div>
    </div>
  )
}
