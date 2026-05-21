'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Plug, TrendingUp, ArrowLeftRight, Percent, Landmark, RefreshCw,
  Zap, CreditCard, FileText, Settings, Unplug, Check, X, Eye, EyeOff,
  Info, AlertCircle, ChevronRight, Loader2, Scissors, CheckCircle2, XCircle,
  ExternalLink,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  connectGatewayAction,
  disconnectGatewayAction,
  updateGatewayAction,
  validateGatewayCredentialsAction,
  testGatewayConnectionAction,
} from '@/app/actions/gateways'
import type { RawGateway, RawBankAccount, GatewayStats } from './page'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatewayFee { pix?: number; card?: number; boleto?: number }

interface GatewayItem {
  id:          string | null
  provider:    string
  name:        string
  description: string
  initial:     string
  color:       string
  methods:     string[]
  fee:         GatewayFee
  feeText:     string
  connected:   boolean
  account?:    string
  accountId?:  string
  lastSync?:   number
  volume30d:   number
  tx30d:       number
}

// ─── Static catalog ───────────────────────────────────────────────────────────

const GATEWAY_CATALOG: Record<string, Omit<GatewayItem, 'id' | 'provider' | 'connected' | 'account' | 'accountId' | 'lastSync' | 'volume30d' | 'tx30d'>> = {
  mercadopago: {
    name: 'Mercado Pago', initial: 'M', color: 'oklch(0.62 0.16 240)',
    description: 'Gateway tradicional com Pix, cartão (até 12x) e boleto. Antifraude integrado.',
    methods: ['Pix', 'Cartão', 'Boleto'], fee: { pix: 0.99, card: 4.99, boleto: 3.49 }, feeText: 'A partir de 0,99%',
  },
}

const CREDENTIAL_SCHEMA: Record<string, { label: string; placeholder: string; hint: string }> = {
  mercadopago: { label: 'Access Token', placeholder: 'APP_USR-0000000000000000-MMDDHHMMSS-XXXXXX', hint: 'Em Mercado Pago → Credenciais → Access Token de Produção.' },
}

const UMBRA_FEE_PCT   = 3
const ALL_PROVIDERS   = Object.keys(GATEWAY_CATALOG)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeGateways(db: RawGateway[], stats: GatewayStats): GatewayItem[] {
  return ALL_PROVIDERS.map(provider => {
    const cat = GATEWAY_CATALOG[provider]
    const row = db.find(g => g.provider === provider)
    const s   = stats[provider] ?? {}
    return {
      id:         row?.id ?? null,
      provider,
      ...cat,
      connected:  row?.connected ?? false,
      account:    row?.account   ?? undefined,
      accountId:  row?.account_id ?? undefined,
      lastSync:   row ? new Date(row.updated_at).getTime() : undefined,
      volume30d:  Number(s.volume_30d ?? 0),
      tx30d:      Number(s.tx_30d     ?? 0),
    }
  })
}

function relTime(dt: number, now: number): string {
  const diff = now - dt
  const m    = Math.floor(diff / 60_000)
  if (m < 1)  return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtPct = (n: number, d = 2) => n.toFixed(d).replace('.', ',') + '%'

// ─── UI atoms ────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-surface border border-border rounded-xl ${className}`}>{children}</div>
}

function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'; onClick?: () => void; disabled?: boolean; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v    = { primary: 'bg-primary text-primary-fg hover:bg-primary/90', secondary: 'bg-surface border border-border text-text hover:bg-surface-2', ghost: 'text-text-muted hover:text-text hover:bg-surface-2', danger: 'bg-[color:var(--danger)] text-white hover:bg-[color:var(--danger)]/90' }[variant]
  return <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  const t: Record<string, string> = {
    success: 'bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20',
    warning: 'bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/20',
    danger:  'bg-[color:var(--danger)]/10 text-[color:var(--danger)] border-[color:var(--danger)]/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    muted:   'bg-surface-2 text-text-muted border-border',
  }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${t[tone] ?? t.muted}`}>{children}</span>
}

function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  size?: 'sm' | 'md' | 'lg'; children: React.ReactNode; footer?: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const maxW = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`bg-surface border border-border rounded-2xl shadow-xl w-full ${maxW} flex flex-col max-h-[90vh]`}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div>
              {title    && <h2 className="text-[15px] font-semibold text-text">{title}</h2>}
              {subtitle && <p className="text-[12px] text-text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="ml-4 w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"><X size={14} /></button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 pb-5 pt-3 border-t border-border flex items-center justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-text mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-text-muted mt-1 leading-snug">{hint}</div>}
    </div>
  )
}

const inputCls = 'w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30'

// ─── Kpi ─────────────────────────────────────────────────────────────────────

function Kpi({ label, value, Icon: Ic, tone, highlight }: {
  label: string; value: string; Icon: React.ElementType; tone?: string; highlight?: boolean
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tone === 'primary' ? 'bg-primary/10 text-primary' : highlight ? 'bg-[color:var(--success)]/10 text-[color:var(--success)]' : 'bg-surface-2 text-text-muted'}`}><Ic size={14} /></div>
      </div>
      <div className={`text-[24px] font-semibold tracking-tight leading-none ${highlight ? 'text-[color:var(--success)]' : 'text-text'}`}>{value}</div>
    </div>
  )
}

// ─── GatewayLogo ─────────────────────────────────────────────────────────────

function GatewayLogo({ g, size = 44 }: { g: Pick<GatewayItem, 'initial' | 'color'>; size?: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold tracking-tight shrink-0"
      style={{ width: size, height: size, background: g.color, fontSize: size * 0.42 }}>
      {g.initial}
    </div>
  )
}

// ─── SplitExplanation ─────────────────────────────────────────────────────────

function SplitExplanation({ g, account, sample = 100 }: { g: GatewayItem; account?: string; sample?: number }) {
  const gwFee = g.fee.pix ?? g.fee.card ?? 2.99
  const gFee  = (sample * gwFee)          / 100
  const pFee  = (sample * UMBRA_FEE_PCT)  / 100
  const net   = sample - gFee - pFee
  const gPct  = (gFee / sample) * 100
  const pPct  = (pFee / sample) * 100
  const nPct  = (net  / sample) * 100

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-fg flex items-center justify-center shrink-0"><Scissors size={14} /></div>
          <div className="text-[12.5px] text-text leading-relaxed">
            <strong>Split automático.</strong> Em cada venda, o gateway retém sua taxa e a comissão do Umbra Bot, e <strong>transfere o restante</strong> para sua conta — sem cobrança separada.
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[13px] font-semibold text-text mb-3">Exemplo: venda de {fmtBRL(sample)} via {g.name}</div>
        <div className="flex h-8 rounded-md overflow-hidden border border-border text-[11px] font-semibold text-white">
          <div className="flex items-center justify-center" style={{ width: `${gPct}%`, background: g.color, minWidth: 56 }}>{fmtPct(gPct, 1)}</div>
          <div className="flex items-center justify-center bg-primary" style={{ width: `${pPct}%`, minWidth: 52 }}>{fmtPct(pPct, 1)}</div>
          <div className="flex items-center justify-center bg-[color:var(--success)]" style={{ width: `${nPct}%` }}>{fmtPct(nPct, 1)}</div>
        </div>
        <div className="mt-4 space-y-2 text-[12px]">
          {([
            [g.color,           `Taxa ${g.name}`,          gFee, `${fmtPct(gwFee, 2)} sobre o valor`,    false],
            ['var(--primary)',   'Comissão Umbra Bot',      pFee, `${fmtPct(UMBRA_FEE_PCT, 0)} sobre o valor`, false],
            ['var(--success)',   account ? `Sua conta · ${account}` : 'Sua conta', net, 'líquido recebido', true],
          ] as const).map(([color, label, val, sub, em]) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color as string }} />
              <div className="flex-1 min-w-0">
                <div className={`text-text truncate ${em ? 'font-semibold' : 'font-medium'}`}>{label}</div>
                <div className="text-[10.5px] text-text-muted">{sub}</div>
              </div>
              <div className={`text-right shrink-0 ${em ? 'text-[color:var(--success)] font-semibold' : 'text-text font-medium'}`}>{fmtBRL(val as number)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-surface-2/40 border border-border rounded-lg p-3 text-[11.5px] text-text-muted">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>As porcentagens variam conforme o método de pagamento (Pix, cartão, boleto). O split é calculado em cada transação.</span>
      </div>
    </div>
  )
}

// ─── AccountPicker ────────────────────────────────────────────────────────────

function AccountPicker({ value, onChange, bankAccounts }: {
  value: string; onChange: (v: string) => void; bankAccounts: RawBankAccount[]
}) {
  if (bankAccounts.length === 0) {
    return (
      <div className="flex items-start gap-2 bg-[color:var(--warning)]/5 border border-[color:var(--warning)]/20 rounded-lg p-3 text-[12px] text-[color:var(--warning)]">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <span>Nenhuma conta bancária cadastrada. Adicione uma em <strong>Financeiro → Modal de Saque → Adicionar conta</strong> antes de conectar.</span>
      </div>
    )
  }

  const kindLabel: Record<string, string> = { pix: 'PIX', conta: 'Conta Corrente', ted: 'TED' }

  return (
    <div className="space-y-1.5">
      {bankAccounts.map(a => {
        const active = value === a.id
        return (
          <button key={a.id} onClick={() => onChange(a.id)}
            className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors flex items-center gap-2.5 ${active ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-2'}`}>
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-primary' : 'border-border'}`}>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </span>
            <Landmark size={13} className="text-text-muted shrink-0" />
            <span className="text-[12.5px] text-text flex-1 truncate">{a.label}</span>
            <span className="text-[10.5px] text-text-muted shrink-0">{kindLabel[a.kind] ?? a.kind}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── ConnectModal ─────────────────────────────────────────────────────────────

function ConnectModal({ open, onClose, g, bankAccounts, onConnected }: {
  open: boolean; onClose: () => void; g: GatewayItem; bankAccounts: RawBankAccount[]
  onConnected: (provider: string, bankAccountId: string, apiKey: string) => Promise<boolean>
}) {
  const [step,       setStep]       = useState<'credentials' | 'split' | 'done'>('credentials')
  const [apiKey,     setApiKey]     = useState('')
  const [showKey,    setShowKey]    = useState(false)
  const [accountId,  setAccountId]  = useState(bankAccounts[0]?.id ?? '')
  const [validating, setValidating] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (open) {
      setStep('credentials'); setApiKey(''); setShowKey(false)
      setAccountId(bankAccounts[0]?.id ?? ''); setValidating(false)
      setConnecting(false); setError('')
    }
  }, [open, bankAccounts])

  const schema = CREDENTIAL_SCHEMA[g.provider] ?? { label: 'API Key', placeholder: '', hint: '' }
  const selectedAccount = bankAccounts.find(a => a.id === accountId)

  async function handleValidate() {
    setError('')
    if (!apiKey.trim()) { setError('Chave de API obrigatória.'); return }
    if (!accountId)     { setError('Selecione uma conta de recebimento.'); return }
    setValidating(true)
    const result = await validateGatewayCredentialsAction(g.provider, apiKey.trim())
    setValidating(false)
    if (!result.ok) { setError(result.error ?? 'Credenciais inválidas.'); return }
    setStep('split')
  }

  async function handleConfirm() {
    setConnecting(true)
    const ok = await onConnected(g.provider, accountId, apiKey.trim())
    setConnecting(false)
    if (ok) setStep('done')
  }

  const footer = step === 'credentials' ? (
    <>
      <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
      <Btn variant="primary" disabled={validating || !apiKey || !accountId || bankAccounts.length === 0} onClick={handleValidate}>
        {validating ? <><Loader2 size={13} className="animate-spin" />Validando…</> : 'Validar credenciais'}
      </Btn>
    </>
  ) : step === 'split' ? (
    <>
      <Btn variant="secondary" onClick={() => setStep('credentials')}><ChevronRight size={13} className="rotate-180" />Voltar</Btn>
      <Btn variant="primary" disabled={connecting} onClick={handleConfirm}>
        {connecting ? <><Loader2 size={13} className="animate-spin" />Conectando…</> : <><Check size={13} />Confirmar e conectar</>}
      </Btn>
    </>
  ) : (
    <Btn variant="primary" onClick={onClose} className="ml-auto">Concluir</Btn>
  )

  return (
    <Modal open={open} onClose={onClose}
      title={step === 'done' ? undefined : `Conectar ${g.name}`}
      subtitle={step === 'credentials' ? 'Cole as credenciais da API do gateway.' : step === 'split' ? 'Confirme como o valor será dividido.' : undefined}
      size="md" footer={footer}>
      {step === 'credentials' && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-3 p-3 bg-surface-2/40 border border-border rounded-lg">
            <GatewayLogo g={g} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-text">{g.name}</div>
              <div className="text-[11px] text-text-muted">{g.feeText}</div>
            </div>
            <a href={`https://${g.provider === 'mercadopago' ? 'mercadopago.com.br' : g.provider === 'pagarme' ? 'pagar.me' : g.provider === 'stripe' ? 'stripe.com' : g.provider === 'pagseguro' ? 'pagseguro.uol.com.br' : g.provider === 'pushinpay' ? 'pushinpay.com.br' : 'asaas.com'}`} target="_blank" rel="noopener noreferrer"
              className="text-[11.5px] text-primary inline-flex items-center gap-1 shrink-0 hover:underline">
              <ExternalLink size={11} />Painel {g.name}
            </a>
          </div>

          <Field label={schema.label} hint={schema.hint}>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setError('') }}
                placeholder={schema.placeholder}
                autoFocus
                className={inputCls + ' font-mono pr-10'}
              />
              <button onClick={() => setShowKey(s => !s)} type="button" tabIndex={-1}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          <Field label="Conta de recebimento" hint="Para onde o gateway transferirá o valor líquido das vendas.">
            <AccountPicker value={accountId} onChange={setAccountId} bankAccounts={bankAccounts} />
          </Field>

          {error && (
            <div className="flex items-start gap-2 bg-[color:var(--danger)]/5 border border-[color:var(--danger)]/30 rounded-lg p-3 text-[12px] text-[color:var(--danger)]">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
            </div>
          )}
        </div>
      )}

      {step === 'split' && (
        <SplitExplanation g={g} account={selectedAccount?.label} />
      )}

      {step === 'done' && (
        <div className="text-center py-6">
          <div className="relative w-14 h-14 mx-auto rounded-full bg-[color:var(--success)]/10 text-[color:var(--success)] flex items-center justify-center mb-4">
            <Check size={26} />
            <span className="absolute inset-0 rounded-full border border-[color:var(--success)]/40 animate-ping opacity-50" />
          </div>
          <h3 className="text-[16px] font-semibold text-text">{g.name} conectado</h3>
          <p className="text-[12.5px] text-text-muted mt-1.5 max-w-xs mx-auto">
            Pagamentos em <strong className="text-text">{g.methods.join(', ')}</strong> já podem ser processados com split automático.
          </p>
        </div>
      )}
    </Modal>
  )
}

// ─── TestModal ────────────────────────────────────────────────────────────────

function TestModal({ open, onClose, g }: { open: boolean; onClose: () => void; g: GatewayItem }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [info,   setInfo]   = useState('')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!open || !g.id) return
    setStatus('loading'); setInfo(''); setErrMsg('')
    testGatewayConnectionAction(g.id).then(r => {
      if (r.ok) { setStatus('ok'); setInfo(r.accountInfo ?? 'Conectado') }
      else       { setStatus('error'); setErrMsg(r.error ?? 'Erro ao verificar.') }
    })
  }, [open, g.id])

  const gwFee = g.fee.pix ?? g.fee.card ?? 2.99

  return (
    <Modal open={open} onClose={onClose}
      title="Verificar conexão"
      subtitle={`Valida se as credenciais do ${g.name} estão ativas.`}
      size="md"
      footer={<Btn variant="primary" onClick={onClose} className="ml-auto">Fechar</Btn>}>
      <div className="space-y-4">
        {/* Gateway info */}
        <div className="flex items-center gap-3 p-3 bg-surface-2/40 border border-border rounded-lg">
          <GatewayLogo g={g} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-text">{g.name}</div>
            <div className="text-[11px] text-text-muted">{g.account ?? 'Sem conta configurada'}</div>
          </div>
          <Badge tone="success"><span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />Conectado</Badge>
        </div>

        {/* Status */}
        {status === 'loading' && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
            <Loader2 size={18} className="animate-spin text-primary shrink-0" />
            <span className="text-[12.5px] text-text">Verificando conexão com {g.name}…</span>
          </div>
        )}

        {status === 'ok' && (
          <div className="flex items-start gap-3 bg-[color:var(--success)]/5 border border-[color:var(--success)]/20 rounded-lg p-4">
            <CheckCircle2 size={18} className="text-[color:var(--success)] shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-text">Conexão ativa</div>
              <div className="text-[12px] text-text-muted mt-0.5">{info}</div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 bg-[color:var(--danger)]/5 border border-[color:var(--danger)]/20 rounded-lg p-4">
            <XCircle size={18} className="text-[color:var(--danger)] shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-text">Falha na verificação</div>
              <div className="text-[12px] text-text-muted mt-0.5">{errMsg}</div>
              <div className="text-[11px] text-text-muted mt-2">Reconecte o gateway para atualizar as credenciais.</div>
            </div>
          </div>
        )}

        {/* Split example (shown when connected) */}
        {status === 'ok' && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-muted mb-3">Split em uma venda de R$ 100,00</div>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex justify-between"><span className="text-text-muted">Taxa {g.name} ({fmtPct(gwFee, 2)})</span><span className="text-text font-medium">−{fmtBRL((100 * gwFee) / 100)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Comissão Umbra Bot ({fmtPct(UMBRA_FEE_PCT, 0)})</span><span className="text-text font-medium">−{fmtBRL(UMBRA_FEE_PCT)}</span></div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between"><span className="font-semibold text-text">Você recebe</span><span className="text-[color:var(--success)] font-semibold">{fmtBRL(100 - (100 * gwFee) / 100 - UMBRA_FEE_PCT)}</span></div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-[11.5px] text-text-muted bg-surface-2/40 border border-border rounded-lg p-3">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>A verificação chama a API do {g.name} usando as credenciais salvas no banco — sem expor o token ao navegador.</span>
        </div>
      </div>
    </Modal>
  )
}

// ─── DisconnectModal ──────────────────────────────────────────────────────────

function DisconnectModal({ open, onClose, g, onConfirm }: {
  open: boolean; onClose: () => void; g: GatewayItem; onConfirm: (g: GatewayItem) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    await onConfirm(g)
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Desconectar ${g.name}?`} size="sm"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="danger" disabled={loading} onClick={confirm}>
            {loading ? <><Loader2 size={13} className="animate-spin" />Desconectando…</> : <><Unplug size={13} />Sim, desconectar</>}
          </Btn>
        </>
      }>
      <div className="text-[12.5px] text-text-muted leading-relaxed">
        Após a desconexão, novas vendas <strong>não</strong> serão processadas por este gateway. O histórico financeiro é preservado.
      </div>
      {(g.volume30d > 0 || g.tx30d > 0) && (
        <div className="mt-3 bg-surface-2/40 border border-border rounded-lg p-3 text-[12px]">
          <div className="text-text-muted">Volume (30d): <span className="text-text font-semibold">{fmtBRL(g.volume30d)}</span></div>
          <div className="text-text-muted mt-0.5">Transações: <span className="text-text font-semibold">{fmtNum(g.tx30d)}</span></div>
        </div>
      )}
    </Modal>
  )
}

// ─── ConfigureModal ───────────────────────────────────────────────────────────

function ConfigureModal({ open, onClose, g, bankAccounts, onUpdate }: {
  open: boolean; onClose: () => void; g: GatewayItem; bankAccounts: RawBankAccount[]
  onUpdate: (g: GatewayItem, bankAccountId: string) => Promise<void>
}) {
  const [accountId, setAccountId] = useState(g.accountId ?? bankAccounts[0]?.id ?? '')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (open) setAccountId(g.accountId ?? bankAccounts[0]?.id ?? '')
  }, [open, g.accountId, bankAccounts])

  async function save() {
    if (!accountId) return
    setSaving(true)
    await onUpdate(g, accountId)
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Configurar ${g.name}`} subtitle="Atualizar conta de recebimento." size="md"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={saving || !accountId} onClick={save}>
            {saving ? <><Loader2 size={13} className="animate-spin" />Salvando…</> : <><Check size={13} />Salvar</>}
          </Btn>
        </>
      }>
      <Field label="Conta de recebimento" hint="Conta para onde o gateway depositará os valores líquidos.">
        <AccountPicker value={accountId} onChange={setAccountId} bankAccounts={bankAccounts} />
      </Field>
    </Modal>
  )
}

// ─── GatewayCard ──────────────────────────────────────────────────────────────

function GatewayCard({ g, now, onConnect, onConfigure, onTest, onDisconnect }: {
  g: GatewayItem; now: number
  onConnect?:    () => void
  onConfigure?:  () => void
  onTest?:       () => void
  onDisconnect?: () => void
}) {
  function MethodIcon({ m }: { m: string }) {
    if (m === 'Pix')    return <Zap size={10} />
    if (m === 'Cartão') return <CreditCard size={10} />
    return <FileText size={10} />
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <GatewayLogo g={g} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14.5px] font-semibold text-text">{g.name}</h3>
            {g.connected
              ? <Badge tone="success"><span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />Conectado</Badge>
              : <Badge tone="muted">Não conectado</Badge>}
          </div>
          <p className="text-[12px] text-text-muted mt-1 leading-relaxed">{g.description}</p>
        </div>
      </div>

      {/* Methods + fee */}
      <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
        {g.methods.map(m => (
          <span key={m} className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-surface-2 border border-border text-[10.5px] font-medium text-text-muted">
            <MethodIcon m={m} />{m}
          </span>
        ))}
        <span className="text-[10.5px] text-text-muted ml-auto">{g.feeText}</span>
      </div>

      {/* Connected details */}
      {g.connected && (
        <div className="mt-4 pt-4 border-t border-border space-y-2 text-[11.5px]">
          <div className="flex items-center gap-2">
            <Landmark size={11} className="text-text-muted shrink-0" />
            <span className="text-text-muted shrink-0">Conta:</span>
            <span className="text-text truncate">{g.account ?? '—'}</span>
          </div>
          {g.lastSync && (
            <div className="flex items-center gap-2">
              <RefreshCw size={11} className="text-text-muted shrink-0" />
              <span className="text-text-muted shrink-0">Sync:</span>
              <span className="text-text">{relTime(g.lastSync, now)}</span>
            </div>
          )}
          {(g.volume30d > 0 || g.tx30d > 0) && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Volume (30d)</div>
                <div className="text-[13px] font-semibold text-[color:var(--success)] mt-0.5">{fmtBRL(g.volume30d)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Transações</div>
                <div className="text-[13px] font-semibold text-text mt-0.5">{fmtNum(g.tx30d)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
        {g.connected ? (
          <>
            <Btn variant="primary" size="sm" onClick={onTest}><Zap size={13} />Verificar</Btn>
            <Btn variant="secondary" size="sm" onClick={onConfigure}><Settings size={13} />Configurar</Btn>
            <button onClick={onDisconnect} title="Desconectar"
              className="ml-auto w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-[color:var(--danger)]/10 hover:text-[color:var(--danger)]">
              <Unplug size={14} />
            </button>
          </>
        ) : (
          <Btn variant="primary" size="sm" onClick={onConnect} className="w-full"><Plug size={13} />Conectar {g.name}</Btn>
        )}
      </div>
    </div>
  )
}

// ─── GatewaysClient ──────────────────────────────────────────────────────────

interface GatewaysClientProps {
  initialGateways: RawGateway[]
  bankAccounts:    RawBankAccount[]
  gatewayStats:    GatewayStats
  userId:          string
}

export function GatewaysClient({ initialGateways, bankAccounts, gatewayStats }: GatewaysClientProps) {
  const { track } = useAnalytics()

  const [gateways,      setGateways]      = useState<GatewayItem[]>(() => mergeGateways(initialGateways, gatewayStats))
  const [now,           setNow]           = useState(Date.now())
  const [connecting,    setConnecting]    = useState<GatewayItem | null>(null)
  const [testing,       setTesting]       = useState<GatewayItem | null>(null)
  const [disconnecting, setDisconnecting] = useState<GatewayItem | null>(null)
  const [configuring,   setConfiguring]   = useState<GatewayItem | null>(null)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Tick para relTime (a cada 60s)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Auto-fecha toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(msg: string, type: 'success' | 'error' = 'success') { setToast({ msg, type }) }

  function patchGateway(provider: string, patch: Partial<GatewayItem>) {
    setGateways(prev => prev.map(g => g.provider === provider ? { ...g, ...patch } : g))
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleConnected(provider: string, bankAccountId: string, apiKey: string): Promise<boolean> {
    const account = bankAccounts.find(a => a.id === bankAccountId)
    const result  = await connectGatewayAction(provider, apiKey, bankAccountId)
    if (!result.ok) { showToast(result.error ?? 'Erro ao conectar.', 'error'); return false }
    patchGateway(provider, {
      id:        result.gatewayId ?? null,
      connected: true,
      account:   account?.label,
      accountId: bankAccountId,
      lastSync:  Date.now(),
    })
    showToast(`${GATEWAY_CATALOG[provider]?.name ?? provider} conectado com sucesso.`)
    track('gateway_connected', { gateway: provider })
    return true
  }

  async function handleDisconnect(g: GatewayItem) {
    if (!g.id) return
    const result = await disconnectGatewayAction(g.id)
    if (!result.ok) { showToast(result.error ?? 'Erro ao desconectar.', 'error'); return }
    patchGateway(g.provider, { connected: false, account: undefined, accountId: undefined, lastSync: Date.now() })
    showToast(`${g.name} desconectado.`)
    track('gateway_disconnected', { gateway: g.provider })
  }

  async function handleUpdate(g: GatewayItem, bankAccountId: string) {
    if (!g.id) return
    const result  = await updateGatewayAction(g.id, bankAccountId)
    if (!result.ok) { showToast(result.error ?? 'Erro ao salvar.', 'error'); return }
    const account = bankAccounts.find(a => a.id === bankAccountId)
    patchGateway(g.provider, { account: account?.label, accountId: bankAccountId })
    showToast('Configuração salva.')
    track('gateway_configured', { gateway: g.provider })
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const connected   = gateways.filter(g => g.connected)
  const available   = gateways.filter(g => !g.connected)
  const totalVolume = connected.reduce((s, g) => s + g.volume30d, 0)
  const totalTx     = connected.reduce((s, g) => s + g.tx30d,     0)
  const avgFee      = useMemo(() => {
    const list = connected.map(g => g.fee.pix ?? g.fee.card ?? 2.99)
    return list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0
  }, [connected])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Gateways"
        subtitle="Conecte seus adquirentes para processar pagamentos com split automático para sua conta."
      />

      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2.5 border rounded-lg px-3.5 py-2 ${toast.type === 'error' ? 'bg-[color:var(--danger)]/5 border-[color:var(--danger)]/30' : 'bg-[color:var(--success)]/5 border-[color:var(--success)]/30'}`}>
          {toast.type === 'error'
            ? <AlertCircle size={15} className="text-[color:var(--danger)]" />
            : <Check size={15} className="text-[color:var(--success)]" />}
          <div className={`text-[12.5px] flex-1 ${toast.type === 'error' ? 'text-[color:var(--danger)]' : 'text-[color:var(--success)]'}`}>{toast.msg}</div>
        </div>
      )}

      {/* Aviso: sem contas bancárias */}
      {bankAccounts.length === 0 && (
        <div className="mb-4 flex items-start gap-2.5 bg-[color:var(--warning)]/5 border border-[color:var(--warning)]/20 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-[color:var(--warning)] mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-text-muted">
            <strong className="text-text">Nenhuma conta bancária cadastrada.</strong> Adicione uma em{' '}
            <strong>Financeiro → Modal de Saque → Adicionar conta</strong> antes de conectar um gateway.
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi label="Gateways conectados"     value={`${connected.length} / ${gateways.length}`} Icon={Plug}           tone="primary" />
        <Kpi label="Volume processado (30d)" value={fmtBRL(totalVolume)}                         Icon={TrendingUp}     highlight={totalVolume > 0} />
        <Kpi label="Transações (30d)"        value={fmtNum(totalTx)}                             Icon={ArrowLeftRight} />
        <Kpi label="Taxa média ponderada"    value={connected.length ? fmtPct(avgFee, 2) : '—'} Icon={Percent} />
      </div>

      {/* Split banner */}
      <div className="mb-5 flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <div className="w-8 h-8 rounded-md bg-primary text-primary-fg flex items-center justify-center shrink-0"><Scissors size={15} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text">Split automático em todas as vendas</div>
          <div className="text-[11.5px] text-text-muted mt-0.5">
            Em cada venda, <strong className="text-text">{fmtPct(UMBRA_FEE_PCT, 0)} ficam com o Umbra Bot</strong> e o <strong className="text-text">restante é depositado na sua conta</strong> — sem boleto separado.
          </div>
        </div>
      </div>

      {/* Conectados */}
      {connected.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Conectados</h2>
            <span className="text-[10.5px] text-text-muted">{connected.length} {connected.length === 1 ? 'gateway' : 'gateways'}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {connected.map(g => (
              <GatewayCard
                key={g.provider}
                g={g}
                now={now}
                onConfigure={() => setConfiguring(g)}
                onTest={() => setTesting(g)}
                onDisconnect={() => setDisconnecting(g)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Disponíveis */}
      {available.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Disponíveis</h2>
            <span className="text-[10.5px] text-text-muted">{available.length} {available.length === 1 ? 'gateway' : 'gateways'}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {available.map(g => (
              <GatewayCard
                key={g.provider}
                g={g}
                now={now}
                onConnect={() => {
                  if (bankAccounts.length === 0) {
                    showToast('Adicione uma conta bancária antes de conectar um gateway.', 'error')
                    return
                  }
                  setConnecting(g)
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      {connecting && (
        <ConnectModal
          open
          onClose={() => setConnecting(null)}
          g={connecting}
          bankAccounts={bankAccounts}
          onConnected={handleConnected}
        />
      )}
      {testing && (
        <TestModal
          open
          onClose={() => setTesting(null)}
          g={testing}
        />
      )}
      {disconnecting && (
        <DisconnectModal
          open
          onClose={() => setDisconnecting(null)}
          g={disconnecting}
          onConfirm={handleDisconnect}
        />
      )}
      {configuring && (
        <ConfigureModal
          open
          onClose={() => setConfiguring(null)}
          g={configuring}
          bankAccounts={bankAccounts}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
