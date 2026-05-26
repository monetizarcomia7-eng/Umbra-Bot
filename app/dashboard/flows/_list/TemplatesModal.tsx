'use client'
import { X } from 'lucide-react'
import { FLOW_TEMPLATES } from '../_shared/constants'
import type { FlowTemplate } from '../_shared/types'

interface Props {
  onSelect: (t: FlowTemplate) => void
  onClose: () => void
}

export default function TemplatesModal({ onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="rounded-2xl shadow-2xl w-full max-w-lg"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
            Escolher template
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 transition-colors">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          {FLOW_TEMPLATES.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className="flex items-start gap-3 p-4 rounded-xl text-left transition-colors hover:bg-surface-2"
                style={{ border: '1px solid var(--border)' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--primary)/10' }}>
                  <Icon size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
