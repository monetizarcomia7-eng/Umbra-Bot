'use client'
import { Plus, Minus, Maximize2 } from 'lucide-react'

interface Props {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
}

export default function ZoomControls({ zoom, onZoomIn, onZoomOut, onFitView }: Props) {
  const btn = 'flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-2 transition-colors'
  const style = { color: 'var(--text-muted)' }

  return (
    <div
      className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-xl shadow-lg"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <button className={btn} style={style} onClick={onZoomOut} title="Diminuir zoom">
        <Minus size={14} />
      </button>
      <span className="text-xs font-medium px-1 select-none" style={{ color: 'var(--text)', minWidth: 40, textAlign: 'center' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button className={btn} style={style} onClick={onZoomIn} title="Aumentar zoom">
        <Plus size={14} />
      </button>
      <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
      <button className={btn} style={style} onClick={onFitView} title="Ajustar à tela">
        <Maximize2 size={14} />
      </button>
    </div>
  )
}
