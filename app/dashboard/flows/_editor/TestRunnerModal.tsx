'use client'
import { useState, useEffect, useRef } from 'react'
import { X, PlayCircle, Loader2, RefreshCw, Plus } from 'lucide-react'
import { simulateFlowAction } from '@/app/actions/flows'
import type { FlowNodeType, FlowEdgeType } from '../_shared/types'

interface Step {
  nodeId: string
  nodeType: string
  side: 'bot' | 'user' | 'system'
  text: string
  options?: string[]
  isPause?: boolean
}

interface Props {
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
  onClose: () => void
}

export default function TestRunnerModal({ nodes, edges, onClose }: Props) {
  const [trail, setTrail] = useState<Step[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vars, setVars] = useState<Record<string, string>>({ nome: 'João Silva', email: 'joao@exemplo.com' })
  const [varKey, setVarKey] = useState('')
  const [varVal, setVarVal] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  async function run() {
    setRunning(true)
    setError(null)
    setTrail([])
    try {
      const result = await simulateFlowAction({
        nodes: nodes.map(n => ({ id: n.id, type: n.type, data: n.data as Record<string, unknown> })),
        edges: edges.map(e => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
        vars,
      })
      setTrail(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao simular o fluxo.')
    } finally {
      setRunning(false)
    }
  }

  // Auto-run on open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run() }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [trail])

  function addVar() {
    const k = varKey.trim()
    if (!k) return
    setVars(v => ({ ...v, [k]: varVal }))
    setVarKey('')
    setVarVal('')
  }

  function removeVar(k: string) {
    setVars(v => {
      const next = { ...v }
      delete next[k]
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <PlayCircle size={18} style={{ color: 'var(--primary)' }} />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              Modo de teste
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'color-mix(in oklab, var(--warning) 15%, transparent)', color: 'var(--warning)' }}>
              Simulação — nada enviado ao Telegram
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={run} disabled={running}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-surface-2"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
              {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Re-executar
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
              <X size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Vars panel */}
          <div className="w-[240px] shrink-0 overflow-y-auto p-4 border-r" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Variáveis de teste
            </p>
            <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
              Simule respostas do usuário aqui.
            </p>

            <div className="space-y-1.5 mb-3">
              {Object.entries(vars).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5 group">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--primary)' }}>
                    {`{${k}}`}
                  </span>
                  <input
                    value={v}
                    onChange={e => setVars(prev => ({ ...prev, [k]: e.target.value }))}
                    className="flex-1 min-w-0 rounded px-2 py-1 text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <button onClick={() => removeVar(k)}
                    className="opacity-0 group-hover:opacity-100 text-xs"
                    style={{ color: 'var(--text-muted)' }}>×</button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <input
                value={varKey}
                onChange={e => setVarKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVar() } }}
                placeholder="Nome (ex: idade)"
                className="rounded px-2 py-1 text-xs"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <input
                value={varVal}
                onChange={e => setVarVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVar() } }}
                placeholder="Valor"
                className="rounded px-2 py-1 text-xs"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <button onClick={addVar}
                className="flex items-center justify-center gap-1 rounded px-2 py-1 text-xs"
                style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>
                <Plus size={12} /> Adicionar
              </button>
            </div>
          </div>

          {/* Trail */}
          <div ref={containerRef} className="flex-1 overflow-y-auto p-4"
            style={{ background: 'var(--surface-2)' }}>
            {error && (
              <div className="rounded-lg p-3 text-sm mb-3"
                style={{
                  background: 'color-mix(in oklab, var(--danger) 8%, transparent)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger)',
                }}>
                {error}
              </div>
            )}

            {trail.length === 0 && !running && !error && (
              <p className="text-center text-sm py-12" style={{ color: 'var(--text-muted)' }}>
                Adicione nós e clique em &ldquo;Re-executar&rdquo;.
              </p>
            )}

            {trail.map((step, i) => {
              if (step.side === 'system') {
                return (
                  <div key={i} className="my-2 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 11 }}>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)' }}>
                      {step.nodeType}
                    </span>
                    {step.text}
                  </div>
                )
              }
              const isBot = step.side === 'bot'
              return (
                <div key={i} className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-2`}>
                  <div className="max-w-[70%] rounded-2xl px-3 py-2 text-sm"
                    style={{
                      background: isBot ? 'var(--surface)' : 'var(--primary)',
                      color: isBot ? 'var(--text)' : 'var(--accent-fg)',
                      border: isBot ? '1px solid var(--border)' : undefined,
                      whiteSpace: 'pre-wrap',
                    }}>
                    {step.text}
                    {step.options && step.options.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {step.options.map((opt, oi) => (
                          <div key={oi} className="px-2 py-1 rounded-lg text-center text-xs font-medium"
                            style={{ background: 'rgba(0,0,0,0.18)', color: 'inherit' }}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {step.isPause && (
                      <p className="text-[9px] mt-1 opacity-70 italic">
                        (aguarda resposta do usuário)
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {running && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm"
                style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" />
                Simulando…
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t text-xs" style={{
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}>
          Nós com pausa (pergunta, botões) são automaticamente continuados pelo primeiro caminho.
          Nós &ldquo;delay&rdquo; são instantâneos. Variáveis vazias aparecem como em branco.
        </div>
      </div>
    </div>
  )
}
