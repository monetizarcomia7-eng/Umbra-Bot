'use client'
import { useState, useMemo } from 'react'
import { Image as ImageIcon, Video, Layers, X, Trash2, ExternalLink, AlertCircle } from 'lucide-react'
import { cancelPostAction, deletePostAction } from '@/app/actions/instagram'
import type { RawIgPost, RawIgAccount } from '../page'

interface Props {
  posts:     RawIgPost[]
  accounts:  RawIgAccount[]
  onToast:   (msg: string, type?: 'success' | 'error') => void
}

const STATUS_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  draft:      { label: 'Rascunho',   bg: 'var(--surface-2)',                                                fg: 'var(--text-muted)' },
  scheduled:  { label: 'Agendado',   bg: 'color-mix(in oklab, var(--info) 12%, transparent)',               fg: 'var(--info)' },
  publishing: { label: 'Publicando', bg: 'color-mix(in oklab, var(--warning) 12%, transparent)',            fg: 'var(--warning)' },
  published:  { label: 'Publicado',  bg: 'color-mix(in oklab, var(--success) 12%, transparent)',            fg: 'var(--success)' },
  failed:     { label: 'Falhou',     bg: 'color-mix(in oklab, var(--danger) 12%, transparent)',             fg: 'var(--danger)' },
  cancelled:  { label: 'Cancelado',  bg: 'var(--surface-2)',                                                fg: 'var(--text-muted)' },
}

type StatusFilter = 'all' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

export default function PostList({ posts, accounts, onToast }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const accountMap = useMemo(() => {
    const m = new Map<string, string>()
    accounts.forEach(a => m.set(a.id, a.username ?? '—'))
    return m
  }, [accounts])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return posts
    return posts.filter(p => p.status === statusFilter)
  }, [posts, statusFilter])

  async function handleCancel(post: RawIgPost) {
    try {
      await cancelPostAction(post.id)
      onToast('Post cancelado.', 'success')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao cancelar.', 'error')
    }
  }

  async function handleDelete(post: RawIgPost) {
    if (!confirm('Apagar este post? Esta ação não pode ser desfeita.')) return
    try {
      await deletePostAction(post.id)
      onToast('Post apagado.', 'success')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao apagar.', 'error')
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center"
        style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Nenhum post agendado ainda.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {(['all', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'] as StatusFilter[]).map(s => {
          const count = s === 'all' ? posts.length : posts.filter(p => p.status === s).length
          const active = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: active ? 'var(--primary)' : 'transparent',
                color:      active ? 'var(--accent-fg)' : 'var(--text-muted)',
                border:     '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
              }}
            >
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]?.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {filtered.map(post => {
          const status = STATUS_LABELS[post.status] ?? STATUS_LABELS.scheduled
          const username = accountMap.get(post.account_id) ?? '—'
          const TypeIcon = post.media_type === 'CAROUSEL' ? Layers : post.media_type === 'REELS' ? Video : ImageIcon
          const date = new Date(post.scheduled_at)
          const isImage = post.media_urls[0] && /\.(jpg|jpeg|png|webp)$/i.test(post.media_urls[0])

          return (
            <div key={post.id}
              className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

              {/* Thumb */}
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.media_urls[0]}
                  alt=""
                  className="w-14 h-14 object-cover rounded-md shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface-2)' }}>
                  <TypeIcon size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: status.bg, color: status.fg }}>
                    {status.label}
                  </span>
                  <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <TypeIcon size={10} /> {post.media_type}
                    {post.media_urls.length > 1 && ` · ${post.media_urls.length} itens`}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    @{username}
                  </span>
                </div>

                <p className="text-xs truncate" style={{ color: 'var(--text)' }}>
                  {post.caption || <span style={{ color: 'var(--text-muted)' }}>(sem legenda)</span>}
                </p>

                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {date.toLocaleString('pt-BR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {post.published_at && (
                    <> · Publicado {new Date(post.published_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</>
                  )}
                  {post.retry_count > 0 && <> · {post.retry_count} tentativa(s)</>}
                </p>

                {post.status === 'failed' && post.error_msg && (
                  <div className="mt-1.5 flex items-start gap-1 text-[10px] rounded-md px-2 py-1"
                    style={{
                      background: 'color-mix(in oklab, var(--danger) 8%, transparent)',
                      color:      'var(--danger)',
                    }}>
                    <AlertCircle size={10} className="mt-0.5 shrink-0" />
                    <span>{post.error_msg}</span>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-1 shrink-0">
                {post.status === 'published' && post.ig_post_id && (
                  <a
                    href={`https://www.instagram.com/p/${post.ig_post_id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no Instagram"
                    className="p-1.5 rounded-md hover:bg-surface-2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                {post.status === 'scheduled' && (
                  <button
                    onClick={() => handleCancel(post)}
                    title="Cancelar"
                    className="p-1.5 rounded-md hover:bg-surface-2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X size={12} />
                  </button>
                )}
                {(post.status === 'failed' || post.status === 'cancelled' || post.status === 'published') && (
                  <button
                    onClick={() => handleDelete(post)}
                    title="Apagar"
                    className="p-1.5 rounded-md hover:bg-surface-2 transition-colors"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
