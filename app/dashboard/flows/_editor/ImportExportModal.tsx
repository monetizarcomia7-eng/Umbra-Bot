'use client'
import { useState } from 'react'
import { X, Download, Upload, Copy, Check, AlertTriangle } from 'lucide-react'
import type { FlowNodeType, FlowEdgeType } from '../_shared/types'
import { nodeUid, edgeUid } from '../_shared/constants'

interface FlowSnapshot {
  format: 'umbra-flow'
  version: 1
  name: string
  description: string
  triggerType: 'start' | 'keyword'
  keywords: string[]
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
  exportedAt: string
}

interface Props {
  flowId: string
  flowName: string
  description: string
  triggerType: 'start' | 'keyword'
  keywords: string[]
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
  onClose: () => void
  onImport: (data: { nodes: FlowNodeType[]; edges: FlowEdgeType[] }) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export default function ImportExportModal({
  flowName, description, triggerType, keywords, nodes, edges,
  onClose, onImport, showToast,
}: Props) {
  const [tab, setTab] = useState<'export' | 'import'>('export')
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const snapshot: FlowSnapshot = {
    format: 'umbra-flow',
    version: 1,
    name: flowName,
    description,
    triggerType,
    keywords,
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  }
  const json = JSON.stringify(snapshot, null, 2)

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Erro ao copiar para a área de transferência.', 'error')
    }
  }

  function downloadJson() {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${flowName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${new Date()
      .toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setPasteText(String(ev.target?.result ?? ''))
      setPasteError(null)
    }
    reader.readAsText(file)
  }

  function applyImport() {
    setPasteError(null)
    try {
      const parsed = JSON.parse(pasteText)

      // Validações básicas
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('JSON inválido.')
      }
      if (parsed.format !== 'umbra-flow') {
        throw new Error('Formato não reconhecido (esperado "umbra-flow").')
      }
      if (!Array.isArray(parsed.nodes)) {
        throw new Error('Campo "nodes" deve ser um array.')
      }
      if (!Array.isArray(parsed.edges)) {
        throw new Error('Campo "edges" deve ser um array.')
      }
      if (parsed.nodes.length > 500) {
        throw new Error('Máximo de 500 nós permitido.')
      }
      if (parsed.edges.length > 1000) {
        throw new Error('Máximo de 1000 arestas permitido.')
      }

      // Reescreve IDs para evitar colisão com nós já existentes no fluxo atual
      const idMap = new Map<string, string>()
      const newNodes: FlowNodeType[] = parsed.nodes.map((n: FlowNodeType) => {
        const newId = nodeUid()
        idMap.set(n.id, newId)
        return {
          id: newId,
          type: String(n.type),
          position: {
            x: Number(n.position?.x ?? 0),
            y: Number(n.position?.y ?? 0),
          },
          data: { ...(n.data ?? {}) },
        }
      })

      const newEdges: FlowEdgeType[] = parsed.edges
        .map((e: FlowEdgeType) => {
          const src = idMap.get(e.source)
          const tgt = idMap.get(e.target)
          if (!src || !tgt) return null
          return {
            id: edgeUid(),
            source: src,
            target: tgt,
            sourceHandle: e.sourceHandle,
            label: e.label,
          }
        })
        .filter((e: FlowEdgeType | null): e is FlowEdgeType => e !== null)

      onImport({ nodes: newNodes, edges: newEdges })
      showToast(`Importados ${newNodes.length} nós e ${newEdges.length} arestas.`, 'success')
      onClose()
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : 'JSON inválido.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
            Importar / Exportar fluxo
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setTab('export')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm transition-colors"
            style={{
              color: tab === 'export' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === 'export' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            <Download size={14} />
            Exportar
          </button>
          <button
            onClick={() => setTab('import')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm transition-colors"
            style={{
              color: tab === 'import' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === 'import' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            <Upload size={14} />
            Importar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'export' && (
            <>
              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                Snapshot completo do fluxo (nós, arestas, configuração).
                Use para fazer backup ou transferir entre contas.
              </p>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={copyJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-surface-2"
                  style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar JSON'}
                </button>
                <button
                  onClick={downloadJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
                >
                  <Download size={14} />
                  Baixar arquivo
                </button>
              </div>

              <pre className="rounded-lg p-3 text-xs font-mono overflow-auto max-h-[40vh]"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {json}
              </pre>
            </>
          )}

          {tab === 'import' && (
            <>
              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                Cole o JSON exportado ou faça upload de um arquivo.
                Os nós existentes serão <strong>substituídos</strong>.
              </p>

              <div className="rounded-lg p-3 mb-3 text-xs"
                style={{
                  background: 'color-mix(in oklab, var(--warning) 8%, transparent)',
                  border: '1px solid var(--warning)',
                  color: 'var(--text)',
                }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} style={{ color: 'var(--warning)' }} className="mt-0.5 shrink-0" />
                  <p>
                    Importar substitui todos os nós e arestas atuais.
                    Use &ldquo;Desfazer&rdquo; (Ctrl+Z) para reverter.
                  </p>
                </div>
              </div>

              <input
                type="file"
                accept="application/json"
                onChange={handleFileUpload}
                className="block w-full text-xs mb-3"
                style={{ color: 'var(--text-muted)' }}
              />

              <textarea
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setPasteError(null) }}
                placeholder='Cole o JSON aqui — ex: { "format": "umbra-flow", "nodes": [...], "edges": [...] }'
                className="w-full rounded-lg p-3 text-xs font-mono resize-none mb-3"
                rows={12}
                style={{
                  background: 'var(--surface-2)',
                  border: pasteError ? '1px solid var(--danger)' : '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />

              {pasteError && (
                <p className="text-xs mb-3" style={{ color: 'var(--danger)' }}>
                  {pasteError}
                </p>
              )}

              <button
                onClick={applyImport}
                disabled={!pasteText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
              >
                <Upload size={14} />
                Importar e substituir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
