'use client'
import { useEffect, useState } from 'react'
import { X, RotateCcw, History, Loader2 } from 'lucide-react'
import { listFlowVersionsAction, rollbackFlowVersionAction } from '@/app/actions/flows'
import type { FlowVersionRow } from '../_shared/types'

interface Props {
  flowId: string
  onClose: () => void
  onRollback: () => void
}

export default function FlowVersionsPanel({ flowId, onClose, onRollback }: Props) {
  const [versions, setVersions] = useState<FlowVersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [rolling, setRolling] = useState<number | null>(null)
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listFlowVersionsAction(flowId)
      .then(setVersions)
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar versões.'))
      .finally(() => setLoading(false))
  }, [flowId])

  async function doRollback(version: number) {
    setRolling(version)
    setError(null)
    try {
      await rollbackFlowVersionAction(flowId, version)
      onRollback()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao restaurar versão.')
    } finally {
      setRolling(null)
      setConfirmVersion(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md max-h-[80vh] rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <History size={16} style={{ color: 'var(--primary)' }} />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              Histórico de versões
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          )}

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

          {!loading && versions.length === 0 && (
            <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
              Nenhuma versão publicada ainda.<br />
              <span className="text-xs">Cada publicação cria um snapshot imutável aqui.</span>
            </p>
          )}

          <div className="space-y-2">
            {versions.map((v, idx) => {
              const isLatest = idx === 0
              const isConfirming = confirmVersion === v.version
              return (
                <div key={v.id}
                  className="rounded-lg p-3"
                  style={{
                    background: isLatest ? 'color-mix(in oklab, var(--success) 8%, transparent)' : 'var(--surface-2)',
                    border: `1px solid ${isLatest ? 'var(--success)' : 'var(--border)'}`,
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                          v{v.version}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--success)', color: '#fff' }}>
                            ATUAL
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text)' }}>
                        {v.name}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Publicado em {new Date(v.published_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {!isLatest && !isConfirming && (
                      <button
                        onClick={() => setConfirmVersion(v.version)}
                        disabled={rolling !== null}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-surface"
                        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                        <RotateCcw size={11} />
                        Restaurar
                      </button>
                    )}

                    {isConfirming && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => doRollback(v.version)}
                          disabled={rolling !== null}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'var(--danger)', color: '#fff' }}>
                          {rolling === v.version ? <Loader2 size={11} className="animate-spin" /> : null}
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmVersion(null)}
                          disabled={rolling !== null}
                          className="px-2 py-1 rounded-lg text-xs"
                          style={{ color: 'var(--text-muted)' }}>
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-t text-xs" style={{
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}>
          Restaurar uma versão sobrescreve o rascunho atual. As últimas 50 versões são preservadas.
        </div>
      </div>
    </div>
  )
}
