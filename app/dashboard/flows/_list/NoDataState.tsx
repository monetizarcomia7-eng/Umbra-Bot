'use client'
import { GitBranch, Plus } from 'lucide-react'

export default function NoDataState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--primary)/10' }}>
        <GitBranch size={28} style={{ color: 'var(--primary)' }} />
      </div>
      <div>
        <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
          Nenhum fluxo ainda
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Crie seu primeiro fluxo de venda para automatizar conversas no Telegram.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
      >
        <Plus size={16} />
        Criar primeiro fluxo
      </button>
    </div>
  )
}
