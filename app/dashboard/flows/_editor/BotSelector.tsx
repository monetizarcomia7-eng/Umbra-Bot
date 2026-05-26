'use client'
import { ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import type { RawBotOption } from '../_shared/types'

interface Props {
  bots: RawBotOption[]
  value: string | null
  onChange: (botId: string | null) => void
}

export default function BotSelector({ bots, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  // FIX B3: lookup por id (não por bot string)
  const selected = value ? bots.find(b => b.id === value) ?? null : null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-surface-2 transition-colors"
        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        {selected ? (
          <>
            <span className="w-4 h-4 rounded-full shrink-0"
              style={{ background: selected.color || 'var(--primary)' }} />
            <span className="max-w-[120px] truncate">
              {selected.username ? `@${selected.username}` : selected.name}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Selecionar bot</span>
        )}
        <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-20 rounded-xl shadow-xl py-1 min-w-[200px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {bots.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Nenhum bot cadastrado
              </p>
            )}
            {selected && (
              <button
                onClick={() => { onChange(null); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-2 text-left border-b"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
              >
                <X size={12} />
                Desvincular bot
              </button>
            )}
            {bots.map(b => (
              <button
                key={b.id}
                onClick={() => { onChange(b.id); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-2 text-left"
                style={{
                  color: 'var(--text)',
                  background: b.id === value ? 'color-mix(in oklab, var(--primary) 8%, transparent)' : undefined,
                }}
              >
                <span className="w-4 h-4 rounded-full shrink-0"
                  style={{ background: b.color || 'var(--primary)' }} />
                {b.username ? `@${b.username}` : b.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
