'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ArrowLeft, LayoutGrid, Settings, Save, Globe,
  Undo2, Redo2, Trash2, History, PlayCircle, BarChart3, FileJson,
} from 'lucide-react'
import type { FlowEditorData, FlowNodeType, FlowEdgeType, RawBotOption, FlowNodeStatsRow } from '../_shared/types'
import { autoLayout, MAX_HISTORY, AUTO_SAVE_MS, nodeUid, validateFlow } from '../_shared/constants'
import { NODE_W, NODE_H, nodeTypes } from '../_shared/nodeTypes'
import { getFlowNodeStatsAction } from '@/app/actions/flows'
import Canvas from './canvas/Canvas'
import Inspector from './inspector/Inspector'
import EdgePanel from './EdgePanel'
import MiniMap from './MiniMap'
import ZoomControls from './ZoomControls'
import PreviewChat from './preview/PreviewChat'
import BotSelector from './BotSelector'
import Palette from './Palette'
import TestRunnerModal from './TestRunnerModal'
import FlowVersionsPanel from './FlowVersionsPanel'
import ImportExportModal from './ImportExportModal'

type Hist = { nodes: FlowNodeType[]; edges: FlowEdgeType[] }

interface Props {
  flow: FlowEditorData
  bots: RawBotOption[]
  onBack: () => void
  onSave: (updated: FlowEditorData) => Promise<boolean>
  onPublish: (updated: FlowEditorData) => Promise<void>
  showToast: (msg: string, type?: 'success' | 'error') => void
}

function MultiSelectPanel({ count, onDelete }: { count: number; onDelete: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {count} nós selecionados
        </p>
      </div>
      <div className="p-4">
        <button
          onClick={onDelete}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
          style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }}
        >
          <Trash2 size={14} />
          Remover selecionados
        </button>
      </div>
    </div>
  )
}

// Hash leve para snapshots (evita JSON.stringify pesado a cada frame)
function hashNodes(nodes: FlowNodeType[]): string {
  return nodes.map(n =>
    `${n.id}:${n.type}:${n.position.x},${n.position.y}:${JSON.stringify(n.data)}`
  ).join('|')
}

function hashEdges(edges: FlowEdgeType[]): string {
  return edges.map(e => `${e.id}:${e.source}>${e.target}:${e.sourceHandle ?? 0}`).join('|')
}

export default function FlowEditor({ flow, bots, onBack, onSave, onPublish, showToast }: Props) {
  // ── Meta state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(flow.name)
  const [nameError, setNameError] = useState(false)
  const [description, setDescription] = useState(flow.description ?? '')
  const [triggerType, setTriggerType] = useState<'start' | 'keyword'>(flow.triggerType ?? 'start')
  const [keywords, setKeywords] = useState<string[]>(flow.keywords ?? [])
  const [kwInput, setKwInput] = useState('')

  // FIX B3: usa bot_id real, não string. Inicializa pelo bot_id do fluxo.
  const [botId, setBotId] = useState<string | null>(flow.botId ?? null)
  const selectedBot = useMemo(
    () => (botId ? bots.find(b => b.id === botId) ?? null : null),
    [botId, bots]
  )
  const botLabel = selectedBot
    ? (selectedBot.username ? `@${selectedBot.username}` : selectedBot.name)
    : flow.bot
  const botColor = selectedBot?.color ?? flow.botColor ?? '#6366f1'

  // ── Graph state ────────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<FlowNodeType[]>(flow.nodes)
  const [edges, setEdges] = useState<FlowEdgeType[]>(flow.edges)

  // ── Viewport ───────────────────────────────────────────────────────────────
  const [vp, setVp] = useState({ x: 0, y: 0, zoom: 1 })
  const [viewportSize, setViewportSize] = useState({ w: 800, h: 600 })
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [reconnectEdgeId, setReconnectEdgeId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<{ nodeId: string; handle: number } | null>(null)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [importExportOpen, setImportExportOpen] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Array<{ nodeId: string | null; message: string }>>([])
  const [showErrors, setShowErrors] = useState(false)
  const [nodeStats, setNodeStats] = useState<Map<string, FlowNodeStatsRow>>(new Map())

  // ── Refs ───────────────────────────────────────────────────────────────────
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const selectedNodeIdsRef = useRef(selectedNodeIds)
  const selectedEdgeIdRef = useRef(selectedEdgeId)
  const histRef = useRef<Hist[]>([{ nodes: flow.nodes, edges: flow.edges }])
  const histIdxRef = useRef(0)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  const isDirtyRef = useRef(false)
  // Clipboard interno (não usa OS clipboard — mais seguro entre fluxos do mesmo user)
  const clipboardRef = useRef<FlowNodeType[]>([])
  // canvasCenter capturado para atalhos sem mouse (N, Ctrl+V)
  const canvasCenterRef = useRef<{ x: number; y: number }>({ x: 400, y: 300 })

  // FIX 1.2: hash inicial (estável, atualizado após cada save bem-sucedido)
  const [initialHash, setInitialHash] = useState(
    `${hashNodes(flow.nodes)}::${hashEdges(flow.edges)}::${flow.name}`
  )

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { selectedNodeIdsRef.current = selectedNodeIds }, [selectedNodeIds])
  useEffect(() => { selectedEdgeIdRef.current = selectedEdgeId }, [selectedEdgeId])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  // ── isDirty: useMemo com hash leve ─────────────────────────────────────────
  // FIX 1.2: substitui JSON.stringify a cada frame
  const isDirty = useMemo(() => {
    const current = `${hashNodes(nodes)}::${hashEdges(edges)}::${name}`
    return current !== initialHash
  }, [nodes, edges, name, initialHash])

  useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])

  // ── Viewport size tracking ─────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setViewportSize({ w: width, h: height })
    })
    ro.observe(el)
    setViewportSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // ── Lazy load: node stats ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    getFlowNodeStatsAction(flow.id, 30).then(rows => {
      if (cancelled) return
      const m = new Map<string, FlowNodeStatsRow>()
      for (const r of rows) m.set(r.node_id, r)
      setNodeStats(m)
    }).catch(() => {/* RPC pode não existir ainda — silencioso */})
    return () => { cancelled = true }
  }, [flow.id])

  // ── History ────────────────────────────────────────────────────────────────
  const pushHistory = useCallback((n: FlowNodeType[], e: FlowEdgeType[]) => {
    const current = histRef.current[histIdxRef.current]
    // FIX médio: evita push duplicado idêntico
    if (current) {
      const sameNodes = hashNodes(current.nodes) === hashNodes(n)
      const sameEdges = hashEdges(current.edges) === hashEdges(e)
      if (sameNodes && sameEdges) return
    }
    const next = histRef.current.slice(0, histIdxRef.current + 1)
    next.push({ nodes: n, edges: e })
    if (next.length > MAX_HISTORY) next.shift()
    histRef.current = next
    histIdxRef.current = next.length - 1
    setCanUndo(histIdxRef.current > 0)
    setCanRedo(false)
  }, [])

  const undoAction = useCallback(() => {
    if (histIdxRef.current <= 0) return
    histIdxRef.current -= 1
    const { nodes: n, edges: e } = histRef.current[histIdxRef.current]
    setNodes(n)
    setEdges(e)
    setCanUndo(histIdxRef.current > 0)
    setCanRedo(true)
  }, [])

  const redoAction = useCallback(() => {
    if (histIdxRef.current >= histRef.current.length - 1) return
    histIdxRef.current += 1
    const { nodes: n, edges: e } = histRef.current[histIdxRef.current]
    setNodes(n)
    setEdges(e)
    setCanUndo(true)
    setCanRedo(histIdxRef.current < histRef.current.length - 1)
  }, [])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const handleUpdateNode = useCallback((n: FlowNodeType) => {
    nodesRef.current = nodesRef.current.map(node => node.id === n.id ? n : node)
    setNodes(nodesRef.current)
  }, [])

  const handleUpdateNodes = useCallback((ns: FlowNodeType[]) => {
    const m = new Map(ns.map(n => [n.id, n]))
    nodesRef.current = nodesRef.current.map(n => m.get(n.id) ?? n)
    setNodes(nodesRef.current)
  }, [])

  const handleAddEdge = useCallback((e: FlowEdgeType) => {
    const next = [...edgesRef.current, e]
    edgesRef.current = next
    setEdges(next)
    pushHistory(nodesRef.current, next)
  }, [pushHistory])

  const handleDragEnd = useCallback(() => {
    pushHistory(nodesRef.current, edgesRef.current)
  }, [pushHistory])

  const handleSelectNode = useCallback((id: string | null, shift?: boolean) => {
    if (id === null) {
      setSelectedNodeIds(new Set())
    } else if (shift) {
      setSelectedNodeIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      })
    } else {
      setSelectedNodeIds(new Set([id]))
    }
    setSelectedEdgeId(null)
  }, [])

  const handleSelectNodes = useCallback((ids: string[]) => {
    setSelectedNodeIds(new Set(ids))
    setSelectedEdgeId(null)
  }, [])

  const handleReconnectEdge = useCallback((edgeId: string, targetId: string) => {
    const next = edgesRef.current.map(e => e.id === edgeId ? { ...e, target: targetId } : e)
    edgesRef.current = next
    setEdges(next)
    setReconnectEdgeId(null)
    pushHistory(nodesRef.current, next)
  }, [pushHistory])

  const handleInspectorChange = useCallback((updated: FlowNodeType) => {
    nodesRef.current = nodesRef.current.map(n => n.id === updated.id ? updated : n)
    setNodes(nodesRef.current)
  }, [])

  const deleteSelected = useCallback(() => {
    const ids = selectedNodeIdsRef.current
    const edgeId = selectedEdgeIdRef.current
    if (ids.size > 0) {
      const newNodes = nodesRef.current.filter(n => !ids.has(n.id))
      const newEdges = edgesRef.current.filter(e => !ids.has(e.source) && !ids.has(e.target))
      setNodes(newNodes)
      setEdges(newEdges)
      setSelectedNodeIds(new Set())
      pushHistory(newNodes, newEdges)
    } else if (edgeId) {
      const newEdges = edgesRef.current.filter(e => e.id !== edgeId)
      setEdges(newEdges)
      setSelectedEdgeId(null)
      pushHistory(nodesRef.current, newEdges)
    }
  }, [pushHistory])

  // Duplica o nó selecionado (atalho D)
  const duplicateSelected = useCallback(() => {
    const ids = selectedNodeIdsRef.current
    if (ids.size === 0) return
    const copies: FlowNodeType[] = []
    nodesRef.current.forEach(n => {
      if (!ids.has(n.id)) return
      copies.push({
        ...n,
        id: nodeUid(),
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        data: { ...n.data },
      })
    })
    const next = [...nodesRef.current, ...copies]
    nodesRef.current = next
    setNodes(next)
    pushHistory(next, edgesRef.current)
    setSelectedNodeIds(new Set(copies.map(c => c.id)))
  }, [pushHistory])

  // Copia nós selecionados para clipboard interno (Ctrl+C)
  const copySelected = useCallback(() => {
    const ids = selectedNodeIdsRef.current
    if (ids.size === 0) return
    clipboardRef.current = nodesRef.current
      .filter(n => ids.has(n.id))
      .map(n => ({ ...n, data: { ...n.data } }))
  }, [])

  // Cola nós do clipboard interno (Ctrl+V) — posicionados no canvasCenter atual
  const pasteFromClipboard = useCallback(() => {
    const clip = clipboardRef.current
    if (clip.length === 0) return

    // Calcula bounding box do clipboard para reposicionar relativo ao centro
    const minX = Math.min(...clip.map(n => n.position.x))
    const minY = Math.min(...clip.map(n => n.position.y))
    const dx = canvasCenterRef.current.x - NODE_W / 2 - minX + 40
    const dy = canvasCenterRef.current.y - NODE_H / 2 - minY + 40

    const copies = clip.map(n => ({
      ...n,
      id: nodeUid(),
      position: { x: n.position.x + dx, y: n.position.y + dy },
      data: { ...n.data },
    }))

    const next = [...nodesRef.current, ...copies]
    nodesRef.current = next
    setNodes(next)
    pushHistory(next, edgesRef.current)
    setSelectedNodeIds(new Set(copies.map(c => c.id)))
  }, [pushHistory])

  // ── Add node from Palette ──────────────────────────────────────────────────
  const handleAddNode = useCallback((node: FlowNodeType) => {
    const updated = [...nodesRef.current, node]
    setNodes(updated)
    pushHistory(updated, edgesRef.current)
    setSelectedNodeIds(new Set([node.id]))
    setSelectedEdgeId(null)
  }, [pushHistory])

  // Adiciona nó message no centro (atalho N)
  const addMessageNodeAtCenter = useCallback(() => {
    const t = nodeTypes.message
    handleAddNode({
      id: nodeUid(),
      type: 'message',
      position: {
        x: Math.round((canvasCenterRef.current.x - NODE_W / 2) / 20) * 20,
        y: Math.round((canvasCenterRef.current.y - NODE_H / 2) / 20) * 20,
      },
      data: { ...(t?.defaultData ?? {}) },
    })
  }, [handleAddNode])

  // Substitui nodes/edges (usado pelo import JSON)
  const replaceGraph = useCallback((next: { nodes: FlowNodeType[]; edges: FlowEdgeType[] }) => {
    nodesRef.current = next.nodes
    edgesRef.current = next.edges
    setNodes(next.nodes)
    setEdges(next.edges)
    setSelectedNodeIds(new Set())
    setSelectedEdgeId(null)
    pushHistory(next.nodes, next.edges)
  }, [pushHistory])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      const meta = e.ctrlKey || e.metaKey

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected()
      } else if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undoAction()
      } else if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redoAction()
      } else if (meta && (e.key === 'c' || e.key === 'C')) {
        // Não interferir se o user está copiando texto selecionado
        const sel = window.getSelection()?.toString()
        if (sel && sel.length > 0) return
        e.preventDefault(); copySelected()
      } else if (meta && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault(); pasteFromClipboard()
      } else if (!meta && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); duplicateSelected()
      } else if (!meta && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault(); addMessageNodeAtCenter()
      } else if (e.key === 'Escape') {
        setSelectedNodeIds(new Set())
        setSelectedEdgeId(null)
        setConnecting(null)
        setReconnectEdgeId(null)
        setShowErrors(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected, undoAction, redoAction, duplicateSelected, copySelected, pasteFromClipboard, addMessageNodeAtCenter])

  // ── Build editor data ──────────────────────────────────────────────────────
  const buildEditorData = useCallback((extra?: Partial<FlowEditorData>): FlowEditorData => {
    return {
      ...flow,
      name,
      description,
      bot: botLabel,
      botId,
      botColor,
      triggerType,
      keywords,
      nodes: nodesRef.current,
      edges: edgesRef.current,
      ...extra,
    }
  }, [flow, name, description, botLabel, botId, botColor, triggerType, keywords])

  // ── Auto-save (30 s debounce) ──────────────────────────────────────────────
  // FIX 1.3: dirty check antes de salvar — não salva fluxo intocado.
  useEffect(() => {
    if (!isDirty || !name.trim()) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return  // double-check
      const ok = await onSaveRef.current(buildEditorData())
      if (ok) {
        setSavedAt(Date.now())
        // Reset baseline para próximas comparações
        setInitialHash(`${hashNodes(nodesRef.current)}::${hashEdges(edgesRef.current)}::${name}`)
      }
    }, AUTO_SAVE_MS)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [isDirty, name, description, botId, triggerType, keywords, buildEditorData])

  // ── Save / Publish ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) {
      setNameError(true)
      showToast('O nome do fluxo não pode ficar vazio.', 'error')
      return
    }
    setSaving(true)
    const ok = await onSave(buildEditorData())
    setSaving(false)
    if (ok) {
      setSavedAt(Date.now())
      setInitialHash(`${hashNodes(nodesRef.current)}::${hashEdges(edgesRef.current)}::${name}`)
      showToast('Rascunho salvo')
    }
  }

  async function handlePublish() {
    if (!name.trim()) {
      setNameError(true)
      showToast('O nome do fluxo não pode ficar vazio.', 'error')
      return
    }
    // Validação antes de publicar
    const errors = validateFlow(nodesRef.current, edgesRef.current)
    if (errors.length > 0) {
      setValidationErrors(errors)
      setShowErrors(true)
      showToast(`${errors.length} ${errors.length === 1 ? 'problema' : 'problemas'} no fluxo. Veja o painel.`, 'error')
      return
    }
    setPublishing(true)
    await onPublish(buildEditorData({ status: 'published' }))
    setPublishing(false)
    setInitialHash(`${hashNodes(nodesRef.current)}::${hashEdges(edgesRef.current)}::${name}`)
  }

  // ── Fit view ───────────────────────────────────────────────────────────────
  function fitView() {
    if (nodes.length === 0) return
    const pad = 40
    const minX = Math.min(...nodes.map(n => n.position.x)) - pad
    const minY = Math.min(...nodes.map(n => n.position.y)) - pad
    const maxX = Math.max(...nodes.map(n => n.position.x + NODE_W)) + pad
    const maxY = Math.max(...nodes.map(n => n.position.y + NODE_H)) + pad
    const scaleX = viewportSize.w / (maxX - minX)
    const scaleY = viewportSize.h / (maxY - minY)
    const zoom = Math.min(scaleX, scaleY, 1.5)
    setVp({
      x: -minX * zoom + (viewportSize.w - (maxX - minX) * zoom) / 2,
      y: -minY * zoom + (viewportSize.h - (maxY - minY) * zoom) / 2,
      zoom,
    })
  }

  const canvasCenter = {
    x: (-vp.x + viewportSize.w / 2) / vp.zoom,
    y: (-vp.y + viewportSize.h / 2) / vp.zoom,
  }

  // Mantém canvasCenterRef sempre atualizado para atalhos sem mouse
  useEffect(() => {
    canvasCenterRef.current = canvasCenter
    // canvasCenter recriado a cada render; usamos só x/y (números primitivos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasCenter.x, canvasCenter.y])

  // ── Edge reconnect ─────────────────────────────────────────────────────────
  function handleStartReconnect() {
    if (selectedEdgeId) setReconnectEdgeId(selectedEdgeId)
  }
  function handleCancelReconnect() { setReconnectEdgeId(null) }
  function handleDeleteEdge(edgeId: string) {
    const updated = edgesRef.current.filter(e => e.id !== edgeId)
    setEdges(updated)
    setSelectedEdgeId(null)
    setReconnectEdgeId(null)
    pushHistory(nodesRef.current, updated)
  }

  function zoomIn()  { setVp(v => ({ ...v, zoom: Math.min(v.zoom * 1.2, 3) })) }
  function zoomOut() { setVp(v => ({ ...v, zoom: Math.max(v.zoom / 1.2, 0.2) })) }

  function addKeyword() {
    const kw = kwInput.trim()
    if (!kw || keywords.includes(kw)) return
    setKeywords(prev => [...prev, kw])
    setKwInput('')
  }

  // ── Auto-layout ────────────────────────────────────────────────────────────
  async function handleAutoLayout() {
    const laid = await autoLayout(nodesRef.current, edgesRef.current)
    setNodes(laid)
    pushHistory(laid, edgesRef.current)
    showToast('Fluxo organizado')
  }

  // ── Derived selection ──────────────────────────────────────────────────────
  const singleSelectedId = selectedNodeIds.size === 1 ? [...selectedNodeIds][0] : null
  const selectedNode = singleSelectedId
    ? nodes.find(n => n.id === singleSelectedId) ?? null
    : null
  const activeEdgeId = reconnectEdgeId ?? selectedEdgeId
  const selectedEdge = activeEdgeId
    ? edges.find(e => e.id === activeEdgeId)
    : undefined

  const savedLabel = savedAt
    ? new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      {/* ── Topbar ── */}
      <div
        className="flex items-center gap-2 px-3 border-b shrink-0"
        style={{ height: 60, background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => (isDirty ? setBackConfirmOpen(true) : onBack())}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-sm shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={15} />
          <span className="hidden sm:inline">Fluxos</span>
        </button>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'var(--border)' }} />

        <input
          value={name}
          onChange={e => { setName(e.target.value); setNameError(false) }}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none px-2 py-1 rounded"
          style={{
            color: 'var(--text)',
            border: nameError ? '1px solid var(--danger)' : '1px solid transparent',
          }}
          placeholder="Nome do fluxo"
        />

        {/* Bot selector — FIX B3: usa bot_id real */}
        {bots.length > 0 && (
          <div className="shrink-0">
            <BotSelector
              bots={bots}
              value={botId}
              onChange={(id) => setBotId(id)}
            />
          </div>
        )}

        {/* Testar */}
        <button
          onClick={() => setTestOpen(true)}
          title="Testar fluxo (simulação)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-sm shrink-0"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <PlayCircle size={14} />
          <span className="hidden md:inline">Testar</span>
        </button>

        {/* Versões */}
        <button
          onClick={() => setVersionsOpen(true)}
          title="Histórico de versões"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-sm shrink-0"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <History size={14} />
        </button>

        {/* Import/Export JSON */}
        <button
          onClick={() => setImportExportOpen(true)}
          title="Importar / Exportar JSON"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-sm shrink-0"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <FileJson size={14} />
        </button>

        {/* Auto-layout */}
        <button
          onClick={handleAutoLayout}
          title="Organizar fluxo"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-sm shrink-0"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <LayoutGrid size={14} />
          <span className="hidden md:inline">Organizar</span>
        </button>

        <button onClick={undoAction} disabled={!canUndo}
          className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-30 shrink-0"
          style={{ color: 'var(--text-muted)' }} title="Desfazer (Ctrl+Z)">
          <Undo2 size={14} />
        </button>

        <button onClick={redoAction} disabled={!canRedo}
          className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-30 shrink-0"
          style={{ color: 'var(--text-muted)' }} title="Refazer (Ctrl+Y)">
          <Redo2 size={14} />
        </button>

        <button onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-2 transition-colors shrink-0"
          style={{ color: 'var(--text-muted)' }} title="Configurações do fluxo">
          <Settings size={14} />
        </button>

        {savedLabel && (
          <span className="text-xs shrink-0 hidden lg:block" style={{ color: 'var(--text-muted)' }}>
            Salvo {savedLabel}
          </span>
        )}

        {isDirty && (
          <span className="text-xs shrink-0 hidden lg:block" style={{ color: 'var(--warning)' }}>
            • Não salvo
          </span>
        )}

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors hover:bg-surface-2 shrink-0"
          style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
          <Save size={14} />
          {saving ? 'Salvando…' : 'Salvar'}
        </button>

        <button onClick={handlePublish} disabled={publishing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm shrink-0"
          style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>
          <Globe size={14} />
          {publishing ? 'Publicando…' : 'Publicar'}
        </button>
      </div>

      {/* Banner de validação (Fechável) */}
      {showErrors && validationErrors.length > 0 && (
        <div className="px-4 py-2 border-b text-xs" style={{
          background: 'color-mix(in oklab, var(--danger) 8%, transparent)',
          borderColor: 'var(--danger)',
          color: 'var(--text)',
        }}>
          <div className="flex items-start gap-3">
            <BarChart3 size={14} style={{ color: 'var(--danger)' }} className="mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold mb-1" style={{ color: 'var(--danger)' }}>
                {validationErrors.length} {validationErrors.length === 1 ? 'problema' : 'problemas'} antes de publicar:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {validationErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    {e.nodeId && <span className="font-mono opacity-60">[{e.nodeId.slice(0, 6)}…]</span>}{' '}
                    {e.message}
                  </li>
                ))}
                {validationErrors.length > 5 && (
                  <li>… e mais {validationErrors.length - 5}</li>
                )}
              </ul>
            </div>
            <button onClick={() => setShowErrors(false)} className="opacity-60 hover:opacity-100">
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Editor body ── */}
      <div className="flex flex-1 min-h-0">
        <Palette onAdd={handleAddNode} canvasCenter={canvasCenter} />

        <div ref={containerRef} className="relative flex-1 min-w-0 overflow-hidden">
          <Canvas
            nodes={nodes}
            edges={edges}
            vp={vp}
            setVp={setVp}
            selectedIds={selectedNodeIds}
            onSelectNode={handleSelectNode}
            onSelectNodes={handleSelectNodes}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={setSelectedEdgeId}
            connecting={connecting}
            setConnecting={setConnecting}
            reconnectEdgeId={reconnectEdgeId}
            onUpdateNode={handleUpdateNode}
            onUpdateNodes={handleUpdateNodes}
            onAddEdge={handleAddEdge}
            onDragEnd={handleDragEnd}
            onReconnectEdge={handleReconnectEdge}
            onAddNode={handleAddNode}
            containerRef={containerRef}
            nodeStats={nodeStats}
            errorNodeIds={new Set(validationErrors.filter(e => e.nodeId).map(e => e.nodeId!))}
          />
          <MiniMap
            nodes={nodes}
            vp={vp}
            containerW={viewportSize.w}
            containerH={viewportSize.h}
          />
          <ZoomControls
            zoom={vp.zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFitView={fitView}
          />
          {/* Hint de atalhos */}
          <div className="absolute bottom-3 left-3 text-[10px] px-2 py-1 rounded-md opacity-70 hidden lg:block"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <kbd>N</kbd> nova mensagem · <kbd>D</kbd> duplicar · <kbd>Ctrl+C/V</kbd> copiar/colar ·
            {' '}<kbd>Del</kbd> apagar · <kbd>Shift+drag</kbd> seleção
          </div>
        </div>

        <div className="w-[300px] shrink-0 overflow-y-auto"
          style={{ borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}>
          {activeEdgeId ? (
            <EdgePanel
              edge={selectedEdge}
              nodes={nodes}
              reconnecting={!!reconnectEdgeId}
              onStartReconnect={handleStartReconnect}
              onCancelReconnect={handleCancelReconnect}
              onDelete={() => handleDeleteEdge(activeEdgeId)}
            />
          ) : selectedNodeIds.size > 1 ? (
            <MultiSelectPanel count={selectedNodeIds.size} onDelete={deleteSelected} />
          ) : selectedNode ? (
            <Inspector
              node={selectedNode}
              stats={nodeStats.get(selectedNode.id) ?? null}
              onChange={handleInspectorChange}
              onDelete={() => {
                const newNodes = nodesRef.current.filter(n => n.id !== selectedNode.id)
                const newEdges = edgesRef.current.filter(
                  e => e.source !== selectedNode.id && e.target !== selectedNode.id
                )
                setNodes(newNodes)
                setEdges(newEdges)
                setSelectedNodeIds(new Set())
                pushHistory(newNodes, newEdges)
              }}
              onDuplicate={() => {
                duplicateSelected()
              }}
            />
          ) : (
            <PreviewChat nodes={nodes} edges={edges} />
          )}
        </div>
      </div>

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSettingsOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>
              Configurações do fluxo
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Descrição
                </label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="Descreva o objetivo deste fluxo…" />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Gatilho de início
                </label>
                <select value={triggerType} onChange={e => setTriggerType(e.target.value as 'start' | 'keyword')}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="start">/start — primeiro contato</option>
                  <option value="keyword">Palavra-chave</option>
                </select>
              </div>

              {triggerType === 'keyword' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Palavras-chave
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input value={kwInput} onChange={e => setKwInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                      className="flex-1 rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      placeholder="Digite e pressione Enter" />
                    <button onClick={addKeyword} className="px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>+</button>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map(kw => (
                        <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ background: 'color-mix(in oklab, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
                          {kw}
                          <button onClick={() => setKeywords(prev => prev.filter(x => x !== kw))}
                            className="opacity-60 hover:opacity-100">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Back-confirm modal ── */}
      {backConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setBackConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Mudanças não salvas
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Você tem alterações não salvas. Deseja sair sem salvar?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBackConfirmOpen(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                Cancelar
              </button>
              <button onClick={onBack} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--danger)', color: '#fff' }}>
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test runner */}
      {testOpen && (
        <TestRunnerModal
          nodes={nodes}
          edges={edges}
          onClose={() => setTestOpen(false)}
        />
      )}

      {/* Versions */}
      {versionsOpen && (
        <FlowVersionsPanel
          flowId={flow.id}
          onClose={() => setVersionsOpen(false)}
          onRollback={() => {
            setVersionsOpen(false)
            showToast('Versão restaurada. Recarregue o fluxo.', 'success')
            setTimeout(() => onBack(), 1500)
          }}
        />
      )}

      {/* Import/Export JSON */}
      {importExportOpen && (
        <ImportExportModal
          flowId={flow.id}
          flowName={name}
          description={description}
          triggerType={triggerType}
          keywords={keywords}
          nodes={nodes}
          edges={edges}
          onClose={() => setImportExportOpen(false)}
          onImport={replaceGraph}
          showToast={showToast}
        />
      )}
    </div>
  )
}
