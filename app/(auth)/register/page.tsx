'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ReCaptchaWidget } from '@/components/ReCaptchaWidget'
import { verifyRecaptchaAction } from '@/app/actions/recaptcha'

// ─── Dashboard preview (right panel mockup) ───────────────────────────────────

function DashboardCard() {
  return (
    <div className="w-full max-w-[360px] rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e2e8f0)' }}>

      {/* Card header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted, #64748b)' }}>
            Nova venda · R$&nbsp;297,00 · há 12s
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted, #64748b)' }}>Receita hoje</p>
            <p className="text-[26px] font-bold leading-none" style={{ color: 'var(--text, #0f172a)' }}>
              R$&nbsp;12.480
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full mb-1">
            ↑ 24,1%
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-subtle, #94a3b8)' }}>vs. R$&nbsp;10.054 ontem</p>
      </div>

      {/* Mini chart */}
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
        <svg viewBox="0 0 320 56" className="w-full h-12" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,48 C40,44 80,38 120,30 C160,22 200,14 240,10 C270,7 295,5 320,4"
            fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"
          />
          <path
            d="M0,48 C40,44 80,38 120,30 C160,22 200,14 240,10 C270,7 295,5 320,4 L320,56 L0,56 Z"
            fill="url(#lg2)"
          />
        </svg>
      </div>

      {/* Flow rows */}
      <div className="px-5 py-4 space-y-3">
        {[
          { name: 'Funil VIP — Mentoria',  value: 'R$ 6.842' },
          { name: 'Remarketing 24h',        value: 'R$ 3.196' },
          { name: 'Checkout direto',        value: 'R$ 2.442' },
        ].map((f) => (
          <div key={f.name} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted, #64748b)' }}>{f.name}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text, #0f172a)' }}>{f.value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex items-center gap-1.5"
        style={{ borderTop: '1px solid var(--border, #e2e8f0)', background: 'var(--surface-2, #f8fafc)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        <span className="text-xs" style={{ color: 'var(--text-subtle, #94a3b8)' }}>
          14 bots ativos · 1.284 leads online
        </span>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [terms,    setTerms]    = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [success,        setSuccess]        = useState(false)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

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
    if (!recaptchaToken)       { setError('Por favor, confirme que você não é um robô.'); return }

    setLoading(true)

    const captchaOk = await verifyRecaptchaAction(recaptchaToken)
    if (!captchaOk) {
      setError('Verificação de segurança falhou. Tente novamente.')
      setRecaptchaToken(null)
      setLoading(false)
      return
    }

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
              <svg viewBox="0 0 100 100" width="18" height="18">
                <path d="M 18 18 V 60 A 32 32 0 0 0 82 60 V 18 H 64 V 60 A 14 14 0 0 1 36 60 V 18 Z" fill="white" />
                <rect x="14" y="42" width="72" height="3.5" rx="2" fill="rgba(0,0,0,0.6)" />
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

            {/* Google OAuth */}
            <button
              type="button"
              onClick={async () => {
                const { createClient } = await import('@/lib/supabase/client')
                const supabase = createClient()
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                })
              }}
              className="w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2.5 transition-all hover:bg-slate-50 active:scale-[0.98] mb-5"
              style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Cadastrar com Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px" style={{ background: 'var(--border, #e2e8f0)' }} />
              <span className="text-xs" style={{ color: 'var(--text-subtle, #94a3b8)' }}>ou continue com e-mail</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border, #e2e8f0)' }} />
            </div>

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

              <div className="flex justify-center">
                <ReCaptchaWidget onChange={setRecaptchaToken} />
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password || !name || !terms || !recaptchaToken}
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

      {/* ── Right: branding + preview (lg+) ── */}
      <div className="hidden lg:flex lg:w-[54%] xl:w-[58%] flex-col relative overflow-hidden"
        style={{ background: 'var(--bg, #f8f9fb)' }}>

        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--border, #e2e8f0) 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* Purple glow */}
        <div className="absolute -top-40 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)' }}
        />

        {/* Status bar */}
        <div className="relative z-10 flex items-center justify-end px-8 py-5">
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e2e8f0)', color: 'var(--text-muted, #64748b)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Todos os sistemas operacionais
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-10 xl:px-16 pb-8">
          <div className="w-full max-w-[460px]">
            <h1 className="text-[36px] xl:text-[44px] font-bold leading-[1.1] mb-4"
              style={{ color: 'var(--text, #0f172a)' }}>
              Venda no Telegram{' '}
              <span style={{ color: 'var(--primary, #7c3aed)' }}>no piloto automático.</span>
            </h1>
            <p className="text-[15px] leading-relaxed mb-10" style={{ color: 'var(--text-muted, #64748b)' }}>
              Bots, fluxos de venda, redirecionadores e gateways — tudo em um único painel, com métricas em tempo real.
            </p>

            <DashboardCard />
          </div>
        </div>

        {/* Social proof */}
        <div className="relative z-10 flex items-center gap-10 px-10 xl:px-16 py-5"
          style={{ borderTop: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, rgba(255,255,255,0.6))' }}>
          {[
            { value: '1,4M+',   label: 'mensagens entregues' },
            { value: 'R$ 84M',  label: 'em vendas processadas' },
            { value: '99,98%',  label: 'uptime do painel' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-lg font-bold" style={{ color: 'var(--text, #0f172a)' }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-subtle, #94a3b8)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
