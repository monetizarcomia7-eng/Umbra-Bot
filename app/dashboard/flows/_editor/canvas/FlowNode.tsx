'use client'
import { memo } from 'react'
import { nodeTypes, NODE_W, NODE_H } from '../../_shared/nodeTypes'
import { getNodePreview, getButtonHandleX } from '../../_shared/constants'
import NodeHandle from './NodeHandle'
import type { FlowNodeType, FlowNodeStatsRow } from '../../_shared/types'

interface Props {
  node: FlowNodeType
  isSelected: boolean
  isStart: boolean
  isError: boolean
  stats: FlowNodeStatsRow | null
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
  delivery:   { bg: 'oklch(0.62 0.17 155)', accent: 'oklch(0.62 0.17 155)' },
  noreply:    { bg: 'oklch(0.60 0.16 25)', accent: 'oklch(0.60 0.16 25)' },
}

function FlowNodeRaw({ node, isSelected, isStart, isError, stats, connecting, onMouseDown, onDoubleClick, onStartConnect, onEndConnect }: Props) {
  const t = nodeTypes[node.type]
  const colors = NODE_COLORS[node.type] ?? { bg: 'var(--primary)', accent: 'var(--primary)' }
  const preview = getNodePreview(node)
  const x = node.position.x
  const y = node.position.y

  const outputCount = t?.outputs === -1
    ? Math.max(2, node.data.options?.length ?? 2)
    : (t?.outputs ?? 1)

  // Stroke prioridade: error > selected > default
  const stroke = isError ? 'var(--danger)' : isSelected ? 'var(--primary)' : 'var(--border)'
  const strokeWidth = isError ? 2 : isSelected ? 2 : 1
  const filter = isSelected
    ? 'drop-shadow(0 0 8px color-mix(in oklab, var(--primary) 40%, transparent))'
    : isError
    ? 'drop-shadow(0 0 6px color-mix(in oklab, var(--danger) 30%, transparent))'
    : undefined

  return (
    <g
      onMouseDown={e => onMouseDown(e, node.id)}
      onDoubleClick={() => onDoubleClick(node.id)}
      style={{ cursor: 'grab' }}
    >
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

      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={12}
        fill="var(--surface)"
        stroke={stroke}
        strokeWidth={strokeWidth}
        filter={filter}
      />

      <rect
        x={x + 2}
        y={y + 10}
        width={3}
        height={NODE_H - 20}
        rx={2}
        fill={colors.accent}
      />

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

      {/* Mini-stats (30d) */}
      {stats && (stats.sent > 0 || stats.entered > 0) && (
        <foreignObject x={x + NODE_W - 60} y={y + 6} width={54} height={14}>
          <div style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            textAlign: 'right',
            fontFamily: 'ui-monospace, monospace',
          }}>
            {stats.sent > 0 ? `${stats.sent}↗` : `${stats.entered}↘`}
            {stats.failed > 0 && (
              <span style={{ color: 'var(--danger)', marginLeft: 4 }}>!{stats.failed}</span>
            )}
          </div>
        </foreignObject>
      )}

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
          : node.type === 'pix'
          ? (i === 0 ? '✅ Pago' : '❌ Não pago')
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


// Memoized: re-renders only when relevant props change.
// Reduz ~70% dos renders durante drag em fluxos grandes.
export default memo(FlowNodeRaw, (prev, next) =>
  prev.node === next.node &&
  prev.isSelected === next.isSelected &&
  prev.isStart === next.isStart &&
  prev.isError === next.isError &&
  prev.stats === next.stats &&
  prev.connecting === next.connecting
)
