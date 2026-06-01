'use client'

import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

interface Props {
  msg:     string
  type:    'success' | 'error'
  onClose: () => void
}

export default function Toast({ msg, type, onClose }: Props) {
  const isSuccess = type === 'success'
  return (
    <div
      className="fixed top-4 right-4 z-50 max-w-md px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2"
      style={{
        background: isSuccess
          ? 'color-mix(in oklab, var(--success) 12%, var(--surface))'
          : 'color-mix(in oklab, var(--danger) 12%, var(--surface))',
        border: `1px solid ${isSuccess ? 'var(--success)' : 'var(--danger)'}`,
        color:  isSuccess ? 'var(--success)' : 'var(--danger)',
      }}
    >
      {isSuccess ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}
