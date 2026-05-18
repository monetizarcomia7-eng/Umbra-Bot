'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Zap, ArrowUpRight,
  Bot, Megaphone, ShoppingCart, ExternalLink, Sun, Moon, Eye, EyeOff, Info,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconMap: Record<string, LucideIcon> = {
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  'check-circle-2': CheckCircle2,
  'zap': Zap,
  'arrow-up-right': ArrowUpRight,
  'bot': Bot,
  'megaphone': Megaphone,
  'shopping-cart': ShoppingCart,
  'external-link': ExternalLink,
  'sun': Sun,
  'moon': Moon,
  'eye': Eye,
  'eye-off': EyeOff,
  'info': Info,
}

function Icon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const IconComp = iconMap[name]
  if (!IconComp) return null
  return <IconComp size={size} className={cn('shrink-0', className)} />
}

function Logo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg viewBox="0 0 32 32" width={size} height={size} className="shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z" fill="white" />
      </svg>
      {withWordmark && (
        <div className="font-semibold tracking-tight text-[15px] leading-none text-text">
          Umbra<span className="text-text-muted font-normal"> Bot</span>
        </div>
      )}
    </div>
  )
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Mode = 'signin' | 'signup'

interface FormValues {
  name: string
  email: string
  password: string
  confirm: string
  remember: boolean
}

function validateField(name: string, value: string | boolean, allValues: FormValues, mode: Mode): string | null {
  const s = typeof value === 'string' ? value : ''
  if (name === 'name') {
    if (!s.trim()) return 'Informe seu nome.'
    if (s.trim().length < 2) return 'Nome muito curto.'
  }
  if (name === 'email') {
    if (!s.trim()) return 'Informe seu e-mail.'
    if (!emailRe.test(s.trim())) return 'E-mail inválido.'
  }
  if (name === 'password') {
    if (!s) return 'Informe sua senha.'
    if (mode === 'signup' && s.length < 8) return 'Mínimo 8 caracteres.'
  }
  if (name === 'confirm') {
    if (!s) return 'Confirme sua senha.'
    if (s !== allValues.password) return 'As senhas não conferem.'
  }
  return null
}

function Field({
  label, type = 'text', name, value, onChange, onBlur,
  error, hint, autoComplete, placeholder, rightSlot, autoFocus,
}: {
  label: string
  type?: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  error?: string | null | false
  hint?: string | null
  autoComplete?: string
  placeholder?: string
  rightSlot?: React.ReactNode
  autoFocus?: boolean
}) {
  const inputId = `f-${name}`
  const hasError = !!error
  return (
    <div>
      <label htmlFor={inputId} className="block text-[12.5px] font-medium text-text mb-1.5">
        {label}
      </label>
      <div className={cn(
        'relative flex items-center bg-surface border rounded-lg transition-colors',
        'focus-within:ring-2 focus-within:ring-primary/30',
        hasError
          ? 'border-danger focus-within:border-danger focus-within:ring-danger/25'
          : 'border-border focus-within:border-primary/60',
      )}>
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full h-10 px-3 bg-transparent text-[13.5px] text-text placeholder:text-text-subtle focus:outline-none"
        />
        {rightSlot}
      </div>
      {hasError ? (
        <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-danger">
          <Icon name="alert-circle" size={12} />
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div className="mt-1.5 text-[11.5px] text-text-muted">{hint}</div>
      ) : null}
    </div>
  )
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-2"
      title={shown ? 'Ocultar senha' : 'Mostrar senha'}
    >
      <Icon key={shown ? 's' : 'h'} name={shown ? 'eye-off' : 'eye'} size={15} />
    </button>
  )
}

function Checkbox({ checked, onChange, label, id }: {
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  label: string
  id: string
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none group">
      <span className={cn(
        'w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0',
        checked
          ? 'bg-primary border-primary text-primary-fg'
          : 'bg-surface border-border-strong group-hover:border-text-muted',
      )}>
        {checked && (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8 7 12 13 4" />
          </svg>
        )}
      </span>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-[12.5px] text-text-muted group-hover:text-text">{label}</span>
    </label>
  )
}

function SubmitButton({ loading, children, disabled }: {
  loading: boolean
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={cn(
        'relative w-full h-10 rounded-lg text-[13.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors focus-ring',
        'bg-primary text-primary-fg hover:bg-primary-hover',
        'disabled:opacity-80 disabled:cursor-not-allowed',
      )}
    >
      {loading && (
        <svg viewBox="0 0 24 24" width="15" height="15" className="spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      <span>{children}</span>
    </button>
  )
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex p-1 bg-surface-2 border border-border rounded-lg" role="tablist">
      {([
        { id: 'signin' as Mode, label: 'Entrar' },
        { id: 'signup' as Mode, label: 'Criar conta' },
      ]).map((t) => {
        const active = mode === t.id
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => setMode(t.id)}
            className={cn(
              'flex-1 h-8 text-[12.5px] font-medium rounded-md transition-colors focus-ring',
              active
                ? 'bg-surface text-text border border-border'
                : 'text-text-muted hover:text-text',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function AuthThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-9 h-9" />

  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text focus-ring"
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={17} />
    </button>
  )
}

const initialValues: FormValues = { name: '', email: '', password: '', confirm: '', remember: true }

function AuthForm({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setErrors({})
    setTouched({})
    setServerError('')
    setSuccess('')
  }, [mode])

  const update = (name: string, value: string | boolean) => {
    const next = { ...values, [name]: value }
    setValues(next)
    if (touched[name] && typeof value === 'string') {
      const err = validateField(name, value, next, mode)
      setErrors((e) => ({ ...e, [name]: err ?? undefined }))
      if (name === 'password' && touched.confirm && mode === 'signup') {
        const cerr = validateField('confirm', next.confirm, next, mode)
        setErrors((e) => ({ ...e, confirm: cerr ?? undefined }))
      }
    }
  }

  const handleBlur = (name: string) => {
    setTouched((t) => ({ ...t, [name]: true }))
    const err = validateField(name, values[name as keyof FormValues], values, mode)
    setErrors((e) => ({ ...e, [name]: err ?? undefined }))
  }

  const fieldsForMode = mode === 'signup'
    ? ['name', 'email', 'password', 'confirm']
    : ['email', 'password']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess('')
    const allErrors: Record<string, string> = {}
    fieldsForMode.forEach((f) => {
      const err = validateField(f, values[f as keyof FormValues], values, mode)
      if (err) allErrors[f] = err
    })
    setErrors(allErrors)
    setTouched(Object.fromEntries(fieldsForMode.map((f) => [f, true])))
    if (Object.keys(allErrors).length) return

    setLoading(true)
    setServerError('')

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      })
      setLoading(false)
      if (error) {
        setServerError('E-mail ou senha incorretos. Tente novamente.')
      } else {
        setSuccess(`Bem-vindo de volta, ${values.email.split('@')[0]}. Redirecionando…`)
        setTimeout(() => router.push('/dashboard'), 1000)
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: { name: values.name.trim() },
        },
      })
      setLoading(false)
      if (error) {
        setServerError(error.message ?? 'Não foi possível criar a conta. Tente novamente.')
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      }
    }
  }

  const isSignup = mode === 'signup'

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <ModeToggle mode={mode} setMode={setMode} />

      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-text leading-tight">
          {isSignup ? 'Crie sua conta' : 'Bem-vindo de volta'}
        </h1>
        <p className="text-[13.5px] text-text-muted mt-1">
          {isSignup
            ? 'Comece em menos de 60 segundos. Sem cartão de crédito.'
            : 'Acesse o painel para gerenciar seus bots e vendas.'}
        </p>
      </div>

      {serverError && (
        <div className="flex items-start gap-2.5 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2.5 fade-up">
          <Icon name="alert-triangle" size={15} className="text-danger mt-0.5" />
          <div className="text-[12.5px] text-danger leading-snug">{serverError}</div>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 bg-success-soft border border-success/30 rounded-lg px-3 py-2.5 fade-up">
          <Icon name="check-circle-2" size={15} className="text-success mt-0.5" />
          <div className="text-[12.5px] text-success leading-snug">{success}</div>
        </div>
      )}

      <div key={mode} className="space-y-3.5 fade-up">
        {isSignup && (
          <Field
            label="Nome completo"
            name="name"
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            error={touched.name ? errors.name : null}
            autoComplete="name"
            placeholder="Como podemos te chamar?"
            autoFocus
          />
        )}
        <Field
          label="E-mail"
          name="email"
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          error={touched.email ? errors.email : null}
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          autoFocus={!isSignup}
        />
        <Field
          label="Senha"
          name="password"
          type={showPwd ? 'text' : 'password'}
          value={values.password}
          onChange={(e) => update('password', e.target.value)}
          onBlur={() => handleBlur('password')}
          error={touched.password ? errors.password : null}
          hint={isSignup ? 'Mínimo 8 caracteres.' : null}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder="••••••••"
          rightSlot={<PasswordToggle shown={showPwd} onToggle={() => setShowPwd((s) => !s)} />}
        />
        {isSignup && (
          <Field
            label="Confirme a senha"
            name="confirm"
            type={showConfirm ? 'text' : 'password'}
            value={values.confirm}
            onChange={(e) => update('confirm', e.target.value)}
            onBlur={() => handleBlur('confirm')}
            error={touched.confirm ? errors.confirm : null}
            autoComplete="new-password"
            placeholder="••••••••"
            rightSlot={<PasswordToggle shown={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />}
          />
        )}
      </div>

      {!isSignup && (
        <div className="flex items-center justify-between">
          <Checkbox
            id="remember"
            checked={values.remember}
            onChange={(e) => update('remember', e.target.checked)}
            label="Lembrar-me"
          />
          <a href="#" className="text-[12.5px] font-medium text-primary hover:underline">
            Esqueci a senha
          </a>
        </div>
      )}

      <SubmitButton loading={loading}>
        {loading
          ? (isSignup ? 'Criando conta…' : 'Entrando…')
          : (isSignup ? 'Criar conta' : 'Entrar')}
      </SubmitButton>

      {isSignup && (
        <p className="text-[11.5px] text-text-subtle text-center leading-relaxed">
          Ao criar uma conta, você concorda com nossos{' '}
          <a href="#" className="text-text-muted hover:text-text underline-offset-2 hover:underline">Termos</a>
          {' '}e{' '}
          <a href="#" className="text-text-muted hover:text-text underline-offset-2 hover:underline">Política de Privacidade</a>.
        </p>
      )}

      <div className="text-[11px] text-text-subtle text-center pt-2 border-t border-dashed border-border">
        <Icon name="info" size={11} className="inline-block mr-1 -mt-0.5" />
        Demo: use a senha{' '}
        <kbd className="bg-surface-2 border border-border rounded px-1 text-[10.5px] tnum">umbra2026</kbd>
        {' '}para entrar com sucesso. Qualquer outra simula erro.
      </div>
    </form>
  )
}

function Sparkline({ data, width = 240, height = 56 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 6) - 3])
  const path = `M ${pts[0][0]},${pts[0][1]} L ${pts.slice(1).map((p) => `${p[0]},${p[1]}`).join(' L ')}`
  const area = `${path} L ${pts[pts.length - 1][0]},${height} L 0,${height} Z`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block w-full h-auto">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkGrad)" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PreviewCard() {
  const sparkData = [22, 26, 24, 30, 28, 34, 32, 40, 36, 44, 42, 48, 46, 56, 52, 64]
  return (
    <div className="relative w-full max-w-sm">
      <div
        className="absolute -top-5 -left-3 z-20 bg-surface border border-border rounded-lg pl-2 pr-3 py-1.5 flex items-center gap-2"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <span className="w-6 h-6 rounded-md bg-success-soft text-success flex items-center justify-center">
          <Icon name="zap" size={12} />
        </span>
        <div className="text-[11px] leading-tight">
          <div className="font-medium text-text">Nova venda</div>
          <div className="text-text-muted tnum">R$ 297,00 · há 12s</div>
        </div>
      </div>

      <div
        className="bg-surface border border-border rounded-2xl p-5 relative z-10"
        style={{ boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-text-muted font-medium">Receita hoje</div>
          <div className="text-[10.5px] text-success bg-success-soft rounded-md px-1.5 py-0.5 font-semibold tnum inline-flex items-center gap-0.5">
            <Icon name="arrow-up-right" size={10} /> 24,1%
          </div>
        </div>
        <div className="mt-2 text-[34px] font-semibold tnum text-text leading-none tracking-tight">
          R$ 12.480
        </div>
        <div className="text-[11.5px] text-text-muted mt-1.5 tnum">vs. R$ 10.054 ontem</div>

        <div className="mt-4 -mx-1">
          <Sparkline data={sparkData} width={300} height={64} />
        </div>

        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {[
            { icon: 'bot',           label: 'Funil VIP — Mentoria', value: 'R$ 6.842' },
            { icon: 'megaphone',     label: 'Remarketing 24h',      value: 'R$ 3.196' },
            { icon: 'shopping-cart', label: 'Checkout direto',      value: 'R$ 2.442' },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2.5 text-[12px]">
              <span className="w-6 h-6 rounded-md bg-surface-2 text-text-muted flex items-center justify-center">
                <Icon name={r.icon} size={12} />
              </span>
              <span className="flex-1 text-text truncate">{r.label}</span>
              <span className="tnum font-medium text-text">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute -bottom-4 right-4 z-20 bg-surface border border-border rounded-lg px-2.5 py-1.5 flex items-center gap-2"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <span className="relative w-2 h-2 rounded-full bg-success">
          <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
        </span>
        <span className="text-[11px] text-text-muted">14 bots ativos · 1.284 leads online</span>
      </div>
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="brand-panel relative w-full overflow-hidden border-l border-border flex flex-col px-10 xl:px-14 py-10">
      <div className="relative z-10 flex flex-col h-full justify-between gap-10">
        <div className="flex items-center gap-2 text-[11.5px] text-text-muted">
          <span className="relative w-1.5 h-1.5 rounded-full bg-success">
            <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
          </span>
          <span>Umbra Bot · todos os sistemas operacionais</span>
        </div>

        <div className="flex flex-col gap-10 max-w-xl">
          <div>
            <h2 className="text-[36px] xl:text-[42px] font-semibold tracking-tight leading-[1.05] text-text">
              Venda no Telegram{' '}
              <span className="text-primary">no piloto automático</span>.
            </h2>
            <p className="text-text-muted text-[14.5px] mt-4 max-w-md leading-relaxed">
              Bots, fluxos de venda, redirecionadores e gateways — tudo em um único painel multi-tenant, com métricas em tempo real.
            </p>
          </div>

          <PreviewCard />
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-lg pt-6 border-t border-border">
          {[
            { value: '1,4M+',  label: 'mensagens entregues'   },
            { value: 'R$ 84M', label: 'em vendas processadas' },
            { value: '99,98%', label: 'uptime do painel'      },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-[20px] font-semibold tnum text-text leading-none tracking-tight">{s.value}</div>
              <div className="text-[11px] text-text-muted mt-1.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') === 'signup') setMode('signup')
  }, [])

  return (
    <div className="min-h-screen flex bg-bg text-text">
      <div className="flex-1 flex flex-col px-5 md:px-10 lg:px-14 py-6 md:py-8 min-w-0">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text px-2.5 h-9 rounded-lg hover:bg-surface-2 focus-ring"
            >
              <Icon name="external-link" size={13} />
              Ver painel demo
            </Link>
            <AuthThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-full max-w-[400px]">
            <AuthForm mode={mode} setMode={setMode} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11.5px] text-text-subtle">
          <div>© 2026 Umbra Bot · Todos os direitos reservados.</div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-text-muted">Termos</a>
            <a href="#" className="hover:text-text-muted">Privacidade</a>
            <a href="#" className="hover:text-text-muted">Status</a>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 max-w-[640px] xl:max-w-[760px]">
        <BrandPanel />
      </div>
    </div>
  )
}
