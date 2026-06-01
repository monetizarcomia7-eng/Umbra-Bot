'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, Loader2, Image as ImageIcon, Video, X } from 'lucide-react'

export interface UploadedMedia {
  url:     string
  type:    string
  isVideo: boolean
  name:    string
}

interface Props {
  medias:   UploadedMedia[]
  onChange: (next: UploadedMedia[]) => void
  onError:  (msg: string) => void
}

const MAX_MEDIAS = 10

export default function MediaUpload({ medias, onChange, onError }: Props) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    try {
      const next = [...medias]
      for (const file of files) {
        if (next.length >= MAX_MEDIAS) break
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/instagram/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Falha no upload.')
        next.push({
          url:     data.url,
          type:    data.type,
          isVideo: data.isVideo,
          name:    file.name,
        })
      }
      onChange(next)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao subir mídia.')
    } finally {
      setUploading(false)
    }
  }, [medias, onChange, onError])

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    upload(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    upload(Array.from(e.dataTransfer.files))
  }

  function removeMedia(idx: number) {
    onChange(medias.filter((_, i) => i !== idx))
  }

  return (
    <div>
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

      {medias.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {medias.map((m, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden aspect-square"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {m.isVideo ? (
                <div className="flex items-center justify-center h-full">
                  <Video size={24} style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
              )}
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[9px] truncate"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                <span className="inline-flex items-center gap-1">
                  {m.isVideo ? <Video size={9} /> : <ImageIcon size={9} />}
                  {m.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeMedia(i)}
                className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'var(--danger)', color: '#fff' }}
                aria-label="Remover"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
        {medias.length}/{MAX_MEDIAS} arquivo(s)
      </p>
    </div>
  )
}
