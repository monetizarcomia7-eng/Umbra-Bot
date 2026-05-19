'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Plug, TrendingUp, ArrowLeftRight, Percent, Landmark, RefreshCw,
  Zap, CreditCard, FileText, Settings, Unplug, Check, X, Eye, EyeOff,
  Info, ExternalLink, AlertCircle, ChevronRight, Loader2, Scissors,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface GatewayFee { pix?: number; card?: number; boleto?: number }
interface Gateway {
  id: string; name: string; description: string; initial: string; color: string
  methods: string[]; fee: GatewayFee; feeText: string; connected: boolean
  account?: string; accountInfo?: string; lastSync?: number
  processedVolume?: number; processedTx?: number; apiKey?: string
}
interface Account { id: string; label: string; bank: string }

// ─── Static data ──────────────────────────────────────────────────────────────
const NOW_G = new Date('2026-05-18T15:30:00').getTime()
const UMBRA_FEE_PCT = 3

const ACCOUNTS: Account[] = [
  { id: 'bb',     label: 'Conta BB · Ag 1234 · final 8842', bank: 'Banco do Brasil' },
  { id: 'nubank', label: 'Conta Nubank · final 0297',        bank: 'Nubank PJ' },
  { id: 'inter',  label: 'Conta Inter · final 4421',         bank: 'Banco Inter' },
]

const MOCK: Gateway[] = [
  { id: 'pushinpay',   name: 'Pushinpay',   description: 'Gateway brasileiro focado em Pix instantâneo, antecipação grátis e split nativo.', initial: 'P', color: 'oklch(0.65 0.18 145)', methods: ['Pix'], fee: { pix: 1.69 }, feeText: 'A partir de 1,69%', connected: true,  account: 'Conta BB · Ag 1234 · final 8842', accountInfo: 'Banco do Brasil', lastSync: NOW_G - 5 * 60000, processedVolume: 184320, processedTx: 1284, apiKey: 'pp_live_abc123*****' },
  { id: 'mercadopago', name: 'Mercado Pago', description: 'Gateway tradicional com Pix, cartão (até 12x) e boleto. Antifraude integrado.',   initial: 'M', color: 'oklch(0.62 0.16 240)', methods: ['Pix', 'Cartão', 'Boleto'], fee: { pix: 0.99, card: 4.99, boleto: 3.49 }, feeText: 'A partir de 0,99%', connected: true,  account: 'Conta Nubank · final 0297', accountInfo: 'Nubank PJ', lastSync: NOW_G - 12 * 60000, processedVolume: 42180, processedTx: 287, apiKey: 'TEST-2641************' },
  { id: 'pagarme',     name: 'Pagar.me',    description: 'Gateway da Stone com split nativo e antifraude pro. Ótimo para marketplaces.',     initial: 'P', color: 'oklch(0.55 0.20 285)', methods: ['Pix', 'Cartão', 'Boleto'], fee: { pix: 0.99, card: 3.29, boleto: 3.49 }, feeText: 'A partir de 0,99%', connected: false },
  { id: 'stripe',      name: 'Stripe',      description: 'Gateway internacional. Suporta múltiplas moedas, clientes globais e assinaturas.',  initial: 'S', color: 'oklch(0.62 0.16 290)', methods: ['Cartão'], fee: { card: 4.5 }, feeText: '4,5% + R$ 0,40', connected: true,  account: 'Conta BB · Ag 1234 · final 8842', accountInfo: 'Banco do Brasil', lastSync: NOW_G - 2 * 3600000, processedVolume: 24300, processedTx: 36, apiKey: 'sk_live_9k8j7h*****' },
  { id: 'pagseguro',   name: 'PagSeguro',   description: 'Gateway da UOL com cobertura nacional, antifraude e parcelamento sem juros.',       initial: 'P', color: 'oklch(0.68 0.17 50)',  methods: ['Pix', 'Cartão', 'Boleto'], fee: { pix: 0.99, card: 2.69 }, feeText: 'A partir de 0,99%', connected: false },
  { id: 'asaas',       name: 'Asaas',       description: 'Gateway financeiro com Pix, boleto recorrente e split nativo para SaaS e infoprodutos.', initial: 'A', color: 'oklch(0.62 0.20 325)', methods: ['Pix', 'Cartão', 'Boleto'], fee: { pix: 1.99 }, feeText: 'A partir de 1,99%', connected: false },
]

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtNum  = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtBRL  = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
const fmtPct  = (n: number, d = 2) => n.toFixed(d).replace('.', ',') + '%'

function relTime(dt: number): string {
  const diff = NOW_G - dt
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

// ─── Local UI ─────────────────────────────────────────────────────────────────
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
  const t: Record<string, string> = { success: 'bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20', warning: 'bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/20', danger: 'bg-[color:var(--danger)]/10 text-[color:var(--danger)] border-[color:var(--danger)]/20', primary: 'bg-primary/10 text-primary border-primary/20', muted: 'bg-surface-2 text-text-muted border-border' }
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

// ─── FakeQR ───────────────────────────────────────────────────────────────────
function FakeQR({ data, size = 200 }: { data: string; size?: number }) {
  const grid = 25; const cell = size / grid
  const cells = useMemo(() => {
    let seed = data.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + data.length * 31
    const out: Array<{ x: number; y: number }> = []
    for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
      seed = (seed * 9301 + 49297) % 233280
      const inM = (x < 7 && y < 7) || (x >= grid - 7 && y < 7) || (x < 7 && y >= grid - 7)
      if (!inM && seed / 233280 > 0.52) out.push({ x, y })
    }
    return out
  }, [data])
  function Marker({ x, y }: { x: number; y: number }) {
    return <g><rect x={x*cell} y={y*cell} width={7*cell} height={7*cell} fill="currentColor"/><rect x={(x+1)*cell} y={(y+1)*cell} width={5*cell} height={5*cell} fill="var(--surface)"/><rect x={(x+2)*cell} y={(y+2)*cell} width={3*cell} height={3*cell} fill="currentColor"/></g>
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="block text-text" style={{ background: 'var(--surface)' }}>
      {cells.map((c, i) => <rect key={i} x={c.x*cell} y={c.y*cell} width={cell} height={cell} fill="currentColor"/>)}
      <Marker x={0} y={0}/><Marker x={grid-7} y={0}/><Marker x={0} y={grid-7}/>
    </svg>
  )
}

// ─── GatewayLogo ─────────────────────────────────────────────────────────────
function GatewayLogo({ g, size = 44 }: { g: Gateway; size?: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold tracking-tight shrink-0"
      style={{ width: size, height: size, background: g.color, fontSize: size * 0.42 }}>
      {g.initial}
    </div>
  )
}

// ─── KPI ─────────────────────────────────────────────────────────────────────
function Kpi({ label, value, Icon: Ic, tone, highlight }: { label: string; value: string; Icon: React.ElementType; tone?: string; highlight?: boolean }) {
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

// ─── SplitExplanation ────────────────────────────────────────────────────────
function SplitExplanation({ g, account, sample = 100 }: { g: Gateway; account?: string; sample?: number }) {
  const gwFee  = g.fee?.pix ?? g.fee?.card ?? 2.99
  const gFee   = (sample * gwFee) / 100
  const pFee   = (sample * UMBRA_FEE_PCT) / 100
  const net    = sample - gFee - pFee
  const gPct   = (gFee / sample) * 100
  const pPct   = (pFee / sample) * 100
  const nPct   = (net / sample) * 100
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
          <div className="flex items-center justify-center" style={{ width: `${gPct}%`, background: g.color, minWidth: 60 }}>{fmtPct(gPct, 1)}</div>
          <div className="flex items-center justify-center bg-primary" style={{ width: `${pPct}%`, minWidth: 56 }}>{fmtPct(pPct, 1)}</div>
          <div className="flex items-center justify-center bg-[color:var(--success)]" style={{ width: `${nPct}%` }}>{fmtPct(nPct, 1)}</div>
        </div>
        <div className="mt-4 space-y-2 text-[12px]">
          {([
            [g.color, `Taxa ${g.name}`, gwFee, gFee, `${fmtPct(gwFee, 2)} sobre o valor`, false],
            ['var(--primary)', 'Comissão Umbra Bot', UMBRA_FEE_PCT, pFee, `${fmtPct(UMBRA_FEE_PCT, 1)} sobre o valor`, false],
            ['var(--success)', `Sua conta · ${account ?? 'a definir'}`, 0, net, 'líquido recebido', true],
          ] as const).map(([color, label, , val, sub, em]) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className={`text-text truncate ${em ? 'font-semibold' : 'font-medium'}`}>{label}</div>
                <div className="text-[10.5px] text-text-muted">{sub}</div>
              </div>
              <div className={`text-right shrink-0 ${em ? 'text-[color:var(--success)] font-semibold' : 'text-text font-medium'}`}>{fmtBRL(val)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-surface-2/40 border border-border rounded-lg p-3 text-[11.5px] text-text-muted">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>As porcentagens podem variar conforme o método (Pix, cartão, boleto) — o split é calculado em cada transação.</span>
      </div>
    </div>
  )
}

// ─── CompactSplit ─────────────────────────────────────────────────────────────
function CompactSplit({ g, amount }: { g: Gateway; amount: number }) {
  const gwFee = g.fee?.pix ?? g.fee?.card ?? 2.99
  const gFee  = (amount * gwFee) / 100
  const pFee  = (amount * UMBRA_FEE_PCT) / 100
  const net   = amount - gFee - pFee
  return (
    <div className="space-y-1 text-[11.5px]">
      <div className="flex justify-between"><span className="text-text-muted">Bruto</span><span className="text-text font-medium">{fmtBRL(amount)}</span></div>
      <div className="flex justify-between"><span className="text-text-muted">Taxa {g.name}</span><span className="text-text-muted">−{fmtBRL(gFee)}</span></div>
      <div className="flex justify-between"><span className="text-text-muted">Comissão Umbra Bot ({fmtPct(UMBRA_FEE_PCT, 1)})</span><span className="text-text-muted">−{fmtBRL(pFee)}</span></div>
      <div className="h-px bg-border my-1" />
      <div className="flex justify-between"><span className="text-text font-semibold">Líquido</span><span className="text-[color:var(--success)] font-semibold">{fmtBRL(net)}</span></div>
    </div>
  )
}

// ─── AccountPicker ────────────────────────────────────────────────────────────
function AccountPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      {ACCOUNTS.map(a => {
        const active = value === a.id
        return (
          <button key={a.id} onClick={() => onChange(a.id)}
            className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors flex items-center gap-2.5 ${active ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-2'}`}>
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-primary' : 'border-border'}`}>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </span>
            <Landmark size={13} className="text-text-muted shrink-0" />
            <span className="text-[12.5px] text-text flex-1 truncate">{a.label}</span>
            <span className="text-[10.5px] text-text-muted shrink-0">{a.bank}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── ConnectModal ─────────────────────────────────────────────────────────────
function ConnectModal({ open, onClose, g, onConnected }: { open: boolean; onClose: () => void; g: Gateway | null; onConnected: (gw: Gateway) => void }) {
  const [step,       setStep]       = useState<'credentials' | 'split' | 'done'>('credentials')
  const [apiKey,     setApiKey]     = useState('')
  const [secretKey,  setSecretKey]  = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [accountId,  setAccountId]  = useState(ACCOUNTS[0].id)
  const [testing,    setTesting]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => { if (open) { setStep('credentials'); setApiKey(''); setSecretKey(''); setShowSecret(false); setAccountId(ACCOUNTS[0].id); setTesting(false); setError('') } }, [open])

  if (!g) return null

  function testAndContinue() {
    setError('')
    if (apiKey.length < 8) { setError('Chave de API inválida.'); return }
    if (secretKey.length < 8) { setError('Chave secreta inválida.'); return }
    setTesting(true)
    setTimeout(() => { setTesting(false); setStep('split') }, 1100)
  }

  function confirmConnect() {
    const acc = ACCOUNTS.find(a => a.id === accountId) ?? ACCOUNTS[0]
    onConnected({ ...g!, connected: true, account: acc.label, accountInfo: acc.bank, lastSync: Date.now(), processedVolume: 0, processedTx: 0, apiKey: apiKey.slice(0, 8) + '*****' })
    setStep('done')
  }

  const footer = step === 'credentials' ? (
    <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
      <Btn variant="primary" disabled={testing || !apiKey || !secretKey} onClick={testAndContinue}>{testing ? <><Loader2 size={13} className="animate-spin" />Validando…</> : 'Continuar'}</Btn></>
  ) : step === 'split' ? (
    <><Btn variant="secondary" onClick={() => setStep('credentials')}><ChevronRight size={13} className="rotate-180" />Voltar</Btn>
      <Btn variant="primary" onClick={confirmConnect}><Check size={13} />Confirmar e conectar</Btn></>
  ) : (
    <Btn variant="primary" onClick={onClose} className="ml-auto">Concluir</Btn>
  )

  return (
    <Modal open={open} onClose={onClose} title={step === 'done' ? undefined : `Conectar ${g.name}`}
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
            <span className="text-[11.5px] text-primary inline-flex items-center gap-1 shrink-0"><ExternalLink size={11} />Painel {g.name}</span>
          </div>
          <Field label="API Key (chave pública)" hint="Encontrada em Configurações → Integrações → API do gateway.">
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={`${g.id}_live_xxxxxxxx`} autoFocus className={inputCls + ' font-mono'} />
          </Field>
          <Field label="Secret Key">
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="sk_xxxxxxxxxxxx" className={inputCls + ' font-mono pr-10'} />
              <button onClick={() => setShowSecret(s => !s)} type="button" tabIndex={-1} className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2">
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <Field label="Conta de recebimento" hint="Para onde o gateway transferirá o valor líquido das vendas.">
            <AccountPicker value={accountId} onChange={setAccountId} />
          </Field>
          {error && (
            <div className="flex items-start gap-2 bg-[color:var(--danger)]/5 border border-[color:var(--danger)]/30 rounded-lg p-3 text-[12px] text-[color:var(--danger)]">
              <AlertCircle size={13} className="mt-0.5" />{error}
            </div>
          )}
        </div>
      )}
      {step === 'split' && <SplitExplanation g={g} account={ACCOUNTS.find(a => a.id === accountId)?.label} />}
      {step === 'done' && (
        <div className="text-center py-6">
          <div className="relative w-14 h-14 mx-auto rounded-full bg-[color:var(--success)]/10 text-[color:var(--success)] flex items-center justify-center mb-4">
            <Check size={26} /><span className="absolute inset-0 rounded-full border border-[color:var(--success)]/40 animate-ping opacity-50" />
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

// ─── PixTestModal ─────────────────────────────────────────────────────────────
function PixTestModal({ open, onClose, g }: { open: boolean; onClose: () => void; g: Gateway | null }) {
  const [amount, setAmount]     = useState(10000)
  const [desc, setDesc]         = useState('Teste de cobrança Umbra Bot')
  const [state, setState]       = useState<'form' | 'waiting' | 'paid'>('form')
  const [seconds, setSeconds]   = useState(0)

  useEffect(() => { if (open) { setState('form'); setAmount(10000); setDesc('Teste de cobrança Umbra Bot'); setSeconds(0) } }, [open, g])

  useEffect(() => {
    if (state !== 'waiting') return
    setSeconds(0)
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    const r = setTimeout(() => setState('paid'), 25000)
    return () => { clearInterval(t); clearTimeout(r) }
  }, [state])

  const formatted = useMemo(() => (amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [amount])

  if (!g) return null
  function handleAmount(e: React.ChangeEvent<HTMLInputElement>) { const d = e.target.value.replace(/\D/g, ''); setAmount(parseInt(d || '0', 10)) }

  const footer = state === 'form' ? (
    <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
      <Btn variant="primary" disabled={amount === 0} onClick={() => setState('waiting')}><Zap size={13} />Gerar QR de teste</Btn></>
  ) : state === 'waiting' ? (
    <><Btn variant="secondary" onClick={() => setState('form')}><ChevronRight size={13} className="rotate-180" />Voltar</Btn>
      <Btn variant="ghost" onClick={() => setState('paid')}>Marcar como pago (demo)</Btn></>
  ) : (
    <Btn variant="primary" onClick={onClose} className="ml-auto">Concluir</Btn>
  )

  return (
    <Modal open={open} onClose={onClose} title="Teste de cobrança Pix" subtitle={`Gera um QR code real via ${g.name} para validar o split.`} size="md" footer={footer}>
      {state === 'form' && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-3 p-3 bg-surface-2/40 border border-border rounded-lg">
            <GatewayLogo g={g} size={36} />
            <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-text">{g.name}</div><div className="text-[11px] text-text-muted">{g.account}</div></div>
            <Badge tone="success"><span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />Conectado</Badge>
          </div>
          <Field label="Valor do teste">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-[14px] font-medium">R$</span>
              <input type="text" inputMode="numeric" value={formatted} onChange={handleAmount} autoFocus
                className="w-full h-12 pl-11 pr-3 bg-surface border border-border rounded-lg text-[20px] font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="text-[10.5px] text-text-muted mt-1">Valor mínimo de R$ 0,01 — o teste cobra realmente.</div>
          </Field>
          <Field label="Descrição">
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} className={inputCls} />
          </Field>
          <div className="bg-surface-2/40 border border-border rounded-lg p-3">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-2">Como o teste será dividido</div>
            <CompactSplit g={g} amount={amount / 100} />
          </div>
        </div>
      )}
      {state === 'waiting' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">Valor</div>
            <div className="text-[28px] font-semibold text-text leading-none mt-1">R$ {formatted}</div>
          </div>
          <div className="bg-surface-2/40 border border-border rounded-xl p-5 flex flex-col items-center">
            <FakeQR data={`umbra-test-${g.id}-${amount}-${desc}`} size={200} />
            <div className="mt-3 text-center">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">Pix copia e cola</div>
              <code className="text-[10.5px] font-mono text-text-muted block max-w-[300px] truncate mt-1 px-2 py-1 bg-surface border border-border rounded">
                00020126850014BR.GOV.BCB.PIX0124teste@umbra.bot{Math.floor(amount / 100)}
              </code>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-lg p-3">
            <span className="relative w-2 h-2 rounded-full bg-primary shrink-0"><span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" /></span>
            <div className="text-[12px] text-text flex-1"><strong>Aguardando pagamento…</strong><span className="text-text-muted ml-2">{seconds}s decorridos</span></div>
          </div>
          <div className="flex items-start gap-2 text-[11.5px] text-text-muted bg-surface-2/40 border border-border rounded-lg p-3">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>Escaneie o QR no app do seu banco. O split é aplicado quando o pagamento for confirmado pelo {g.name}.</span>
          </div>
        </div>
      )}
      {state === 'paid' && (
        <div>
          <div className="text-center py-4">
            <div className="relative w-14 h-14 mx-auto rounded-full bg-[color:var(--success)]/10 text-[color:var(--success)] flex items-center justify-center mb-4">
              <Check size={26} /><span className="absolute inset-0 rounded-full border border-[color:var(--success)]/40 animate-ping opacity-50" />
            </div>
            <h3 className="text-[16px] font-semibold text-text">Pagamento recebido</h3>
            <p className="text-[12.5px] text-text-muted mt-1">R$ {formatted} processado via {g.name}.</p>
          </div>
          <div className="bg-surface-2/40 border border-border rounded-lg p-3 mt-3">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-2">Split aplicado</div>
            <CompactSplit g={g} amount={amount / 100} />
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── DisconnectModal ──────────────────────────────────────────────────────────
function DisconnectModal({ open, onClose, g, onConfirm }: { open: boolean; onClose: () => void; g: Gateway | null; onConfirm: (gw: Gateway) => void }) {
  const [loading, setLoading] = useState(false)
  if (!g) return null
  function confirm() { setLoading(true); setTimeout(() => { setLoading(false); onConfirm(g!); onClose() }, 800) }
  return (
    <Modal open={open} onClose={onClose} title={`Desconectar ${g.name}?`} size="sm"
      footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn variant="danger" disabled={loading} onClick={confirm}>{loading ? <><Loader2 size={13} className="animate-spin" />Desconectando…</> : <><Unplug size={13} />Sim, desconectar</>}</Btn></>}>
      <div className="text-[12.5px] text-text-muted leading-relaxed">
        Após a desconexão, novas vendas <strong>não</strong> serão processadas por este gateway. Histórico financeiro preservado.
      </div>
      <div className="mt-3 bg-surface-2/40 border border-border rounded-lg p-3 text-[12px]">
        <div className="text-text-muted">Volume (30d): <span className="text-text font-semibold">{fmtBRL(g.processedVolume ?? 0)}</span></div>
        <div className="text-text-muted mt-0.5">Transações: <span className="text-text font-semibold">{fmtNum(g.processedTx ?? 0)}</span></div>
      </div>
    </Modal>
  )
}

// ─── ConfigureModal ───────────────────────────────────────────────────────────
function ConfigureModal({ open, onClose, g, onUpdate }: { open: boolean; onClose: () => void; g: Gateway | null; onUpdate: (id: string, patch: Partial<Gateway>) => void }) {
  const [accountId, setAccountId] = useState(ACCOUNTS[0].id)
  useEffect(() => {
    if (open && g) { const cur = ACCOUNTS.find(a => a.label === g.account); setAccountId(cur?.id ?? ACCOUNTS[0].id) }
  }, [open, g])
  if (!g) return null
  function save() {
    const acc = ACCOUNTS.find(a => a.id === accountId)
    if (acc) onUpdate(g!.id, { account: acc.label, accountInfo: acc.bank })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={`Configurar ${g.name}`} subtitle="Atualizar conta de recebimento." size="md"
      footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={save}><Check size={13} />Salvar</Btn></>}>
      <div className="space-y-3.5">
        <Field label="API Key">
          <input type="text" value={g.apiKey ?? ''} readOnly className={inputCls + ' font-mono bg-surface-2 opacity-70'} />
        </Field>
        <Field label="Conta de recebimento">
          <AccountPicker value={accountId} onChange={setAccountId} />
        </Field>
      </div>
    </Modal>
  )
}

// ─── GatewayCard ─────────────────────────────────────────────────────────────
function GatewayCard({ g, onConnect, onConfigure, onTest, onDisconnect }: {
  g: Gateway; onConnect: () => void; onConfigure: () => void; onTest: () => void; onDisconnect: () => void
}) {
  const MethodIcon = ({ m }: { m: string }) => m === 'Pix' ? <Zap size={10} /> : m === 'Cartão' ? <CreditCard size={10} /> : <FileText size={10} />
  return (
    <div className="bg-surface border border-border rounded-xl p-5 hover:border-border transition-colors flex flex-col">
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

      <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
        {g.methods.map(m => (
          <span key={m} className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-surface-2 border border-border text-[10.5px] font-medium text-text-muted">
            <MethodIcon m={m} />{m}
          </span>
        ))}
        <span className="text-[10.5px] text-text-muted ml-auto">{g.feeText}</span>
      </div>

      {g.connected && (
        <div className="mt-4 pt-4 border-t border-border space-y-2 text-[11.5px]">
          <div className="flex items-center gap-2"><Landmark size={11} className="text-text-muted shrink-0" /><span className="text-text-muted shrink-0">Conta:</span><span className="text-text truncate">{g.account}</span></div>
          <div className="flex items-center gap-2"><RefreshCw size={11} className="text-text-muted shrink-0" /><span className="text-text-muted shrink-0">Sync:</span><span className="text-text">{relTime(g.lastSync ?? 0)}</span></div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <div><div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Volume (30d)</div><div className="text-[13px] font-semibold text-[color:var(--success)] mt-0.5">{fmtBRL(g.processedVolume ?? 0)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Transações</div><div className="text-[13px] font-semibold text-text mt-0.5">{fmtNum(g.processedTx ?? 0)}</div></div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
        {g.connected ? (
          <>
            <Btn variant="primary" size="sm" onClick={onTest}><Zap size={13} />Testar Pix</Btn>
            <Btn variant="secondary" size="sm" onClick={onConfigure}><Settings size={13} />Configurar</Btn>
            <button onClick={onDisconnect} className="ml-auto w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-[color:var(--danger)]/10 hover:text-[color:var(--danger)]" title="Desconectar"><Unplug size={14} /></button>
          </>
        ) : (
          <Btn variant="primary" size="sm" onClick={onConnect} className="w-full"><Plug size={13} />Conectar {g.name}</Btn>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GatewaysPage() {
  const [gateways,      setGateways]      = useState<Gateway[]>([])
  const [connecting,    setConnecting]    = useState<Gateway | null>(null)
  const [testing,       setTesting]       = useState<Gateway | null>(null)
  const [disconnecting, setDisconnecting] = useState<Gateway | null>(null)
  const [configuring,   setConfiguring]   = useState<Gateway | null>(null)
  const [toast,         setToast]         = useState('')
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data, error } = await sb.from('gateways').select('*')
        if (error || !data || data.length === 0) throw new Error('no data')
        setGateways(data as Gateway[])
      } catch { setGateways(MOCK) } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toast])

  async function persistGateway(gw: Gateway) {
    try { const sb = createClient(); await sb.from('gateways').upsert({ id: gw.id, name: gw.name, connected: gw.connected, account: gw.account, api_key: gw.apiKey, processed_volume: gw.processedVolume, processed_tx: gw.processedTx }) } catch { /* silent */ }
  }

  function handleConnected(gw: Gateway) { setGateways(arr => arr.map(g => g.id === gw.id ? gw : g)); persistGateway(gw); setToast(`${gw.name} conectado com sucesso.`) }
  function handleDisconnect(gw: Gateway) {
    const updated = { ...gw, connected: false, account: undefined, accountInfo: undefined, lastSync: undefined, processedVolume: 0, processedTx: 0 }
    setGateways(arr => arr.map(g => g.id === gw.id ? updated : g)); persistGateway(updated); setToast(`${gw.name} desconectado.`)
  }
  function handleUpdate(id: string, patch: Partial<Gateway>) {
    setGateways(arr => arr.map(g => { if (g.id !== id) return g; const upd = { ...g, ...patch }; persistGateway(upd); return upd })); setToast('Configuração salva.')
  }

  const connected   = gateways.filter(g => g.connected)
  const available   = gateways.filter(g => !g.connected)
  const totalVolume = connected.reduce((s, g) => s + (g.processedVolume ?? 0), 0)
  const totalTx     = connected.reduce((s, g) => s + (g.processedTx ?? 0), 0)
  const avgFee      = useMemo(() => { const list = connected.map(g => g.fee?.pix ?? g.fee?.card ?? 2.99); return list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0 }, [connected])

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-32"><Loader2 size={24} className="animate-spin text-text-muted" /></div></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <PageHeader title="Gateways" subtitle="Conecte seus adquirentes para processar pagamentos com split automático para sua conta." />

        {toast && (
          <div className="mb-4 flex items-center gap-2.5 bg-[color:var(--success)]/5 border border-[color:var(--success)]/30 rounded-lg px-3.5 py-2">
            <Check size={15} className="text-[color:var(--success)]" />
            <div className="text-[12.5px] text-[color:var(--success)] flex-1">{toast}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Kpi label="Gateways conectados"    value={`${connected.length} / ${gateways.length}`} Icon={Plug}           tone="primary" />
          <Kpi label="Volume processado (30d)" value={fmtBRL(totalVolume)}                        Icon={TrendingUp}     highlight />
          <Kpi label="Transações"              value={fmtNum(totalTx)}                            Icon={ArrowLeftRight} />
          <Kpi label="Taxa média ponderada"    value={fmtPct(avgFee, 2)}                          Icon={Percent} />
        </div>

        <div className="mb-5 flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-fg flex items-center justify-center shrink-0"><Scissors size={15} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-text">Split automático em todas as vendas</div>
            <div className="text-[11.5px] text-text-muted mt-0.5">
              Em cada venda, <strong className="text-text">{fmtPct(UMBRA_FEE_PCT, 0)} ficam com o Umbra Bot</strong> e o <strong className="text-text">restante é depositado na sua conta</strong> — sem boleto separado.
            </div>
          </div>
        </div>

        {connected.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Conectados</h2>
              <span className="text-[10.5px] text-text-muted">{connected.length} gateways</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {connected.map(g => <GatewayCard key={g.id} g={g} onConnect={() => {}} onConfigure={() => setConfiguring(g)} onTest={() => setTesting(g)} onDisconnect={() => setDisconnecting(g)} />)}
            </div>
          </section>
        )}

        {available.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Disponíveis</h2>
              <span className="text-[10.5px] text-text-muted">{available.length} gateways</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {available.map(g => <GatewayCard key={g.id} g={g} onConnect={() => setConnecting(g)} onConfigure={() => {}} onTest={() => {}} onDisconnect={() => {}} />)}
            </div>
          </section>
        )}

        <ConnectModal    open={!!connecting}    onClose={() => setConnecting(null)}    g={connecting}    onConnected={handleConnected} />
        <PixTestModal    open={!!testing}       onClose={() => setTesting(null)}       g={testing} />
        <DisconnectModal open={!!disconnecting} onClose={() => setDisconnecting(null)} g={disconnecting} onConfirm={handleDisconnect} />
        <ConfigureModal  open={!!configuring}   onClose={() => setConfiguring(null)}   g={configuring}   onUpdate={handleUpdate} />
      </div>
    </DashboardLayout>
  )
}
