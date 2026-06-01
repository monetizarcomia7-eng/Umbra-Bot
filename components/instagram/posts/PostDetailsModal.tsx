'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Image as ImageIcon, Video, Layers, ExternalLink, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import Badge from '../shared/Badge'
import { getPostLogsAction } from '@/app/actions/instagram'
import type { RawIgPost, RawIgAccount } from '@/app/dashboard/instagram/page'

interface Props {
  post:    RawIgPost
  account: RawIgAccount | null
  onClose: () => void
}

interface LogEntry {
  id:          string
  attempt_at:  string
  success:     boolean
  error_code:  string | null
  duration_ms: number | null
}

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'muted' | 'info'> = {
  scheduled:  'warning',
  publishing: 'info',
  published:  'success',
  failed:     'danger',
  cancelled:  'muted',
  draft:      'muted',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled:  'Agendado',
  publishing: 'Publicando',
  published:  'Publicado',
  failed:     'Falhou',
  cancelled:  'Cancelado',
  draft:      'Rascunho',
}

const TYPE_ICONS = { IMAGE: ImageIcon, REELS: Video, CAROUSEL: Layers } as const

export default function PostDetailsModal({ post, account, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const TypeIcon = TYPE_ICONS[post.media_type] ?? ImageIcon

  useEffect(() => {
    let cancelled = false
    getPostLogsAction(post.id)
      .then(data => { if (!cancelled) setLogs(data) })
      .catch(() => { if (!cancelled) setLogs([]) })
      .finally(() => { if (!cancelled) setLoadingLogs(false) })
    return () => { cancelled = true }
  }, [post.id])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Detalhes do post
          </h2>
          <button onClick={onClose} className="p-1 rounded-md"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 p-5">
            {/* Mídia */}
            <div>
              <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: 'var(--surface-2)' }}>
                {post.media_urls[0] && post.media_type !== 'REELS' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.media_urls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <TypeIcon size={40} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              {post.media_urls.length > 1 && (
                <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Carrossel com {post.media_urls.length} mídias
                </p>
              )}
            </div>

            {/* Info */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONES[post.status] ?? 'muted'}>
                  {STATUS_LABELS[post.status] ?? post.status}
                </Badge>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  <TypeIcon size={11} className="inline -mt-0.5 mr-1" />
                  {post.media_type}
                </span>
              </div>

              <Field label="Conta">
                <span style={{ color: 'var(--text)' }}>@{account?.username ?? '—'}</span>
              </Field>

              <Field label="Agendado para">
                <span className="inline-flex items-center gap-1" style={{ color: 'var(--text)' }}>
                  <Calendar size={11} />
                  {new Date(post.scheduled_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </Field>

              {post.published_at && (
                <Field label="Publicado em">
                  <span style={{ color: 'var(--text)' }}>
                    {new Date(post.published_at).toLocaleString('pt-BR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </Field>
              )}

              {post.ig_post_id && (
                <Field label="ID do post no IG">
                  <span className="font-mono text-xs" style={{ color: 'var(--text)' }}>{post.ig_post_id}</span>
                  <Link
                    href={`https://www.instagram.com/p/${post.ig_post_id}/`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 ml-2 text-xs"
                    style={{ color: 'var(--primary)' }}
                  >
                    <ExternalLink size={11} />
                    Abrir
                  </Link>
                </Field>
              )}

              {post.error_msg && (
                <div className="rounded-lg p-2.5 text-xs flex items-start gap-2"
                  style={{
                    background: 'color-mix(in oklab, var(--danger) 8%, transparent)',
                    border:     '1px solid var(--danger)',
                    color:      'var(--danger)',
                  }}>
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">Erro</p>
                    <p>{post.error_msg}</p>
                    {post.retry_count > 0 && (
                      <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                        Tentativas: {post.retry_count}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Field label="Legenda">
                <p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {post.caption || <span style={{ color: 'var(--text-muted)' }}>(sem legenda)</span>}
                </p>
              </Field>
            </div>
          </div>

          {/* Logs */}
          <div className="px-5 pb-5">
            <h3 className="text-xs uppercase tracking-wider font-semibold mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Histórico de publicação
            </h3>
            {loadingLogs ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={12} className="animate-spin" />
                Carregando logs…
              </div>
            ) : !logs || logs.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Sem tentativas registradas ainda.
              </p>
            ) : (
              <div className="space-y-1.5">
                {logs.map(log => (
                  <div key={log.id} className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs"
                    style={{ background: 'var(--surface-2)' }}>
                    {log.success
                      ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                      : <AlertCircle  size={12} style={{ color: 'var(--danger)' }} />}
                    <span style={{ color: 'var(--text)' }}>
                      {new Date(log.attempt_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </span>
                    {log.error_code && (
                      <span className="font-mono" style={{ color: 'var(--danger)' }}>
                        cod: {log.error_code}
                      </span>
                    )}
                    {log.duration_ms !== null && (
                      <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
                        {log.duration_ms}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5"
        style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div>{children}</div>
    </div>
  )
}
