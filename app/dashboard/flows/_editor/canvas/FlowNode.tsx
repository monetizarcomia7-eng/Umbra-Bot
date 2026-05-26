'use client'
import { nodeTypes, NODE_W, NODE_H } from '../../_shared/nodeTypes'
import { getNodePreview, getButtonHandleX } from '../../_shared/constants'
import NodeHandle from './NodeHandle'
import type { FlowNodeType, FlowEdgeType } from '../../_shared/types'

interface Props {
  node: FlowNodeType
  isSelected: boolean
  isStart: boolean  // Fix #1: single boolean comparison
  connecting: { nodeId: string; handle: number } | null
  onMouseDown: (e: React.MouseEvent, id: string) => void
  onDoubleClick: (id: string) => void
  onStartConnect: (nodeId: string, handle: number) => void
  onEndConnect: (nodeId: string) => void
}

const NODE_COLORS: Record<string, { bg: string; accent: string }> = {
  message:    { bg: 'var(--primary)',  accent: 'var(--primary)' },
  question:   { bg: 'var(--info)',     accent: 'var(--info)' },
  buttons:    { bg: 'var(--warning)',  accent: 'var(--warning)' },
  condition:  { bg: 'oklch(0.6 0.15 280)', accent: 'oklch(0.6 0.15 280)' },
  delay:      { bg: 'var(--text-muted)', accent: 'var(--text-muted)' },
  offer:      { bg: 'var(--success)', accent: 'var(--success)' },
  tag:        { bg: 'var(--danger)',  accent: 'var(--danger)' },
  handoff:    { bg: 'var(--text-muted)', accent: 'var(--text-muted)' },
  image:      { bg: 'oklch(0.7 0.12 200)', accent: 'oklch(0.7 0.12 200)' },
  video:      { bg: 'oklch(0.65 0.14 240)', accent: 'oklch(0.65 0.14 240)' },
  link:       { bg: 'oklch(0.7 0.12 160)', accent: 'oklch(0.7 0.12 160)' },
  checkout:   { bg: 'var(--success)', accent: 'var(--success)' },
  phone:      { bg: 'var(--info)',    accent: 'var(--info)' },
  upsell:     { bg: 'oklch(0.65 0.18 30)', accent: 'oklch(0.65 0.18 30)' },
  downsell:   { bg: 'var(--warning)', accent: 'var(--warning)' },
  orderbump:  { bg: 'oklch(0.6 0.18 300)', accent: 'oklch(0.6 0.18 300)' },
  remarketing:{ bg: 'var(--danger)',  accent: 'var(--danger)' },
}

export default function FlowNode({ node, isSelected, isStart, connecting, onMouseDown, onDoubleClick, onStartConnect, onEndConnect }: Props) {
  const t = nodeTypes[node.type]
  const colors = NODE_COLORS[node.type] ?? { bg: 'var(--primary)', accent: 'var(--primary)' }
  const preview = getNodePreview(node)
  const x = node.position.x
  const y = node.position.y

  const outputCount = t?.outputs === -1
    ? Math.max(2, node.data.options?.length ?? 2)
    : (t?.outputs ?? 1)

  return (
    <g
      onMouseDown={e => onMouseDown(e, node.id)}
      onDoubleClick={() => onDoubleClick(node.id)}
      style={{ cursor: 'grab' }}
    >
      {/* START badge — Fix #1: only one node gets this */}
      {isStart && (
        <text
          x={x + NODE_W / 2}
          y={y - 8}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="var(--warning)"
          letterSpacing={1}
        >
          ▷ INÍCIO
        </text>
      )}

      {/* Card background */}
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={12}
        fill="var(--surface)"
        stroke={isSelected ? 'var(--primary)' : 'var(--border)'}
        strokeWidth={isSelected ? 2 : 1}
        filter={isSelected ? 'drop-shadow(0 0 8px color-mix(in oklab, var(--primary) 40%, transparent))' : undefined}
      />

      {/* Accent left bar */}
      <rect
        x={x + 2}
        y={y + 10}
        width={3}
        height={NODE_H - 20}
        rx={2}
        fill={colors.accent}
      />

      {/* Type label */}
      <text
        x={x + 16}
        y={y + 22}
        fontSize={9}
        fontWeight={600}
        fill={colors.accent}
        style={{ textTransform: 'uppercase' }}
      >
        {t?.label ?? node.type}
      </text>

      {/* Preview text */}
      <foreignObject x={x + 16} y={y + 30} width={NODE_W - 32} height={NODE_H - 44}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text)',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
          }}
        >
          {preview}
        </div>
      </foreignObject>

      {/* Input handle */}
      <NodeHandle
        x={x + NODE_W / 2}
        y={y}
        kind="input"
        nodeId={node.id}
        handleIdx={-1}
        connecting={connecting}
        onStartConnect={onStartConnect}
        onEndConnect={onEndConnect}
      />

      {/* Output handle(s) */}
      {t?.outputs !== 0 && outputCount === 1 && (
        <NodeHandle
          x={x + NODE_W / 2}
          y={y + NODE_H}
          kind="output"
          nodeId={node.id}
          handleIdx={0}
          connecting={connecting}
          onStartConnect={onStartConnect}
          onEndConnect={onEndConnect}
        />
      )}

      {t?.outputs !== 0 && outputCount > 1 && Array.from({ length: outputCount }).map((_, i) => {
        const hx = node.type === 'buttons'
          ? x + getButtonHandleX(i, outputCount)
          : i === 0 ? x + 50 : x + NODE_W - 50
        const label = node.type === 'condition'
          ? (i === 0 ? 'Sim' : 'Não')
          : node.data.options?.[i] ?? `${i + 1}`
        return (
          <NodeHandle
            key={i}
            x={hx}
            y={y + NODE_H}
            kind="output"
            nodeId={node.id}
            handleIdx={i}
            connecting={connecting}
            onStartConnect={onStartConnect}
            onEndConnect={onEndConnect}
            label={outputCount > 1 ? label?.slice(0, 10) : undefined}
          />
        )
      })}
    </g>
  )
}
