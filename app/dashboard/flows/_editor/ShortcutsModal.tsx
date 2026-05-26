'use client'
import { X, Keyboard } from 'lucide-react'

interface Props {
  onClose: () => void
}

const GROUPS: Array<{ title: string; items: Array<{ keys: string[]; desc: string }> }> = [
  {
    title: 'Edição',
    items: [
      { keys: ['Shift', 'N'], desc: 'Adicionar nó "Mensagem" no centro' },
      { keys: ['D'],          desc: 'Duplicar nó(s) selecionado(s)' },
      { keys: ['Ctrl', 'C'],  desc: 'Copiar nó(s) selecionado(s)' },
      { keys: ['Ctrl', 'V'],  desc: 'Colar do clipboard interno' },
      { keys: ['Del'],        desc: 'Apagar nó(s) ou aresta selecionada' },
      { keys: ['Ctrl', 'Z'],  desc: 'Desfazer' },
      { keys: ['Ctrl', 'Y'],  desc: 'Refazer' },
    ],
  },
  {
    title: 'Seleção',
    items: [
      { keys: ['Click'],            desc: 'Selecionar 1 nó' },
      { keys: ['Shift', 'Click'],   desc: 'Adicionar/remover da seleção' },
      { keys: ['Shift', 'Drag'],    desc: 'Selecionar por área (box-select)' },
      { keys: ['Esc'],              desc: 'Limpar seleção e conexões' },
    ],
  },
  {
    title: 'Canvas',
    items: [
      { keys: ['Drag'],             desc: 'Mover o canvas (pan)' },
      { keys: ['Wheel'],            desc: 'Zoom in/out (no cursor)' },
      { keys: ['Drag handle']
                                  , desc: 'Conectar dois nós' },
    ],
  },
  {
    title: 'Ajuda',
    items: [
      { keys: ['?'],                desc: 'Abrir esta lista de atalhos' },
    ],
  },
]

export default function ShortcutsModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[80vh] rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Keyboard size={18} style={{ color: 'var(--primary)' }} />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              Atalhos do editor
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {GROUPS.map(g => (
            <div key={g.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-muted)' }}>
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text)' }}>{item.desc}</span>
                    <span className="flex gap-1">
                      {item.keys.map((k, ki) => (
                        <kbd key={ki}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                          style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                          }}>
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t text-[11px]" style={{
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}>
          Atalhos não funcionam quando há um campo de texto ativo.
        </div>
      </div>
    </div>
  )
}
