'use client'

import { Heart, MessageCircle, Send, Bookmark, Calendar, Image as ImageIcon, Video, Layers } from 'lucide-react'
import type { UploadedMedia } from './MediaUpload'
import type { RawIgAccount } from '@/app/dashboard/instagram/page'

interface Props {
  account:     RawIgAccount | null
  medias:      UploadedMedia[]
  caption:     string
  scheduledAt: string | null
}

export default function PostPreview({ account, medias, caption, scheduledAt }: Props) {
  const username = account?.username ?? 'username'
  const firstMedia = medias[0]
  const TypeIcon = medias.length > 1 ? Layers : firstMedia?.isVideo ? Video : ImageIcon

  return (
    <div className="rounded-xl overflow-hidden sticky top-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
        Pré-visualização
      </div>

      {/* Header do post */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        {account?.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>
            {username[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {username}
        </span>
      </div>

      {/* Mídia */}
      <div className="relative aspect-square" style={{ background: 'var(--surface-2)' }}>
        {firstMedia ? (
          firstMedia.isVideo ? (
            <div className="flex items-center justify-center h-full">
              <Video size={48} style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={firstMedia.url} alt="" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ImageIcon size={32} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Sem mídia
            </span>
          </div>
        )}

        {medias.length > 1 && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
            <TypeIcon size={10} className="inline -mt-0.5 mr-1" />
            1/{medias.length}
          </div>
        )}
      </div>

      {/* Ações fake do IG */}
      <div className="flex items-center gap-4 px-3 py-2" style={{ color: 'var(--text)' }}>
        <Heart size={18} strokeWidth={1.5} />
        <MessageCircle size={18} strokeWidth={1.5} />
        <Send size={18} strokeWidth={1.5} />
        <Bookmark size={18} strokeWidth={1.5} className="ml-auto" />
      </div>

      {/* Legenda */}
      <div className="px-3 pb-3">
        <p className="text-xs" style={{ color: 'var(--text)' }}>
          {caption ? (
            <>
              <span className="font-semibold">{username}</span>{' '}
              <span style={{ whiteSpace: 'pre-wrap' }}>{caption}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>A legenda aparecerá aqui…</span>
          )}
        </p>

        {scheduledAt && (
          <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <Calendar size={10} />
            Será publicado em {new Date(scheduledAt).toLocaleString('pt-BR', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </div>
  )
}
