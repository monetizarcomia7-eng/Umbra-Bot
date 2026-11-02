'use client'

import { useState } from 'react'
import { KeyRound, Loader2, X } from 'lucide-react'
import { connectInstagramTokenAction } from '@/app/actions/instagram'

interface Props {
  onDone: (msg: string, type: 'success' | 'error') => void
}

export default function ConnectTokenButton({ onDone }: Props) {
  const [open, setOpen]       = useState(false)
  const [token, setToken]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const r = await connectInstagramTokenAction(token)
      if (!r.ok) { setError(r.error); return }
      setToken('')
      setOpen(false)
      onDone(`Conta ${r.username ? '@' + r.username : ''} conectada com sucesso!`, 'success')
    } catch {
      setError('Erro inesperado ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        <KeyRound size={14} />
        Conectar com token
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => !loading && setOpen(false)}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Conectar com token</h3>
              <button type="button" onClick={() => setOpen(false)} disabled={loading} className="opacity-60 hover:opacity-100">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Para contas testadoras do seu app Meta, sem Página do Facebook. Cole o token gerado em
              &quot;Instagram → Gerar token&quot; no painel do app (começa com <code>IG</code>).
              Ele é validado na Meta e salvo criptografado.
            </p>

            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Cole o token aqui"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />

            {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={loading}
                className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading || token.trim().length < 20}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)', color: 'var(--accent-fg, #fff)' }}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Validando…' : 'Conectar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
