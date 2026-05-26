'use client'

interface Props {
  x: number
  y: number
  kind: 'input' | 'output'
  nodeId: string
  handleIdx: number
  connecting: { nodeId: string; handle: number } | null
  onStartConnect: (nodeId: string, handle: number) => void
  onEndConnect: (nodeId: string) => void
  label?: string
}

export default function NodeHandle({
  x, y, kind, nodeId, handleIdx, connecting, onStartConnect, onEndConnect, label
}: Props) {
  const isConnecting = connecting !== null
  const isSource = connecting?.nodeId === nodeId && connecting?.handle === handleIdx

  if (kind === 'input') {
    return (
      <circle
        cx={x}
        cy={y}
        r={6}
        fill="var(--surface)"
        stroke="var(--primary)"
        strokeWidth={2}
        style={{ cursor: isConnecting ? 'crosshair' : 'default' }}
        onMouseUp={e => {
          e.stopPropagation()
          if (isConnecting && connecting?.nodeId !== nodeId) {
            onEndConnect(nodeId)
          }
        }}
      />
    )
  }

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={6}
        fill={isSource ? 'var(--primary)' : 'var(--surface)'}
        stroke="var(--primary)"
        strokeWidth={2}
        style={{ cursor: 'crosshair' }}
        onMouseDown={e => {
          e.stopPropagation()
          onStartConnect(nodeId, handleIdx)
        }}
      />
      {label && (
        <text
          x={x}
          y={y + 16}
          textAnchor="middle"
          fontSize={10}
          fill="var(--text-muted)"
        >
          {label}
        </text>
      )}
    </g>
  )
}
