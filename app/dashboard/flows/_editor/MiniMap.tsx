'use client'
import { NODE_W, NODE_H } from '../_shared/nodeTypes'
import type { FlowNodeType } from '../_shared/types'

interface Props {
  nodes: FlowNodeType[]
  vp: { x: number; y: number; zoom: number }
  containerW: number
  containerH: number
}

const MAP_W = 140
const MAP_H = 90

export default function MiniMap({ nodes, vp, containerW, containerH }: Props) {
  if (nodes.length === 0) return null

  const allX = nodes.map(n => n.position.x)
  const allY = nodes.map(n => n.position.y)
  const minX = Math.min(...allX) - 20
  const minY = Math.min(...allY) - 20
  const maxX = Math.max(...allX) + NODE_W + 20
  const maxY = Math.max(...allY) + NODE_H + 20
  const boundsW = maxX - minX || 1
  const boundsH = maxY - minY || 1
  const scaleX = MAP_W / boundsW
  const scaleY = MAP_H / boundsH
  const scale = Math.min(scaleX, scaleY)

  return (
    <div
      className="absolute bottom-3 left-3 rounded-lg overflow-hidden shadow-lg"
      style={{
        width: MAP_W,
        height: MAP_H,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <svg width={MAP_W} height={MAP_H}>
        {nodes.map(n => (
          <rect
            key={n.id}
            x={(n.position.x - minX) * scale}
            y={(n.position.y - minY) * scale}
            width={NODE_W * scale}
            height={NODE_H * scale}
            rx={2}
            fill="var(--primary)"
            fillOpacity={0.5}
          />
        ))}
        {/* Viewport rect */}
        <rect
          x={(-vp.x / vp.zoom - minX) * scale}
          y={(-vp.y / vp.zoom - minY) * scale}
          width={(containerW / vp.zoom) * scale}
          height={(containerH / vp.zoom) * scale}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      </svg>
    </div>
  )
}
