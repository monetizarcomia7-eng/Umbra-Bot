'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router  = useRouter()
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const pwdStrength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 || !/[A-Z]/.test(password) ? 2
    : 3
  const pwdColors = ['', '#ef4444', '#f59e0b', '#22c55e']
  const pwdLabels = ['', 'Fraca', 'Média', 'Forte']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 8)  { setError('A senha deve ter pelo menos 8 caracteres.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.updateUser({ password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard'), 2500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg, #f8f9fb)' }}>

      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary, #7c3aed)' }}>
              <svg viewBox="0 0 32 32" width="18" height="18">
                <path d="M16 4 L18.5 12 L27 16 L18.5 20 L16 28 L13.5 20 L5 16 L13.5 12 Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-[15px]" style={{ color: 'var(--text, #0f172a)' }}>Umbra Bot</span>
          </Link>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text, #0f172a)' }}>Senha atualizada!</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted, #64748b)' }}>
                Redirecionando para o painel…
              </p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'var(--primary-soft, #ede9fe)' }}>
                <ShieldCheck size={22} style={{ color: 'var(--primary, #7c3aed)' }} />
              </div>

              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text, #0f172a)' }}>
                Nova senha
              </h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
                Escolha uma senha forte para proteger sua conta.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm mb-5"
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl text-sm outline-none transition-all"
                      style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
                      onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
                      onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-subtle, #94a3b8)' }}>
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden"
                        style={{ background: 'var(--border, #e2e8f0)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(pwdStrength / 3) * 100}%`, background: pwdColors[pwdStrength] }} />
                      </div>
                      <span className="text-xs w-10" style={{ color: 'var(--text-muted, #64748b)' }}>
                        {pwdLabels[pwdStrength]}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
                    Confirmar senha
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
                    onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary, #7c3aed)' }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Salvando…
                    </>
                  ) : 'Definir nova senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
