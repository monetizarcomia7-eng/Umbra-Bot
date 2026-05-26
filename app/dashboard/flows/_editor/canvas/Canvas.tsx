'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { snapGrid } from '../../_shared/constants'
import { NODE_W, NODE_H } from '../../_shared/nodeTypes'
import FlowEdges from './FlowEdges'
import FlowNode from './FlowNode'
import type { FlowNodeType, FlowEdgeType } from '../../_shared/types'

interface CanvasProps {
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
  vp: { x: number; y: number; zoom: number }
  setVp: React.Dispatch<React.SetStateAction<{ x: number; y: number; zoom: number }>>
  selectedIds: Set<string>
  selectedEdgeId: string | null
  onSelectNode: (id: string | null, shift?: boolean) => void
  onSelectNodes: (ids: string[]) => void
  onSelectEdge: (id: string | null) => void
  onUpdateNode: (n: FlowNodeType) => void
  onUpdateNodes: (ns: FlowNodeType[]) => void
  onAddEdge: (e: FlowEdgeType) => void
  onDragEnd: () => void
  connecting: { nodeId: string; handle: number } | null
  setConnecting: React.Dispatch<React.SetStateAction<{ nodeId: string; handle: number } | null>>
  containerRef: React.RefObject<HTMLDivElement | null>
  reconnectEdgeId: string | null
  onReconnectEdge: (edgeId: string, targetId: string) => void
}

interface DragState {
  nodeId: string
  startX: number
  startY: number
  origPositions: Map<string, { x: number; y: number }>
}

interface PanState {
  startX: number
  startY: number
  origVp: { x: number; y: number }
}

interface BoxState {
  startX: number
  startY: number
  curX: number
  curY: number
}

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2

export default function Canvas({
  nodes, edges, vp, setVp, selectedIds, selectedEdgeId,
  onSelectNode, onSelectNodes, onSelectEdge, onUpdateNode, onUpdateNodes,
  onAddEdge, onDragEnd, connecting, setConnecting, containerRef,
  reconnectEdgeId, onReconnectEdge,
}: CanvasProps) {
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [panning, setPanning] = useState<PanState | null>(null)
  const [boxSelect, setBoxSelect] = useState<BoxState | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  const bgPannedRef = useRef(false)

  // Fix #1: single startNodeId string (first node with no incoming edges)
  const startNodeId = (() => {
    const hasIncoming = new Set(edges.map(e => e.target))
    return nodes.find(n => !hasIncoming.has(n.id))?.id ?? null
  })()

  const toCanvas = useCallback((cx: number, cy: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (cx - rect.left - vp.x) / vp.zoom,
      y: (cy - rect.top - vp.y) / vp.zoom,
    }
  }, [containerRef, vp])

  const onNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (connecting) return

    movedRef.current = false

    const origPositions = new Map<string, { x: number; y: number }>()
    const ids = selectedIds.has(id) ? [...selectedIds] : [id]
    ids.forEach(nid => {
      const n = nodes.find(x => x.id === nid)
      if (n) origPositions.set(nid, { ...n.position })
    })

    setDragging({ nodeId: id, startX: e.clientX, startY: e.clientY, origPositions })
  }, [connecting, selectedIds, nodes])

  const onNodeDoubleClick = useCallback((id: string) => {
    onSelectNode(id)
  }, [onSelectNode])

  const onBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    bgPannedRef.current = false

    if (e.shiftKey) {
      const pos = toCanvas(e.clientX, e.clientY)
      setBoxSelect({ startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y })
      return
    }

    setPanning({ startX: e.clientX, startY: e.clientY, origVp: { x: vp.x, y: vp.y } })
  }, [vp, toCanvas])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging) {
        // Fix #5: drag threshold 10px
        const movedEnough = Math.abs(e.clientX - dragging.startX) > 10 ||
          Math.abs(e.clientY - dragging.startY) > 10
        if (movedEnough) {
          movedRef.current = true
          const dx = (e.clientX - dragging.startX) / vp.zoom
          const dy = (e.clientY - dragging.startY) / vp.zoom
          const ids = selectedIds.has(dragging.nodeId) ? [...selectedIds] : [dragging.nodeId]
          const updated = nodes.map(n => {
            const orig = dragging.origPositions.get(n.id)
            if (!orig) return n
            return { ...n, position: { x: snapGrid(orig.x + dx), y: snapGrid(orig.y + dy) } }
          })
          onUpdateNodes(updated.filter(n => ids.includes(n.id)))
        }
      }

      if (panning) {
        const dx = e.clientX - panning.startX
        const dy = e.clientY - panning.startY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) bgPannedRef.current = true
        setVp({ x: panning.origVp.x + dx, y: panning.origVp.y + dy, zoom: vp.zoom })
      }

      if (boxSelect) {
        const pos = toCanvas(e.clientX, e.clientY)
        setBoxSelect(b => b ? { ...b, curX: pos.x, curY: pos.y } : null)
      }

      if (connecting) {
        const pos = toCanvas(e.clientX, e.clientY)
        setMousePos(pos)
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (dragging) {
        if (movedRef.current) onDragEnd()
        setDragging(null)
      }

      if (panning) setPanning(null)

      if (boxSelect) {
        const minX = Math.min(boxSelect.startX, boxSelect.curX)
        const maxX = Math.max(boxSelect.startX, boxSelect.curX)
        const minY = Math.min(boxSelect.startY, boxSelect.curY)
        const maxY = Math.max(boxSelect.startY, boxSelect.curY)
        const selected = nodes
          .filter(n =>
            n.position.x + NODE_W > minX && n.position.x < maxX &&
            n.position.y + NODE_H > minY && n.position.y < maxY
          )
          .map(n => n.id)
        if (selected.length > 0) onSelectNodes(selected)
        setBoxSelect(null)
      }

      if (connecting) {
        setConnecting(null)
        setMousePos(null)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, panning, boxSelect, connecting, vp, nodes, selectedIds, toCanvas, onUpdateNodes, onDragEnd, setVp, setConnecting])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * delta))
    setVp({
      x: cx - (cx - vp.x) * (newZoom / vp.zoom),
      y: cy - (cy - vp.y) * (newZoom / vp.zoom),
      zoom: newZoom,
    })
  }, [vp, containerRef, setVp])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (bgPannedRef.current) return
    onSelectNode(null)
    onSelectEdge(null)
  }, [onSelectNode, onSelectEdge])

  const startConnect = useCallback((nodeId: string, handle: number) => {
    if (reconnectEdgeId) return
    setConnecting({ nodeId, handle })
  }, [reconnectEdgeId, setConnecting])

  const endConnect = useCallback((targetId: string) => {
    if (!connecting) return
    if (connecting.nodeId === targetId) { setConnecting(null); setMousePos(null); return }
    if (reconnectEdgeId) {
      onReconnectEdge(reconnectEdgeId, targetId)
    } else {
      const exists = edges.some(e => e.source === connecting.nodeId && e.target === targetId && (e.sourceHandle ?? 0) === connecting.handle)
      if (!exists) {
        onAddEdge({
          id: `e-${Date.now()}`,
          source: connecting.nodeId,
          target: targetId,
          sourceHandle: connecting.handle,
        })
      }
    }
    setConnecting(null)
    setMousePos(null)
  }, [connecting, reconnectEdgeId, edges, onAddEdge, onReconnectEdge, setConnecting])

  const boxRect = boxSelect ? {
    x: Math.min(boxSelect.startX, boxSelect.curX),
    y: Math.min(boxSelect.startY, boxSelect.curY),
    w: Math.abs(boxSelect.curX - boxSelect.startX),
    h: Math.abs(boxSelect.curY - boxSelect.startY),
  } : null

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="w-full h-full overflow-hidden select-none"
      style={{
        background: 'var(--surface-2)',
        backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1px)`,
        backgroundSize: `${20 * vp.zoom}px ${20 * vp.zoom}px`,
        backgroundPosition: `${vp.x}px ${vp.y}px`,
        cursor: panning ? 'grabbing' : connecting ? 'crosshair' : 'default',
      }}
      onMouseDown={onBgMouseDown}
      onClick={handleClick}
      onWheel={onWheel}
    >
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <g transform={`translate(${vp.x},${vp.y}) scale(${vp.zoom})`} style={{ pointerEvents: 'all' }}>
          <FlowEdges
            nodes={nodes}
            edges={edges}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={onSelectEdge}
            connecting={connecting}
            mousePos={mousePos}
          />
          {nodes.map(n => (
            <FlowNode
              key={n.id}
              node={n}
              isSelected={selectedIds.has(n.id)}
              isStart={n.id === startNodeId}  // Fix #1: single string comparison
              connecting={connecting}
              onMouseDown={onNodeMouseDown}
              onDoubleClick={onNodeDoubleClick}
              onStartConnect={startConnect}
              onEndConnect={endConnect}
            />
          ))}
          {boxRect && (
            <rect
              x={boxRect.x}
              y={boxRect.y}
              width={boxRect.w}
              height={boxRect.h}
              fill="var(--primary)"
              fillOpacity={0.08}
              stroke="var(--primary)"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}
        </g>
      </svg>
    </div>
  )
}
