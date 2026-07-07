'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Trash2, ImageIcon, Video, Info, RefreshCw } from 'lucide-react'
import {
  listMediaLibraryAction,
  deleteMediaItemAction,
  getMediaThumbnailsAction,
  type MediaItem,
} from '@/app/actions/media'

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MediaLibraryModal({
  open,
  onClose,
  botId,
  mediaType,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  botId: string | null
  mediaType: 'image' | 'video'
  onSelect: (item: MediaItem) => void
}) {
  const [items, setItems]     = useState<MediaItem[]>([])
  const [thumbs, setThumbs]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!botId) return
    setLoading(true); setError(''); setThumbs({})
    try {
      const data = await listMediaLibraryAction(botId, mediaType)
      setItems(data)
      if (data.length > 0) {
        // Miniaturas em segundo plano — não bloqueia a lista
        getMediaThumbnailsAction(data.map(d => d.id))
          .then(setThumbs)
          .catch(() => { /* segue sem miniatura */ })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar a biblioteca.')
    } finally {
      setLoading(false)
    }
  }, [botId, mediaType])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(id)
    try {
      await deleteMediaItemAction(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {
      setError('Erro ao apagar a mídia.')
    } finally {
      setDeleting(null)
    }
  }

  const kindLabel = mediaType === 'image' ? 'imagens' : 'vídeos'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            {mediaType === 'image' ? <ImageIcon size={16} style={{ color: 'var(--primary)' }} /> : <Video size={16} style={{ color: 'var(--primary)' }} />}
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Biblioteca de mídia</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Escolha {mediaType === 'image' ? 'uma imagem' : 'um vídeo'} postado no seu canal
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} disabled={loading || !botId}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }} title="Atualizar">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2"
              style={{ color: 'var(--text-muted)' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {!botId ? (
            <div className="flex flex-col items-center text-center py-10 gap-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                <Info size={20} />
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Vincule um bot ao fluxo</div>
              <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                A biblioteca é por bot (o identificador da mídia é específico de cada bot).
                Selecione o bot no topo do editor para ver as mídias.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Carregando…</span>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--danger)' }}>{error}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {mediaType === 'image' ? <ImageIcon size={20} /> : <Video size={20} />}
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Nenhuma mídia ainda</div>
              <div className="text-xs max-w-sm text-left rounded-lg p-3 leading-relaxed"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Para o bot capturar suas {kindLabel}:
                <ol className="mt-1.5 space-y-1 list-decimal list-inside">
                  <li>Crie um <b>canal privado</b> no Telegram.</li>
                  <li>Adicione o <b>seu bot como administrador</b> do canal.</li>
                  <li>Poste as {kindLabel} nesse canal.</li>
                  <li>Volte aqui e clique em <b>Atualizar</b> ↻.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {items.map(item => (
                <button key={item.id} type="button" onClick={() => { onSelect(item); onClose() }}
                  className="group relative rounded-lg overflow-hidden border text-left transition-colors hover:border-primary"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="relative aspect-video flex items-center justify-center overflow-hidden"
                    style={{ background: 'var(--surface-3)' }}>
                    {thumbs[item.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbs[item.id]} alt={item.caption ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ color: 'var(--text-subtle)' }}>
                        {item.media_type === 'image' ? <ImageIcon size={22} /> : <Video size={22} />}
                      </span>
                    )}
                    {item.media_type === 'video' && (
                      <span className="absolute bottom-1 right-1 px-1 rounded text-[10px] font-medium text-white"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        {fmtDuration(item.duration) || 'vídeo'}
                      </span>
                    )}
                    <span
                      onClick={(e) => handleDelete(item.id, e)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                      title="Apagar da biblioteca"
                    >
                      {deleting === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </span>
                  </div>
                  {item.caption && (
                    <div className="px-2 py-1.5 text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {item.caption}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
