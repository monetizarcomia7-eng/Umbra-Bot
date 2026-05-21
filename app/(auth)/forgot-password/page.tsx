'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ReCaptchaWidget } from '@/components/ReCaptchaWidget'
import { verifyRecaptchaAction } from '@/app/actions/recaptcha'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading,        setLoading]        = useState(false)
  const [sent,           setSent]           = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!recaptchaToken) {
      setError('Por favor, confirme que você não é um robô.')
      return
    }

    setLoading(true)

    const captchaOk = await verifyRecaptchaAction(recaptchaToken)
    if (!captchaOk) {
      setError('Verificação de segurança falhou. Tente novamente.')
      setRecaptchaToken(null)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg, #f8f9fb)' }}>

      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <Link href="/login" className="flex items-center gap-2.5">
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

          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text, #0f172a)' }}>
                E-mail enviado!
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
                Enviamos um link de redefinição para{' '}
                <strong style={{ color: 'var(--text, #0f172a)' }}>{email}</strong>.
                Verifique sua caixa de entrada e spam.
              </p>
              <p className="text-xs" style={{ color: 'var(--text-subtle, #94a3b8)' }}>
                Não recebeu?{' '}
                <button onClick={() => setSent(false)} className="hover:underline font-medium"
                  style={{ color: 'var(--primary, #7c3aed)' }}>
                  Tentar novamente
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'var(--primary-soft, #ede9fe)' }}>
                <Mail size={22} style={{ color: 'var(--primary, #7c3aed)' }} />
              </div>

              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text, #0f172a)' }}>
                Recuperar senha
              </h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
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
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color: 'var(--text, #0f172a)' }}>
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com.br"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
                    onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
                  />
                </div>

                <div className="flex justify-center">
                  <ReCaptchaWidget onChange={setRecaptchaToken} />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || !recaptchaToken}
                  className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary, #7c3aed)' }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Enviando…
                    </>
                  ) : 'Enviar link de recuperação'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center mt-6">
          <Link href="/login"
            className="inline-flex items-center gap-1.5 text-sm hover:underline"
            style={{ color: 'var(--text-muted, #64748b)' }}>
            <ArrowLeft size={14} />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
