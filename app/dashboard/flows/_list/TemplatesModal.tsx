'use client'
import { X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { FLOW_TEMPLATES, TEMPLATE_CATEGORIES } from '../_shared/constants'
import type { FlowTemplate } from '../_shared/types'

interface Props {
  onSelect: (t: FlowTemplate) => void
  onClose: () => void
}

export default function TemplatesModal({ onSelect, onClose }: Props) {
  const [category, setCategory] = useState<FlowTemplate['category'] | 'all'>('all')

  const filtered = useMemo(() => {
    if (category === 'all') return FLOW_TEMPLATES
    return FLOW_TEMPLATES.filter(t => t.category === category)
  }, [category])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between p-5 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              Escolher template
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {FLOW_TEMPLATES.length} modelos prontos para começar
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 transition-colors">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-5 py-3 border-b overflow-x-auto shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setCategory('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            style={{
              background: category === 'all' ? 'var(--primary)' : 'transparent',
              color: category === 'all' ? 'var(--accent-fg)' : 'var(--text-muted)',
              border: '1px solid ' + (category === 'all' ? 'var(--primary)' : 'var(--border)'),
            }}
          >
            Todos ({FLOW_TEMPLATES.length})
          </button>
          {TEMPLATE_CATEGORIES.map(c => {
            const count = FLOW_TEMPLATES.filter(t => t.category === c.key).length
            if (count === 0) return null
            const active = category === c.key
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                  border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
                }}
              >
                {c.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Templates list */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(t => {
              const Icon = t.icon
              const nodeCount = t.nodes.length
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="flex items-start gap-3 p-4 rounded-xl text-left transition-colors hover:bg-surface-2"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'color-mix(in oklab, var(--primary) 12%, transparent)' }}>
                    <Icon size={20} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{t.name}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {t.description}
                    </p>
                    {nodeCount > 0 && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {nodeCount} {nodeCount === 1 ? 'nó' : 'nós'}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
