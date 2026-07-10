'use client'
import { nodeTypes } from '../_shared/nodeTypes'
import type { FlowNodeType } from '../_shared/types'
import { snapGrid, nodeUid } from '../_shared/constants'
import { NODE_W, NODE_H } from '../_shared/nodeTypes'

interface Props {
  onAdd: (node: FlowNodeType) => void
  canvasCenter: { x: number; y: number }
}

const CATEGORIES: Array<{ label: string; types: string[] }> = [
  { label: 'Conversa', types: ['message', 'question', 'buttons'] },
  { label: 'Lógica', types: ['condition', 'delay'] },
  { label: 'Comercial', types: ['offer', 'pix', 'checkout', 'upsell', 'downsell', 'orderbump', 'delivery'] },
  { label: 'Mídia', types: ['image', 'video', 'gallery', 'link'] },
  { label: 'CRM', types: ['tag', 'phone', 'handoff', 'remarketing', 'noreply'] },
]

function buildNode(type: string, center: { x: number; y: number }): FlowNodeType {
  const t = nodeTypes[type]
  return {
    id: nodeUid(),
    type,
    position: {
      x: snapGrid(center.x - NODE_W / 2),
      y: snapGrid(center.y - NODE_H / 2),
    },
    data: { ...(t?.defaultData ?? {}) },
  }
}

export default function Palette({ onAdd, canvasCenter }: Props) {
  const handleAdd = (type: string) => onAdd(buildNode(type, canvasCenter))

  const handleDragStart = (e: React.DragEvent, type: string) => {
    // Para o canvas usar no drop
    e.dataTransfer.setData('application/x-flow-node', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto w-[180px] shrink-0"
      style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Nós
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Clique ou arraste
        </p>
      </div>
      {CATEGORIES.map(cat => (
        <div key={cat.label} className="px-2 py-2">
          <p className="text-xs font-medium px-1 mb-1" style={{ color: 'var(--text-muted)' }}>
            {cat.label}
          </p>
          {cat.types.map(type => {
            const t = nodeTypes[type]
            if (!t) return null
            return (
              <button
                key={type}
                draggable
                onDragStart={e => handleDragStart(e, type)}
                onClick={() => handleAdd(type)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-left hover:bg-surface-2 transition-colors mb-0.5 cursor-grab active:cursor-grabbing"
                style={{ color: 'var(--text)' }}
                title={t.description}
              >
                <t.Icon size={14} style={{ color: t.color }} />
                <span className="text-xs">{t.label}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
