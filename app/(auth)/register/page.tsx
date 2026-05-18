'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [terms,    setTerms]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const pwdStrength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 || !/[A-Z]/.test(password) ? 2
    : 3

  const pwdLabel = ['', 'Fraca', 'Média', 'Forte']
  const pwdColor = ['', 'bg-danger', 'bg-warning', 'bg-success']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 8)  { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (!terms)               { setError('Você precisa aceitar os termos para criar uma conta.'); return }

    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
      },
    })

    if (authError) {
      setError(
        authError.message === 'User already registered'
          ? 'Este e-mail já está cadastrado. Tente fazer login.'
          : authError.message,
      )
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (!mounted) return null

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg,#f8f9fb)] px-4">
        <div className="w-full max-w-[400px] text-center">
          <CheckCircle2 size={48} className="text-[var(--success,#16a34a)] mx-auto mb-4" />
          <h2 className="text-[22px] font-bold text-[var(--text,#0f172a)] mb-2">Conta criada!</h2>
          <p className="text-[14px] text-[var(--text-muted,#64748b)] mb-6 leading-relaxed">
            Enviamos um link de confirmação para <strong className="text-[var(--text,#0f172a)]">{email}</strong>.
            Clique no link para ativar sua conta e começar a usar.
          </p>
          <p className="text-[13px] text-[var(--text-subtle,#94a3b8)]">
            Não recebeu?{' '}
            <button
              onClick={() => setSuccess(false)}
              className="text-[var(--primary,#7c3aed)] hover:underline font-medium"
            >
              Tentar novamente
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg,#f8f9fb)]" style={{ colorScheme: 'light dark' }}>

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[480px] shrink-0 flex-col bg-[var(--primary,#7c3aed)] p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
        <div className="relative z-10 flex flex-col h-full">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg viewBox="0 0 32 32" width="22" height="22">
                <path d="M16 4 L18.5 12 L27 16 L18.5 20 L16 28 L13.5 20 L5 16 L13.5 12 Z" fill="white" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">Umbra Bot</span>
          </Link>
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-[30px] font-bold text-white leading-tight mb-4">
              Comece grátis hoje
            </h1>
            <p className="text-white/70 text-[14px] leading-relaxed">
              Sem mensalidade. Sem cartão de crédito. Você só paga uma pequena
              taxa quando uma venda for processada.
            </p>
            <div className="mt-8 p-4 rounded-xl bg-white/10 border border-white/20">
              <p className="text-white text-[13px] font-semibold mb-1">O que está incluso:</p>
              {['Bots ilimitados', 'Leads ilimitados', 'Fluxos de venda', 'Remarketing automático', 'PIX integrado'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-white/80 text-[13px] mt-1.5">
                  <CheckCircle2 size={13} className="text-green-300 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">

        <Link href="/" className="lg:hidden flex items-center gap-2 mb-8">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect width="32" height="32" rx="9" fill="var(--primary,#7c3aed)" />
            <path d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z" fill="white" />
          </svg>
          <span className="font-bold text-[16px] text-[var(--text,#0f172a)]">Umbra Bot</span>
        </Link>

        <div className="w-full max-w-[420px]">
          <div className="mb-7">
            <h2 className="text-[24px] font-bold text-[var(--text,#0f172a)] mb-1">Criar conta grátis</h2>
            <p className="text-[14px] text-[var(--text-muted,#64748b)]">
              Já tem conta?{' '}
              <Link href="/login" className="text-[var(--primary,#7c3aed)] font-medium hover:underline">Entrar</Link>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-700 mb-5">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text,#0f172a)] mb-1.5">Nome completo</label>
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,white)] text-[14px] text-[var(--text,#0f172a)] placeholder:text-[var(--text-subtle,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#7c3aed)]/30 transition"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text,#0f172a)] mb-1.5">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,white)] text-[14px] text-[var(--text,#0f172a)] placeholder:text-[var(--text-subtle,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#7c3aed)]/30 transition"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text,#0f172a)] mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,white)] text-[14px] text-[var(--text,#0f172a)] placeholder:text-[var(--text-subtle,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#7c3aed)]/30 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle,#94a3b8)] hover:text-[var(--text-muted,#64748b)]"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[var(--surface-2,#f1f5f9)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pwdColor[pwdStrength]}`}
                      style={{ width: `${(pwdStrength / 3) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--text-muted,#64748b)] w-10">{pwdLabel[pwdStrength]}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text,#0f172a)] mb-1.5">Confirmar senha</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,white)] text-[14px] text-[var(--text,#0f172a)] placeholder:text-[var(--text-subtle,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#7c3aed)]/30 transition"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 rounded accent-[var(--primary,#7c3aed)]"
              />
              <span className="text-[12.5px] text-[var(--text-muted,#64748b)] leading-relaxed">
                Concordo com os{' '}
                <Link href="/termos" target="_blank" className="text-[var(--primary,#7c3aed)] hover:underline">Termos de Uso</Link>
                {' '}e a{' '}
                <Link href="/privacidade" target="_blank" className="text-[var(--primary,#7c3aed)] hover:underline">Política de Privacidade</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !email || !password || !name || !terms}
              className="w-full h-11 rounded-xl bg-[var(--primary,#7c3aed)] text-white text-[14px] font-semibold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Criando conta…
                </>
              ) : 'Criar conta grátis'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
