'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'

interface Props {
  userId: string
}

export function ApplicationForm({ userId }: Props) {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'success' | 'error' | 'duplicate'>('idle')
  const [errMsg,  setErrMsg]  = useState('')

  const valid =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || status === 'loading') return
    setStatus('loading')
    setErrMsg('')

    try {
      const res = await fetch('/api/affiliates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: name.trim(), email: email.trim().toLowerCase() }),
      })
      const json = await res.json()

      if (res.status === 409 && json.error === 'already_applied') {
        setStatus('duplicate')
        return
      }
      if (!res.ok) {
        setErrMsg(
          res.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : 'Erro ao enviar candidatura. Tente novamente.'
        )
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setErrMsg('Erro de conexão. Verifique sua internet e tente novamente.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center text-center py-6 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-success-soft text-success flex items-center justify-center">
          <CheckCircle2 size={28} />
        </div>
        <div className="text-[16px] font-semibold text-text">Candidatura enviada!</div>
        <div className="text-[13px] text-text-muted max-w-xs leading-relaxed">
          Sua candidatura foi recebida. O criador do programa entrará em contato pelo e-mail{' '}
          <strong className="text-text">{email}</strong>.
        </div>
      </div>
    )
  }

  if (status === 'duplicate') {
    return (
      <div className="flex flex-col items-center text-center py-6 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
          <CheckCircle2 size={28} />
        </div>
        <div className="text-[16px] font-semibold text-text">Já cadastrado</div>
        <div className="text-[13px] text-text-muted max-w-xs">
          Este e-mail já está cadastrado no programa. Aguarde o contato do criador.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {status === 'error' && (
        <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
          {errMsg}
        </div>
      )}

      <div>
        <label className="block text-[12.5px] font-medium text-text mb-1.5">
          Nome completo <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Ana Lima"
          required
          className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
        />
      </div>

      <div>
        <label className="block text-[12.5px] font-medium text-text mb-1.5">
          E-mail de contato <span className="text-danger">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
        />
      </div>

      <button
        type="submit"
        disabled={!valid || status === 'loading'}
        className="w-full h-10 bg-primary text-primary-fg text-[13.5px] font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
      >
        {status === 'loading' ? (
          <><Loader2 size={15} className="animate-spin" />Enviando…</>
        ) : (
          <><UserPlus size={15} />Quero participar</>
        )}
      </button>

      <p className="text-[11px] text-text-subtle text-center leading-relaxed">
        Ao enviar, você concorda que seus dados serão usados exclusivamente para contato sobre o programa de afiliados.
      </p>
    </form>
  )
}
