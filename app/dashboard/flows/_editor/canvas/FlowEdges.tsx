'use client'
import { bezierPath, getHandlePos, getButtonHandleX } from '../../_shared/constants'
import { nodeTypes, NODE_W, NODE_H } from '../../_shared/nodeTypes'
import type { FlowNodeType, FlowEdgeType } from '../../_shared/types'

interface Props {
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
  selectedEdgeId: string | null
  onSelectEdge: (id: string | null) => void
  connecting: { nodeId: string; handle: number } | null
  mousePos: { x: number; y: number } | null
}

export default function FlowEdges({ nodes, edges, selectedEdgeId, onSelectEdge, connecting, mousePos }: Props) {
  const nodeById = new Map(nodes.map(n => [n.id, n]))

  return (
    <g>
      {edges.map(edge => {
        const src = nodeById.get(edge.source)
        const tgt = nodeById.get(edge.target)
        if (!src || !tgt) return null

        const oi = edge.sourceHandle ?? 0
        const sp = getHandlePos(src, 'output', oi)
        const tp = getHandlePos(tgt, 'input')
        const d = bezierPath(sp.x, sp.y, tp.x, tp.y)
        const isSelected = edge.id === selectedEdgeId

        const t = nodeTypes[src.type]
        let color = 'var(--primary)'
        if (src.type === 'condition') {
          color = oi === 0 ? 'var(--success)' : 'var(--danger)'
        } else if (src.type === 'buttons') {
          const colors = ['var(--primary)', 'var(--warning)', 'var(--info)', 'oklch(0.7 0.15 300)']
          color = colors[oi % colors.length]
        }

        return (
          <g key={edge.id} onClick={e => { e.stopPropagation(); onSelectEdge(edge.id) }}>
            <path d={d} stroke="transparent" strokeWidth={12} fill="none" style={{ cursor: 'pointer' }} />
            <path
              d={d}
              stroke={isSelected ? 'var(--warning)' : color}
              strokeWidth={isSelected ? 2.5 : 1.5}
              fill="none"
              strokeDasharray={isSelected ? '6 3' : undefined}
              style={{ transition: 'stroke 0.15s' }}
            />
            {edge.label && (() => {
              const mx = (sp.x + tp.x) / 2
              const my = (sp.y + tp.y) / 2
              return (
                <g>
                  <rect x={mx - 20} y={my - 9} width={40} height={18} rx={4}
                    fill="var(--surface)" stroke={color} strokeWidth={1} />
                  <text x={mx} y={my + 4} textAnchor="middle" fontSize={9}
                    fill="var(--text-muted)">{edge.label}</text>
                </g>
              )
            })()}
          </g>
        )
      })}

      {/* Live connection line while dragging */}
      {connecting && mousePos && (() => {
        const src = nodeById.get(connecting.nodeId)
        if (!src) return null
        const sp = getHandlePos(src, 'output', connecting.handle)
        const d = bezierPath(sp.x, sp.y, mousePos.x, mousePos.y)
        return (
          <path d={d} stroke="var(--primary)" strokeWidth={1.5} fill="none"
            strokeDasharray="6 3" style={{ pointerEvents: 'none' }} />
        )
      })()}
    </g>
  )
}
