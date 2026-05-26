'use client'
import { useState, useCallback, useRef } from 'react'
import { X, Upload, Loader2, Image as ImageIcon, Video, Layers } from 'lucide-react'
import { schedulePostAction } from '@/app/actions/instagram'
import type { RawIgAccount } from '../page'

interface Props {
  accounts: RawIgAccount[]
  onClose:  () => void
  onSuccess: () => void
  onError:   (msg: string) => void
}

interface UploadedMedia { url: string; type: string; isVideo: boolean; name: string }

const MAX_CAPTION = 2200

export default function PostForm({ accounts, onClose, onSuccess, onError }: Props) {
  const [accountId,   setAccountId]   = useState(accounts[0]?.id ?? '')
  const [caption,     setCaption]     = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [medias,      setMedias]      = useState<UploadedMedia[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [dragOver,    setDragOver]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const mediaType: 'IMAGE' | 'REELS' | 'CAROUSEL' | null =
    medias.length === 0 ? null :
    medias.length > 1 ? 'CAROUSEL' :
    medias[0].isVideo ? 'REELS' :
    'IMAGE'

  // eslint-disable-next-line react-hooks/purity
  const minDateTime = new Date(Date.now() + 3 * 60_000).toISOString().slice(0, 16)

  const upload = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        if (medias.length >= 10) break
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/instagram/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Falha no upload.')
        setMedias(prev => [...prev, {
          url:     data.url,
          type:    data.type,
          isVideo: data.isVideo,
          name:    file.name,
        }])
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao subir mídia.')
    } finally {
      setUploading(false)
    }
  }, [medias.length, onError])

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    upload(files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    upload(Array.from(e.dataTransfer.files))
  }

  function removeMedia(idx: number) {
    setMedias(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId)      { onError('Selecione uma conta.'); return }
    if (!medias.length)  { onError('Adicione pelo menos uma mídia.'); return }
    if (!scheduledAt)    { onError('Defina data e horário.'); return }
    if (!mediaType)      { onError('Tipo de mídia inválido.'); return }

    setSubmitting(true)
    try {
      await schedulePostAction({
        accountId,
        mediaType,
        mediaUrls:   medias.map(m => m.url),
        caption,
        scheduledAt: new Date(scheduledAt).toISOString(),
      })
      onSuccess()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao agendar post.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
            Novo post no Instagram
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Conta */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Conta Instagram
            </label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>@{a.username ?? '—'}</option>
              ))}
            </select>
          </div>

          {/* Mídia */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Mídia (imagem, vídeo ou até 10 arquivos para carrossel)
            </label>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="rounded-xl p-6 text-center cursor-pointer transition-colors"
              style={{
                background: dragOver ? 'color-mix(in oklab, var(--primary) 8%, var(--surface-2))' : 'var(--surface-2)',
                border:     `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                onChange={handleSelect}
                className="hidden"
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 size={14} className="animate-spin" />
                  Enviando…
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>
                  <Upload size={20} className="mx-auto mb-2" />
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    Clique ou arraste arquivos
                  </p>
                  <p className="text-xs mt-1">
                    JPG, PNG, WEBP (até 8 MB) ou MP4/MOV (até 500 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Lista de mídias */}
            {medias.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {medias.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <span className="flex items-center gap-2 min-w-0" style={{ color: 'var(--text)' }}>
                      {m.isVideo ? <Video size={12} /> : <ImageIcon size={12} />}
                      <span className="truncate">{m.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="p-0.5 rounded hover:bg-surface text-xs"
                      style={{ color: 'var(--danger)' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {mediaType && (
                  <p className="text-[10px] flex items-center gap-1 mt-1" style={{ color: 'var(--text-muted)' }}>
                    <Layers size={10} />
                    Tipo detectado: <strong>{mediaType}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Legenda
            </label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={MAX_CAPTION}
              rows={4}
              placeholder="Escreva a legenda do post…"
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <p className="text-[10px] text-right mt-1" style={{ color: 'var(--text-muted)' }}>
              {caption.length}/{MAX_CAPTION}
            </p>
          </div>

          {/* Data e hora */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Agendar para
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Mínimo de 3 minutos no futuro. O cron roda a cada minuto.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || uploading || medias.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {submitting ? 'Agendando…' : 'Agendar post'}
          </button>
        </form>
      </div>
    </div>
  )
}
