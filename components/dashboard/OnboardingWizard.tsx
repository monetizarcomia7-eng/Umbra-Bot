'use client'

import React, { useState } from 'react'
import { Bot, CreditCard, CheckCircle2, ArrowRight, X, AlertCircle, Loader2, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  onComplete: () => void
}

type Step = 'welcome' | 'bot' | 'gateway' | 'done'

const GATEWAYS = [
  { id: 'pushinpay',   name: 'Pushinpay',   desc: 'PIX instantâneo, split nativo',   color: '#16a34a' },
  { id: 'mercadopago', name: 'Mercado Pago', desc: 'PIX + cartão + boleto',           color: '#009ee3' },
  { id: 'pagarme',     name: 'Pagar.me',     desc: 'Split nativo, marketplace',       color: '#7c3aed' },
  { id: 'stripe',      name: 'Stripe',       desc: 'Internacional, múltiplas moedas', color: '#635bff' },
]

function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ['welcome', 'bot', 'gateway', 'done']
  const idx = steps.indexOf(step)
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {steps.slice(0, 3).map((s, i) => (
        <React.Fragment key={s}>
          <div className={`h-1.5 flex-1 rounded-full transition-all ${i <= idx - 1 ? 'bg-emerald-500' : i === idx - 0 ? 'bg-primary' : 'bg-border'}`}
            style={{ background: i < idx ? '#22c55e' : i === idx ? 'var(--primary, #7c3aed)' : 'var(--border, #e2e8f0)' }} />
          {i < 2 && <div className="w-1" />}
        </React.Fragment>
      ))}
    </div>
  )
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const benefits = [
    'Conecte bots do Telegram sem código',
    'Aceite PIX e cartão automaticamente',
    'Fluxos de venda no piloto automático',
    'Métricas em tempo real',
  ]
  return (
    <div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--primary-soft, #ede9fe)' }}>
        <Zap size={26} style={{ color: 'var(--primary, #7c3aed)' }} />
      </div>
      <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--text, #0f172a)' }}>
        Boas-vindas ao Umbra Bot!
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
        Você está a 2 passos de vender no Telegram no piloto automático.
      </p>
      <div className="space-y-2 mb-8">
        {benefits.map((b) => (
          <div key={b} className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
            <span className="text-sm" style={{ color: 'var(--text, #0f172a)' }}>{b}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ background: 'var(--primary, #7c3aed)' }}
      >
        Começar configuração
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

function BotStep({ userId, onNext, onSkip }: { userId: string; onNext: () => void; onSkip: () => void }) {
  const [name,    setName]    = useState('')
  const [token,   setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim() || !token.trim()) { setError('Preencha o nome e o token do bot.'); return }
    const tokenPattern = /^\d+:[A-Za-z0-9_-]{35,}$/
    if (!tokenPattern.test(token.trim())) {
      setError('Token inválido. Formato: 123456789:AABBccDDeeffGGhhIIjjKKllMMnnOOppQQ')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: dbError } = await supabase.from('bots').insert({
        user_id: userId,
        name: name.trim(),
        token: token.trim(),
        status: 'offline',
        username: '',
      })
      if (dbError) throw dbError
      onNext()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar bot.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--primary-soft, #ede9fe)' }}>
        <Bot size={26} style={{ color: 'var(--primary, #7c3aed)' }} />
      </div>
      <h2 className="text-[22px] font-bold mb-1" style={{ color: 'var(--text, #0f172a)' }}>
        Conectar seu bot
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
        Crie um bot no @BotFather do Telegram e cole o token abaixo.
      </p>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm mb-4"
          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
            Nome do bot
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Vendas VIP"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
            onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
            onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text, #0f172a)' }}>
            Token do bot (via @BotFather)
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456789:AABBccDD..."
            className="w-full px-4 py-2.5 rounded-xl text-sm font-mono outline-none"
            style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)' }}
            onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; e.target.style.borderColor = '#7c3aed' }}
            onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #e2e8f0)' }}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle, #94a3b8)' }}>
            Abra o Telegram → @BotFather → /newbot → copie o token.
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 mb-3 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'var(--primary, #7c3aed)' }}
      >
        {loading ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <>Conectar bot <ArrowRight size={16} /></>}
      </button>
      <button onClick={onSkip} className="w-full text-center text-sm py-2 hover:underline"
        style={{ color: 'var(--text-muted, #64748b)' }}>
        Pular por enquanto
      </button>
    </div>
  )
}

function GatewayStep({ userId, onNext, onSkip }: { userId: string; onNext: () => void; onSkip: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSave() {
    if (!selected) { onNext(); return }
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.from('gateways').insert({
        user_id: userId,
        provider: selected,
        name: GATEWAYS.find((g) => g.id === selected)?.name ?? selected,
        status: 'pending',
        credentials: {},
      })
    } catch {
      // silent — gateway table may not have all columns yet
    } finally {
      setLoading(false)
      onNext()
    }
  }

  return (
    <div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--primary-soft, #ede9fe)' }}>
        <CreditCard size={26} style={{ color: 'var(--primary, #7c3aed)' }} />
      </div>
      <h2 className="text-[22px] font-bold mb-1" style={{ color: 'var(--text, #0f172a)' }}>
        Escolher gateway
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
        Qual gateway você usa para receber pagamentos?
      </p>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {GATEWAYS.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelected(selected === g.id ? null : g.id)}
            className="text-left p-3 rounded-xl transition-all"
            style={{
              border: selected === g.id ? `2px solid var(--primary, #7c3aed)` : '1px solid var(--border, #e2e8f0)',
              background: selected === g.id ? 'var(--primary-soft, #ede9fe)' : 'var(--surface, #fff)',
            }}
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center mb-1.5 text-white text-xs font-bold"
              style={{ background: g.color }}>
              {g.name[0]}
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text, #0f172a)' }}>{g.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted, #64748b)' }}>{g.desc}</div>
          </button>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
        style={{ background: 'var(--primary, #7c3aed)' }}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <>{selected ? 'Salvar e continuar' : 'Continuar'} <ArrowRight size={16} /></>}
      </button>
      <button onClick={onSkip} className="w-full text-center text-sm py-2 hover:underline"
        style={{ color: 'var(--text-muted, #64748b)' }}>
        Configurar depois
      </button>
    </div>
  )
}

function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <CheckCircle2 size={30} className="text-emerald-600" />
      </div>
      <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--text, #0f172a)' }}>
        Tudo pronto!
      </h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-muted, #64748b)' }}>
        Seu bot está conectado. Agora configure um fluxo de venda para começar a receber pedidos automaticamente.
      </p>
      <button
        onClick={onClose}
        className="w-full h-11 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ background: 'var(--primary, #7c3aed)' }}
      >
        Ir para o dashboard
      </button>
    </div>
  )
}

export function OnboardingWizard({ userId, onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-[480px] rounded-2xl p-8"
        style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {step !== 'done' && (
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2"
            style={{ color: 'var(--text-muted, #64748b)' }}
            title="Fechar"
          >
            <X size={16} />
          </button>
        )}

        {step !== 'welcome' && step !== 'done' && (
          <ProgressBar step={step} />
        )}

        {step === 'welcome' && (
          <WelcomeStep onNext={() => setStep('bot')} />
        )}
        {step === 'bot' && (
          <BotStep userId={userId} onNext={() => setStep('gateway')} onSkip={() => setStep('gateway')} />
        )}
        {step === 'gateway' && (
          <GatewayStep userId={userId} onNext={() => setStep('done')} onSkip={() => setStep('done')} />
        )}
        {step === 'done' && (
          <DoneStep onClose={onComplete} />
        )}
      </div>
    </div>
  )
}
