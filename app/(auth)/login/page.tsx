'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/dashboard'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : authError.message === 'Email not confirmed'
          ? 'Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.'
          : authError.message,
      )
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen flex bg-[var(--bg,#f8f9fb)]" style={{ colorScheme: 'light dark' }}>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] shrink-0 flex-col bg-[var(--primary,#7c3aed)] p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
        <div className="relative z-10 flex flex-col h-full">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg viewBox="0 0 32 32" width="22" height="22">
                <path d="M16 4 L18.5 12 L27 16 L18.5 20 L16 28 L13.5 20 L5 16 L13.5 12 Z" fill="white" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">Umbra Bot</span>
          </Link>

          <div className="flex-1 flex flex-col justify-center py-16">
            <h1 className="text-[32px] xl:text-[38px] font-bold text-white leading-tight mb-4">
              Automatize suas vendas no Telegram
            </h1>
            <p className="text-white/70 text-[15px] leading-relaxed mb-10">
              Conecte seu bot, monte funis de venda, receba PIX e escale — sem mensalidade.
            </p>

            <div className="space-y-4">
              {[
                { icon: '🤖', text: 'Bots 24h atendendo e vendendo por você' },
                { icon: '💳', text: 'PIX integrado com split automático' },
                { icon: '📣', text: 'Remarketing e disparador em massa' },
                { icon: '📊', text: 'Dashboard com métricas em tempo real' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{item.icon}</span>
                  <span className="text-white/80 text-[14px]">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/40 text-[12px]">
            © {new Date().getFullYear()} Umbra Bot. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">

        {/* Mobile logo */}
        <Link href="/" className="lg:hidden flex items-center gap-2 mb-8">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect width="32" height="32" rx="9" fill="var(--primary,#7c3aed)" />
            <path d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z" fill="white" />
          </svg>
          <span className="font-bold text-[16px] text-[var(--text,#0f172a)]">Umbra Bot</span>
        </Link>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="text-[24px] font-bold text-[var(--text,#0f172a)] mb-1">Entrar na conta</h2>
            <p className="text-[14px] text-[var(--text-muted,#64748b)]">
              Não tem conta?{' '}
              <Link href="/register" className="text-[var(--primary,#7c3aed)] font-medium hover:underline">
                Criar gratuitamente
              </Link>
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
              <label className="block text-[13px] font-medium text-[var(--text,#0f172a)] mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,white)] text-[14px] text-[var(--text,#0f172a)] placeholder:text-[var(--text-subtle,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#7c3aed)]/30 focus:border-[var(--primary,#7c3aed)]/50 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium text-[var(--text,#0f172a)]">Senha</label>
                <Link href="/forgot-password" className="text-[12px] text-[var(--primary,#7c3aed)] hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,white)] text-[14px] text-[var(--text,#0f172a)] placeholder:text-[var(--text-subtle,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#7c3aed)]/30 focus:border-[var(--primary,#7c3aed)]/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle,#94a3b8)] hover:text-[var(--text-muted,#64748b)]"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 rounded-xl bg-[var(--primary,#7c3aed)] text-white text-[14px] font-semibold hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Entrando…
                </>
              ) : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-[var(--text-subtle,#94a3b8)]">
            Ao entrar você concorda com os{' '}
            <Link href="/termos" className="underline hover:text-[var(--text-muted,#64748b)]">Termos de Uso</Link>{' '}
            e a{' '}
            <Link href="/privacidade" className="underline hover:text-[var(--text-muted,#64748b)]">Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
