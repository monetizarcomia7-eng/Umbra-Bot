'use client'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { RawBotOption } from '../_shared/types'

interface Props {
  bots: RawBotOption[]
  value: string
  onChange: (bot: string, color: string) => void
}

export default function BotSelector({ bots, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const selected = bots.find(b => b.id === value)

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
          <div className="absolute top-full left-0 mt-1 z-20 rounded-xl shadow-xl py-1 min-w-[180px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {bots.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Nenhum bot cadastrado
              </p>
            )}
            {bots.map(b => (
              <button
                key={b.id}
                onClick={() => { onChange(b.id, b.color || ''); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-surface-2 text-left"
                style={{ color: 'var(--text)' }}
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
