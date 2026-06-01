'use client'

import { useState } from 'react'
import { Image as ImageIcon, Video, Layers, Calendar, X, Trash2, ExternalLink, Eye } from 'lucide-react'
import Link from 'next/link'
import Badge from '../shared/Badge'
import PostDetailsModal from './PostDetailsModal'
import { cancelPostAction, deletePostAction } from '@/app/actions/instagram'
import type { RawIgPost, RawIgAccount } from '@/app/dashboard/instagram/page'

interface Props {
  posts:    RawIgPost[]
  accounts: RawIgAccount[]
  onToast:  (msg: string, type?: 'success' | 'error') => void
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

export default function PostCards({ posts, accounts, onToast }: Props) {
  const [details, setDetails] = useState<RawIgPost | null>(null)
  const accountMap = new Map(accounts.map(a => [a.id, a]))

  async function handleCancel(id: string) {
    try {
      await cancelPostAction(id)
      onToast('Post cancelado.', 'success')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao cancelar.', 'error')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apagar este post? Esta ação não pode ser desfeita.')) return
    try {
      await deletePostAction(id)
      onToast('Post apagado.', 'success')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao apagar.', 'error')
    }
  }

  return (
    <>
      {details && <PostDetailsModal post={details} account={accountMap.get(details.account_id) ?? null} onClose={() => setDetails(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {posts.map(p => {
          const account = accountMap.get(p.account_id)
          const TypeIcon = TYPE_ICONS[p.media_type] ?? ImageIcon
          const thumb = p.media_urls[0]
          const isImage = p.media_type !== 'REELS'
          return (
            <div key={p.id} className="rounded-xl overflow-hidden flex flex-col"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {/* Thumb */}
              <div className="relative aspect-square" style={{ background: 'var(--surface-2)' }}>
                {thumb && isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <TypeIcon size={32} style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge tone={STATUS_TONES[p.status] ?? 'muted'}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                  <TypeIcon size={10} />
                  {p.media_type === 'CAROUSEL' ? `${p.media_urls.length}` : p.media_type}
                </div>
              </div>

              {/* Body */}
              <div className="p-3 flex-1 flex flex-col">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  @{account?.username ?? '—'}
                </p>
                <p className="text-xs line-clamp-2 flex-1 min-h-[2.5rem]" style={{ color: 'var(--text-muted)' }}>
                  {p.caption || '(sem legenda)'}
                </p>
                <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <Calendar size={10} />
                  {new Date(p.scheduled_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: 'short', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>

                {p.status === 'failed' && p.error_msg && (
                  <p className="text-[10px] mt-2 line-clamp-2" style={{ color: 'var(--danger)' }}>
                    {p.error_msg}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => setDetails(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                  >
                    <Eye size={11} />
                    Detalhes
                  </button>
                  {p.status === 'published' && p.ig_post_id && (
                    <Link
                      href={`https://www.instagram.com/p/${p.ig_post_id}/`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md"
                      style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                      aria-label="Abrir no IG"
                    >
                      <ExternalLink size={11} />
                    </Link>
                  )}
                  {p.status === 'scheduled' && (
                    <button
                      onClick={() => handleCancel(p.id)}
                      className="p-1.5 rounded-md"
                      style={{ background: 'var(--surface-2)', color: 'var(--warning)' }}
                      aria-label="Cancelar"
                    >
                      <X size={11} />
                    </button>
                  )}
                  {p.status !== 'publishing' && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-md"
                      style={{ background: 'var(--surface-2)', color: 'var(--danger)' }}
                      aria-label="Apagar"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
