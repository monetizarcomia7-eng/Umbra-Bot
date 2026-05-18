'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Right panel features list ────────────────────────────────────────────────

const FEATURES = [
  'Bots ilimitados conectados',
  'Leads e contatos ilimitados',
  'Fluxos de venda visuais',
  'Remarketing automático',
  'PIX integrado com split',
  'Dashboard com métricas reais',
]

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
    if (!terms)                { setError('Você precisa aceitar os termos para criar uma conta.'); return }

    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--bg, #f8f9fb)' }}>
        <div className="w-full max-w-[420px] text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'var(--success-soft, #f0fdf4)', border: '1px solid #bbf7d0' }}>
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text, #0f172a)' }}>
            Conta criada!
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
            Enviamos um link de confirmação para{' '}
            <strong style={{ color: 'var(--text, #0f172a)' }}>{email}</strong>.
            Clique no link para ativar sua conta e começar a usar.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-subtle, #94a3b8)' }}>
            Não recebeu?{' '}
            <button onClick={() => setSuccess(false)}
              className="hover:underline font-medium"
              style={{ color: 'var(--primary, #7c3aed)' }}>
              Tentar novamente
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ colorScheme: 'light dark' }}>

      {/* ── Left: form panel ── */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--surface, #fff)' }}>

        {/* Header */}
        <header className="flex items-center px-8 py-5" style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary, #7c3aed)' }}>
              <svg viewBox="0 0 32 32" width="18" height="18">
                <path d="M16 4 L18.5 12 L27 16 L18.5 20 L16 28 L13.5 20 L5 16 L13.5 12 Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-[15px]" style={{ color: 'var(--text, #0f172a)' }}>Umbra Bot</span>
          </Link>
        </header>

        {/* Form */}
        <main className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-[420px] mx-auto">

            {/* Tab switcher */}
            <div className="flex rounded-xl p-1 mb-8"
              style={{ background: 'var(--surface-2, #f1f5f9)' }}>
              <Link href="/login"
                className="flex-1 py-2 text-sm font-medium text-center rounded-lg transition-colors"
                style={{ color: 'var(--text-muted, #64748b)' }}>
                Entrar
              </Link>
              <div className="flex-1 py-2 text-sm font-semibold text-center text-white rounded-lg"
                style={{ background: 'var(--primary, #7c3aed)' }}>
                Criar conta
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text, #0f172a)' }}>
              Crie sua conta grátis
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
              Sem cartão de crédito. Comece em menos de 2 minutos.
            </p>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm mb-5"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
                  Nome completo
                </label>
                <input
                  type="text" autoComplete="name" required
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
                  onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
                  E-mail
                </label>
                <input
                  type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
                  onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'} autoComplete="new-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-4 py-2.5 pr-11 rounded-xl text-sm outline-none transition-all"
                    style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
                    onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
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

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
                  Confirmar senha
                </label>
                <input
                  type="password" autoComplete="new-password" required
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
                  onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
                />
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 rounded"
                  style={{ accentColor: 'var(--primary, #7c3aed)', width: '16px', height: '16px' }} />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--text-muted, #64748b)' }}>
                  Concordo com os{' '}
                  <Link href="/termos" target="_blank" className="hover:underline"
                    style={{ color: 'var(--primary, #7c3aed)' }}>Termos de Uso</Link>
                  {' '}e a{' '}
                  <Link href="/privacidade" target="_blank" className="hover:underline"
                    style={{ color: 'var(--primary, #7c3aed)' }}>Política de Privacidade</Link>.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !email || !password || !name || !terms}
                className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'var(--primary, #7c3aed)' }}
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
        </main>

        {/* Footer */}
        <footer className="px-8 py-4" style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
          <p className="text-xs" style={{ color: 'var(--text-subtle, #94a3b8)' }}>
            © 2026 Umbra Bot. Todos os direitos reservados.
          </p>
        </footer>
      </div>

      {/* ── Right: branding (lg+) ── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[46%] flex-col relative overflow-hidden"
        style={{ background: 'var(--primary, #7c3aed)' }}>

        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* Glow */}
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}
        />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 xl:px-14 py-16">
          <h2 className="text-[32px] xl:text-[38px] font-bold text-white leading-tight mb-3">
            Comece grátis hoje.
          </h2>
          <p className="text-white/70 text-[15px] leading-relaxed mb-10">
            Sem mensalidade. Você só paga uma pequena taxa quando uma venda for processada.
          </p>

          <div className="space-y-3">
            {FEATURES.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <svg viewBox="0 0 12 12" width="10" height="10">
                    <polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-white/85 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="relative z-10 flex items-center gap-8 px-10 xl:px-14 py-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.1)' }}>
          {[
            { value: '1,4M+',  label: 'mensagens' },
            { value: 'R$ 84M', label: 'em vendas' },
            { value: '99,98%', label: 'uptime' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-base font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
