'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { AlertCircle, AlertTriangle, Info, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Conta } from './types'
import { fmtBRLdec } from './formatters'
import { Icon, Modal, Btn, Spinner } from './atoms'

function CurrencyInput({ valueCents, onChange, error }: {
  valueCents: number; onChange: (v: number) => void; error?: string | null
}) {
  const formatted = useMemo(
    () => (valueCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [valueCents],
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(parseInt(digits || '0', 10))
  }

  return (
    <div>
      <label className="block text-[12.5px] font-medium text-text mb-1.5">Valor do saque</label>
      <div className={cn(
        'relative flex items-center bg-surface border rounded-lg transition-colors focus-within:ring-2 focus-within:ring-primary/30',
        error ? 'border-danger focus-within:border-danger focus-within:ring-danger/25' : 'border-border focus-within:border-primary/60',
      )}>
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-[15px] font-medium">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatted}
          onChange={handleChange}
          autoFocus
          className="w-full h-14 pl-11 pr-3 bg-transparent text-[24px] font-semibold tnum text-text focus:outline-none placeholder:text-text-subtle"
        />
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-danger">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

export function WithdrawModal({ open, onClose, saldoDisponivel, contas }: {
  open: boolean; onClose: () => void; saldoDisponivel: number; contas: Conta[]
}) {
  const [step,       setStep]       = useState<'form' | 'confirm' | 'success'>('form')
  const [valorCents, setValorCents] = useState(0)
  const [contaId,    setContaId]    = useState(contas[0].id)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    if (open) { setStep('form'); setValorCents(0); setContaId(contas[0].id); setLoading(false); setApiError(null) }
  }, [open, contas])

  const valor = valorCents / 100
  const conta = contas.find((c) => c.id === contaId)!
  const error = valor <= 0 ? null : valor > saldoDisponivel
    ? `Valor acima do saldo disponível (${fmtBRLdec(saldoDisponivel)}).`
    : null
  const canContinue = valor > 0 && !error

  function handleQuick(pct: number) { setValorCents(Math.floor(saldoDisponivel * pct * 100)) }

  const [apiError, setApiError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setApiError(null)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: valor, account_id: contaId, account_label: conta.label }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setApiError(json.error ?? 'Erro ao solicitar saque. Tente novamente.')
        return
      }
      setStep('success')
    } catch {
      setApiError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'success' ? null : 'Solicitar saque'}
      subtitle={step === 'form' ? `Saldo disponível: ${fmtBRLdec(saldoDisponivel)}` : null}
      size="md"
      footer={
        step === 'form' ? (
          <>
            <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" iconName="arrow-right" disabled={!canContinue} onClick={() => setStep('confirm')}>Continuar</Btn>
          </>
        ) : step === 'confirm' ? (
          <>
            <Btn variant="secondary" iconName="arrow-left" onClick={() => setStep('form')}>Voltar</Btn>
            <Btn variant="primary" onClick={handleConfirm} disabled={loading}>
              {loading ? <><Spinner /> Processando…</> : 'Confirmar saque'}
            </Btn>
          </>
        ) : (
          <Btn variant="primary" onClick={onClose} className="ml-auto">Fechar</Btn>
        )
      }
    >
      {step === 'form' && (
        <div className="space-y-4">
          <CurrencyInput valueCents={valorCents} onChange={setValorCents} error={error} />

          <div className="flex gap-1.5">
            {[{ label: '25%', pct: 0.25 }, { label: '50%', pct: 0.50 }, { label: '75%', pct: 0.75 }, { label: 'Tudo', pct: 1 }].map((q) => (
              <button
                key={q.label}
                onClick={() => handleQuick(q.pct)}
                className="flex-1 h-8 text-[12px] font-medium bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text rounded-md tnum"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Conta de destino</label>
            <div className="space-y-2">
              {contas.map((c) => (
                <label
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    contaId === c.id ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2',
                  )}
                >
                  <input type="radio" name="conta" checked={contaId === c.id} onChange={() => setContaId(c.id)} className="sr-only" />
                  <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', contaId === c.id ? 'border-primary' : 'border-border-strong')}>
                    {contaId === c.id && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-text truncate">{c.label}</div>
                    <div className="text-[11px] text-text-muted">{c.bank} · {c.kind}</div>
                  </div>
                  <Icon name={c.id === 'pix' ? 'zap' : 'landmark'} size={15} className="text-text-muted" />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 bg-surface-2/50 border border-border rounded-lg p-3">
            <Info size={14} className="text-text-muted mt-0.5 shrink-0" />
            <div className="text-[11.5px] text-text-muted leading-relaxed">
              Saques via Pix são processados em até <strong className="text-text">1 dia útil</strong>. Não há taxa adicional sobre o valor solicitado.
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="bg-surface-2/50 border border-border rounded-lg p-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Valor a sacar</div>
            <div className="text-[32px] font-semibold tnum text-text leading-none mt-1.5 tracking-tight">{fmtBRLdec(valor)}</div>
            <div className="text-[11.5px] text-text-muted mt-1.5 tnum">Saldo após o saque: {fmtBRLdec(saldoDisponivel - valor)}</div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Destino</div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-md bg-surface-2 text-text-muted flex items-center justify-center">
                <Icon name={conta.id === 'pix' ? 'zap' : 'landmark'} size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-text truncate">{conta.label}</div>
                <div className="text-[11px] text-text-muted">{conta.bank} · {conta.kind}</div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-warning-soft border border-warning/30 rounded-lg p-3">
            <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
            <div className="text-[11.5px] text-warning leading-relaxed">
              Confirme os dados antes de prosseguir. Saques solicitados não podem ser cancelados após confirmação.
            </div>
          </div>

          {apiError && (
            <div className="flex items-start gap-2 bg-danger/5 border border-danger/30 rounded-lg p-3">
              <AlertCircle size={14} className="text-danger mt-0.5 shrink-0" />
              <div className="text-[11.5px] text-danger leading-relaxed">{apiError}</div>
            </div>
          )}
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-success-soft text-success flex items-center justify-center mb-4">
            <Check size={26} />
          </div>
          <h3 className="text-[16px] font-semibold text-text">Saque solicitado</h3>
          <p className="text-[12.5px] text-text-muted mt-1.5 max-w-xs mx-auto">
            <span className="text-text font-medium tnum">{fmtBRLdec(valor)}</span> serão transferidos para{' '}
            <span className="text-text">{conta.label}</span> em até 1 dia útil.
          </p>
        </div>
      )}
    </Modal>
  )
}
