'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertCircle, AlertTriangle, Info, Check, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalytics } from '@/hooks/use-analytics'
import type { BankAccount } from './types'
import { fmtBRLdec } from './formatters'
import { Icon, Modal, Btn, Spinner } from './atoms'

function maskPixKey(key: string): string {
  if (key.length <= 8) return key
  return `${key.slice(0, 4)}•••${key.slice(-4)}`
}

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

const KIND_LABEL: Record<string, string> = { pix: 'Pix', conta: 'Conta corrente', ted: 'TED' }
const KIND_ICON:  Record<string, string> = { pix: 'zap', conta: 'landmark', ted: 'landmark' }

export function WithdrawModal({ open, onClose, onSuccess, saldoDisponivel }: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  saldoDisponivel: number
}) {
  const { track } = useAnalytics()
  const [step,       setStep]       = useState<'form' | 'confirm' | 'success'>('form')
  const [valorCents, setValorCents] = useState(0)
  const [accountId,  setAccountId]  = useState<string>('')
  const [loading,    setLoading]    = useState(false)
  const [apiError,   setApiError]   = useState<string | null>(null)

  // Saldo fresco buscado ao abrir o modal (P8)
  const [liveBalance,    setLiveBalance]    = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  // Contas bancárias
  const [accounts,        setAccounts]        = useState<BankAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [deletingId,      setDeletingId]      = useState<string | null>(null)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)

  // Formulário de nova conta
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel,    setNewLabel]    = useState('')
  const [newPixKey,   setNewPixKey]   = useState('')
  const [newKind,     setNewKind]     = useState<'pix' | 'conta' | 'ted'>('pix')
  const [addLoading,  setAddLoading]  = useState(false)
  const [addError,    setAddError]    = useState<string | null>(null)
  const [addSuccess,  setAddSuccess]  = useState(false)

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true)
    try {
      const res = await fetch('/api/bank-accounts')
      if (res.ok) {
        const data: BankAccount[] = await res.json()
        setAccounts(data)
        setAccountId((prev) => prev || data[0]?.id || '')
      }
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true)
    try {
      const res = await fetch('/api/finance/balance')
      if (!res.ok) return
      const d: { saldo_disponivel: number } = await res.json()
      setLiveBalance(Number(d.saldo_disponivel))
    } catch {
      // fallback silencioso para o saldo da prop
    } finally {
      setBalanceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setLiveBalance(null)
      return
    }
    setStep('form')
    setValorCents(0)
    setLoading(false)
    setApiError(null)
    setShowAddForm(false)
    setNewLabel('')
    setNewPixKey('')
    setNewKind('pix')
    setAddError(null)
    setAddSuccess(false)
    setDeleteError(null)
    fetchAccounts()
    fetchBalance()
  }, [open, fetchAccounts, fetchBalance])

  useEffect(() => {
    if (!addSuccess) return
    const t = setTimeout(() => setAddSuccess(false), 3000)
    return () => clearTimeout(t)
  }, [addSuccess])

  async function handleAddAccount() {
    if (!newLabel.trim() || !newPixKey.trim()) {
      setAddError('Preencha todos os campos.')
      return
    }
    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), pix_key: newPixKey.trim(), kind: newKind }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setAddError(json.error ?? 'Erro ao salvar conta.')
        return
      }
      const created: BankAccount = await res.json()
      setAccounts((prev) => [...prev, created])
      setAccountId(created.id)
      setShowAddForm(false)
      setNewLabel('')
      setNewPixKey('')
      setNewKind('pix')
      setAddSuccess(true)
      track('bank_account_added', { kind: newKind })
    } finally {
      setAddLoading(false)
    }
  }

  async function handleDeleteAccount(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setDeleteError(json.error ?? 'Erro ao remover conta.')
        return
      }
      const remaining = accounts.filter((a) => a.id !== id)
      setAccounts(remaining)
      if (accountId === id) setAccountId(remaining[0]?.id ?? '')
      track('bank_account_deleted', {})
    } finally {
      setDeletingId(null)
    }
  }

  // Usa o saldo fresco quando disponível, caso contrário usa a prop (stale)
  const displayBalance = liveBalance ?? saldoDisponivel

  const valor   = valorCents / 100
  const account = accounts.find((a) => a.id === accountId)

  const amountError = valor <= 0 ? null : valor > displayBalance
    ? `Valor acima do saldo disponível (${fmtBRLdec(displayBalance)}).`
    : null

  const canContinue = valor > 0 && !amountError && !!account

  function handleQuick(pct: number) { setValorCents(Math.floor(displayBalance * pct * 100)) }

  async function handleConfirm() {
    if (!account) return
    setLoading(true)
    setApiError(null)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: valor, account_id: account.id, account_label: account.label }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setApiError(json.error ?? 'Erro ao solicitar saque. Tente novamente.')
        return
      }
      track('withdrawal_requested', { amount: valor, account_kind: account.kind })
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
      subtitle={step === 'form'
        ? balanceLoading
          ? 'Verificando saldo…'
          : `Saldo disponível: ${fmtBRLdec(displayBalance)}`
        : null}
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
          <Btn variant="primary" onClick={onSuccess} className="ml-auto">Fechar</Btn>
        )
      }
    >
      {step === 'form' && (
        <div className="space-y-4">
          <CurrencyInput valueCents={valorCents} onChange={setValorCents} error={amountError} />

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
            <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-text mb-1.5">
              Conta de destino
              {accountsLoading && accounts.length > 0 && <Spinner />}
            </label>

            {accountsLoading && accounts.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-[12.5px] text-text-muted">
                <Spinner /> Carregando contas…
              </div>
            ) : accounts.length === 0 && !showAddForm ? (
              <div className="flex flex-col items-center gap-2 py-5 border border-dashed border-border rounded-lg text-center">
                <Icon name="landmark" size={20} className="text-text-muted" />
                <p className="text-[12.5px] text-text-muted">Nenhuma conta cadastrada.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-[12.5px] font-medium text-primary hover:underline"
                >
                  + Adicionar conta
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <label
                    key={acc.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors group',
                      accountId === acc.id ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2',
                    )}
                  >
                    <input type="radio" name="conta" checked={accountId === acc.id} onChange={() => setAccountId(acc.id)} className="sr-only" />
                    <span className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      accountId === acc.id ? 'border-primary' : 'border-border-strong',
                    )}>
                      {accountId === acc.id && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-text truncate">{acc.label}</div>
                      <div className="text-[11px] text-text-muted truncate">
                        {maskPixKey(acc.pix_key)} · {KIND_LABEL[acc.kind] ?? acc.kind}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Icon name={KIND_ICON[acc.kind] ?? 'landmark'} size={15} className="text-text-muted" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleDeleteAccount(acc.id) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-danger p-0.5 rounded"
                        disabled={deletingId === acc.id}
                        title="Remover conta"
                      >
                        {deletingId === acc.id ? <Spinner /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </label>
                ))}

                {!showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed border-border text-[12.5px] text-text-muted hover:text-text hover:border-border-strong transition-colors"
                  >
                    <Plus size={14} /> Adicionar conta
                  </button>
                )}
              </div>
            )}

            {deleteError && (
              <div className="flex items-center gap-1 text-[11.5px] text-danger mt-2">
                <AlertCircle size={12} /> {deleteError}
              </div>
            )}

            {addSuccess && (
              <div className="flex items-center gap-2 text-[12px] text-success bg-success-soft border border-success/25 rounded-lg px-3 py-2 mt-2">
                <Check size={13} className="shrink-0" />
                Conta adicionada com sucesso!
              </div>
            )}

            {showAddForm && (
              <div className="mt-2 border border-border rounded-lg p-3 space-y-3 bg-surface-2/50">
                <div className="text-[12.5px] font-semibold text-text">Nova conta</div>

                <div>
                  <label className="block text-[11.5px] text-text-muted mb-1">Apelido</label>
                  <input
                    type="text"
                    placeholder="Ex: Nubank pessoal"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-border bg-surface text-[13px] text-text focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] text-text-muted mb-1">Tipo</label>
                  <div className="flex gap-1.5">
                    {(['pix', 'conta', 'ted'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setNewKind(k)}
                        className={cn(
                          'flex-1 h-8 text-[12px] font-medium rounded-md border transition-colors',
                          newKind === k
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-border bg-surface text-text-muted hover:text-text',
                        )}
                      >
                        {KIND_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] text-text-muted mb-1">
                    {newKind === 'pix' ? 'Chave Pix' : 'Dados bancários'}
                  </label>
                  <input
                    type="text"
                    placeholder={newKind === 'pix' ? 'CPF, e-mail, telefone ou chave aleatória' : 'Banco, agência e conta'}
                    value={newPixKey}
                    onChange={(e) => setNewPixKey(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-border bg-surface text-[13px] text-text focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {addError && (
                  <div className="flex items-center gap-1 text-[11.5px] text-danger">
                    <AlertCircle size={12} /> {addError}
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <Btn variant="secondary" onClick={() => { setShowAddForm(false); setAddError(null) }}>Cancelar</Btn>
                  <Btn variant="primary" onClick={handleAddAccount} disabled={addLoading}>
                    {addLoading ? <><Spinner /> Salvando…</> : 'Salvar conta'}
                  </Btn>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 bg-surface-2/50 border border-border rounded-lg p-3">
            <Info size={14} className="text-text-muted mt-0.5 shrink-0" />
            <div className="text-[11.5px] text-text-muted leading-relaxed">
              Saques via Pix são processados em até <strong className="text-text">1 dia útil</strong>. Não há taxa adicional sobre o valor solicitado.
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && account && (
        <div className="space-y-4">
          <div className="bg-surface-2/50 border border-border rounded-lg p-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Valor a sacar</div>
            <div className="text-[32px] font-semibold tnum text-text leading-none mt-1.5 tracking-tight">{fmtBRLdec(valor)}</div>
            <div className="text-[11.5px] text-text-muted mt-1.5 tnum">Saldo após o saque: {fmtBRLdec(displayBalance - valor)}</div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Destino</div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-md bg-surface-2 text-text-muted flex items-center justify-center">
                <Icon name={KIND_ICON[account.kind] ?? 'landmark'} size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-text truncate">{account.label}</div>
                <div className="text-[11px] text-text-muted truncate">
                  {maskPixKey(account.pix_key)} · {KIND_LABEL[account.kind] ?? account.kind}
                </div>
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
            <span className="text-text">{account?.label}</span> em até 1 dia útil.
          </p>
        </div>
      )}
    </Modal>
  )
}
