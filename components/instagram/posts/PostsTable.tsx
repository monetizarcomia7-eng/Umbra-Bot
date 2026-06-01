'use client'

import { useState } from 'react'
import { Image as ImageIcon, Video, Layers, MoreVertical, X, Trash2, ExternalLink, Eye } from 'lucide-react'
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

export default function PostsTable({ posts, accounts, onToast }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [details,  setDetails]  = useState<RawIgPost | null>(null)

  const accountMap = new Map(accounts.map(a => [a.id, a]))

  async function handleCancel(id: string) {
    try {
      await cancelPostAction(id)
      onToast('Post cancelado.', 'success')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao cancelar.', 'error')
    } finally {
      setOpenMenu(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apagar este post? Esta ação não pode ser desfeita.')) return
    try {
      await deletePostAction(id)
      onToast('Post apagado.', 'success')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao apagar.', 'error')
    } finally {
      setOpenMenu(null)
    }
  }

  return (
    <>
      {details && <PostDetailsModal post={details} account={accountMap.get(details.account_id) ?? null} onClose={() => setDetails(null)} />}

      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                <th className="text-left px-4 py-2.5 font-medium">Mídia</th>
                <th className="text-left px-4 py-2.5 font-medium">Conta</th>
                <th className="text-left px-4 py-2.5 font-medium">Legenda</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Agendado</th>
                <th className="text-right px-4 py-2.5 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map(p => {
                const account = accountMap.get(p.account_id)
                const TypeIcon = TYPE_ICONS[p.media_type] ?? ImageIcon
                const thumb = p.media_urls[0]
                const isImage = p.media_type !== 'REELS'
                return (
                  <tr key={p.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5">
                      <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center"
                        style={{ background: 'var(--surface-2)' }}>
                        {thumb && isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <TypeIcon size={16} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: 'var(--text)' }}>@{account?.username ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[280px]">
                      <p className="truncate" style={{ color: 'var(--text)' }}>
                        {p.caption || <span style={{ color: 'var(--text-muted)' }}>(sem legenda)</span>}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <TypeIcon size={12} />
                        {p.media_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONES[p.status] ?? 'muted'}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(p.scheduled_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                        className="p-1 rounded-md hover:bg-white/5"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label="Ações"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {openMenu === p.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                          <div className="absolute right-2 mt-1 w-44 rounded-lg shadow-lg z-20 py-1"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <MenuItem onClick={() => { setDetails(p); setOpenMenu(null) }} Icon={Eye}>
                              Ver detalhes
                            </MenuItem>
                            {p.status === 'published' && p.ig_post_id && (
                              <MenuItem
                                href={`https://www.instagram.com/p/${p.ig_post_id}/`}
                                external
                                Icon={ExternalLink}
                              >
                                Abrir no IG
                              </MenuItem>
                            )}
                            {p.status === 'scheduled' && (
                              <MenuItem onClick={() => handleCancel(p.id)} Icon={X}>
                                Cancelar
                              </MenuItem>
                            )}
                            {p.status !== 'publishing' && (
                              <MenuItem onClick={() => handleDelete(p.id)} Icon={Trash2} danger>
                                Apagar
                              </MenuItem>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function MenuItem({
  children, onClick, Icon, href, external, danger,
}: {
  children: React.ReactNode
  onClick?: () => void
  Icon: React.ElementType
  href?: string
  external?: boolean
  danger?: boolean
}) {
  const cls = 'flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-white/5'
  const color = danger ? 'var(--danger)' : 'var(--text)'
  if (href) {
    return (
      <Link href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        className={cls} style={{ color }}>
        <Icon size={13} />
        {children}
      </Link>
    )
  }
  return (
    <button onClick={onClick} className={cls} style={{ color }}>
      <Icon size={13} />
      {children}
    </button>
  )
}
