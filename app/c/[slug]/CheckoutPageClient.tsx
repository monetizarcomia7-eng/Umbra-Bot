'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Lock, Zap, CreditCard, FileText, User, Mail, BadgeCheck,
  Phone, MapPin, Loader2, Check, AlertTriangle, X, QrCode, RefreshCw,
  Shield, Clock,
} from 'lucide-react'
import type { PublicCheckout }   from './page'
import PixelScripts              from './PixelScripts'
import type { PublicPixelConfig } from './PixelScripts'

/* ─── Types ──────────────────────────────────────────────── */

interface CheckoutPageClientProps {
  checkout:     PublicCheckout
  pixels?:      PublicPixelConfig[]
  utmSource?:   string
  utmMedium?:   string
  utmCampaign?: string
  appUrl:       string
}

interface FieldDef {
  id:    string
  label: string
  icon:  React.ElementType
  type:  'text' | 'email' | 'tel'
  mask?: (v: string) => string
}

type PayStep = 'form' | 'payment' | 'success' | 'error'

/* ─── Constants ──────────────────────────────────────────── */

function maskCpfCnpj(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 14)
  if (n.length <= 11) {
    return n
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return n
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

const allFieldDefs: FieldDef[] = [
  { id: 'name',    label: 'Nome completo', icon: User,       type: 'text'  },
  { id: 'email',   label: 'E-mail',        icon: Mail,       type: 'email' },
  { id: 'cpf',     label: 'CPF / CNPJ',   icon: BadgeCheck, type: 'text',  mask: maskCpfCnpj },
  { id: 'phone',   label: 'Telefone',      icon: Phone,      type: 'tel',   mask: (v) => v.replace(/\D/g,'').replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2').slice(0,15) },
  { id: 'address', label: 'Endereço',      icon: MapPin,     type: 'text'  },
  { id: 'cep',     label: 'CEP',           icon: MapPin,     type: 'text',  mask: (v) => v.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9) },
]

const methodIcon:  Record<string, React.ElementType> = { pix: Zap,  card: CreditCard, boleto: FileText }
const methodLabel: Record<string, string>             = { pix: 'Pix', card: 'Cartão',  boleto: 'Boleto' }

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

function fmtCountdown(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

/* ─── Component ──────────────────────────────────────────── */

export default function CheckoutPageClient({
  checkout, pixels = [], utmSource, utmMedium, utmCampaign, appUrl,
}: CheckoutPageClientProps) {
  const c       = checkout
  const isDark  = c.bg_variant === 'dark'
  const methods = (['pix', 'card', 'boleto'] as const).filter((m) => c.methods[m])

  // CPF/CNPJ is always required; other fields follow checkout config
  const fields = allFieldDefs.filter((f) => f.id === 'cpf' || c.fields[f.id])

  const [step,          setStep]          = useState<PayStep>('form')
  const [method,        setMethod]        = useState<string>(methods[0] ?? 'pix')
  const [form,          setForm]          = useState<Record<string, string>>({})
  const [errors,        setErrors]        = useState<Record<string, string>>({})
  const [submitting,    setSubmitting]    = useState(false)
  const [pixData,       setPixData]       = useState<{ qr_code: string; copy_paste: string; expires_at: string } | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [errMsg,        setErrMsg]        = useState('')
  const [copied,        setCopied]        = useState(false)
  const [pixSecondsLeft, setPixSecondsLeft] = useState<number | null>(null)
  const [urgencyLeft,    setUrgencyLeft]    = useState<number | null>(null)
  const visitTracked = useRef(false)

  // Palette
  const palette = isDark ? {
    bg: '#0b1220', surface: '#0f1b2d', text: '#e5e7eb', muted: '#94a3b8',
    border: '#1e293b', subtle: '#64748b', inputBg: '#0f1b2d',
  } : {
    bg: '#f6f7f9', surface: '#ffffff', text: '#0f172a', muted: '#475569',
    border: '#e2e8f0', subtle: '#94a3b8', inputBg: '#ffffff',
  }

  // Rastreia visita ao montar (fire-and-forget via RPC anon)
  useEffect(() => {
    if (visitTracked.current) return
    visitTracked.current = true

    const body = JSON.stringify({
      p_slug:         c.slug,
      p_utm_source:   utmSource   ?? null,
      p_utm_medium:   utmMedium   ?? null,
      p_utm_campaign: utmCampaign ?? null,
    })

    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/track_checkout_visit`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
      },
      body,
    }).catch(() => { /* fire-and-forget */ })
  }, [c.slug, utmSource, utmMedium, utmCampaign])

  // Contador de urgência (independente do pagamento)
  useEffect(() => {
    if (!c.countdown_end) return
    function calcUrgency() {
      const diff = Math.max(0, Math.floor((new Date(c.countdown_end!).getTime() - Date.now()) / 1000))
      setUrgencyLeft(diff)
    }
    calcUrgency()
    const t = setInterval(calcUrgency, 1000)
    return () => clearInterval(t)
  }, [c.countdown_end])

  // Countdown do PIX (30 min a partir da criação)
  useEffect(() => {
    if (step !== 'payment' || !pixData?.expires_at) return
    function calcPix() {
      const diff = Math.max(0, Math.floor((new Date(pixData!.expires_at).getTime() - Date.now()) / 1000))
      setPixSecondsLeft(diff)
      if (diff <= 0) {
        setErrMsg('O tempo para pagamento expirou. Gere um novo código PIX.')
        setStep('error')
      }
    }
    calcPix()
    const t = setInterval(calcPix, 1000)
    return () => clearInterval(t)
  }, [step, pixData])

  // Polling de confirmação PIX — a cada 4s enquanto step='payment'
  useEffect(() => {
    if (step !== 'payment' || !transactionId) return

    let attempts = 0
    const MAX_ATTEMPTS = 120
    const controller = new AbortController()

    async function poll() {
      if (attempts >= MAX_ATTEMPTS) return
      attempts++
      try {
        const res = await fetch(
          `/api/checkout/status?tx_id=${encodeURIComponent(transactionId ?? '')}&checkout_id=${encodeURIComponent(c.id)}`,
          { signal: controller.signal },
        )
        if (!res.ok) return
        const { status } = await res.json() as { status: string }
        if (status === 'approved') {
          setStep('success')
        } else if (status === 'cancelled') {
          setErrMsg('O PIX expirou ou foi cancelado. Gere um novo para tentar novamente.')
          setStep('error')
        }
      } catch {
        /* network error ou abort — ignora silenciosamente */
      }
    }

    const interval = setInterval(poll, 4_000)
    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [step, transactionId, c.id])

  // Redireciona para success_url 3s após confirmação
  useEffect(() => {
    if (step !== 'success' || !c.success_url) return
    const t = setTimeout(() => { window.location.href = c.success_url! }, 3000)
    return () => clearTimeout(t)
  }, [step, c.success_url])

  function handleField(id: string, raw: string) {
    const def = allFieldDefs.find((f) => f.id === id)
    const val = def?.mask ? def.mask(raw) : raw
    setForm((prev) => ({ ...prev, [id]: val }))
    if (errors[id]) setErrors((prev) => { const e = { ...prev }; delete e[id]; return e })
  }

  function validateCPF(d: string): boolean {
    if (/^(\d)\1{10}$/.test(d)) return false
    let sum = 0; let rem: number
    for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
    rem = (sum * 10) % 11; if (rem >= 10) rem = 0
    if (rem !== parseInt(d[9])) return false
    sum = 0
    for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
    rem = (sum * 10) % 11; if (rem >= 10) rem = 0
    return rem === parseInt(d[10])
  }

  function validateCNPJ(d: string): boolean {
    if (/^(\d)\1{13}$/.test(d)) return false
    const calc = (n: string, w: number[]) => { const r = w.reduce((s, v, i) => s + parseInt(n[i]) * v, 0) % 11; return r < 2 ? 0 : 11 - r }
    return calc(d, [5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(d[12]) && calc(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(d[13])
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    for (const f of fields) {
      const v = (form[f.id] ?? '').trim()
      if (!v) { errs[f.id] = `${f.label} é obrigatório.`; continue }
      if (f.id === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errs[f.id] = 'E-mail inválido.'
      }
      if (f.id === 'cpf') {
        const digits = v.replace(/\D/g, '')
        if (digits.length === 11 && !validateCPF(digits)) errs[f.id] = 'CPF inválido.'
        else if (digits.length === 14 && !validateCNPJ(digits)) errs[f.id] = 'CNPJ inválido.'
        else if (digits.length !== 11 && digits.length !== 14) errs[f.id] = 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos.'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    // Cartão e boleto ainda não implementados
    if (method !== 'pix') {
      setErrMsg('Pagamento por cartão e boleto ainda não disponível. Use o Pix.')
      setStep('error')
      return
    }

    setSubmitting(true)
    setErrMsg('')

    try {
      const res = await fetch('/api/checkout/pay', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id:    c.id,
          customer_name:  form.name  ?? '',
          customer_email: form.email ?? '',
          customer_cpf:   form.cpf   ?? '',
          customer_phone: form.phone ?? undefined,
          method,
          utm_source:     utmSource   ?? null,
          utm_medium:     utmMedium   ?? null,
          utm_campaign:   utmCampaign ?? null,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error ?? 'Erro ao processar pagamento.'); setStep('error'); return }

      setPixData({ qr_code: data.pix_qr_code, copy_paste: data.pix_copy_paste, expires_at: data.expires_at })
      setTransactionId(data.transaction_id ?? null)
      setStep('payment')
    } catch {
      setErrMsg('Erro de conexão. Verifique sua internet e tente novamente.')
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  function copyPixCode() {
    if (!pixData) return
    navigator.clipboard.writeText(pixData.copy_paste).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const installmentValue = c.price / Math.min(c.installments, 12)

  return (
    <div
      className="min-h-screen"
      style={{ background: palette.bg, color: palette.text, fontFamily: `${c.font}, Inter, sans-serif` }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b"
        style={{ background: palette.surface, borderColor: palette.border }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[13px] font-bold"
              style={{ background: c.primary_color }}
            >
              {c.logo}
            </div>
            <span className="text-[15px] font-semibold tracking-tight">{c.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: palette.muted }}>
            <Lock size={12} /> Pagamento seguro
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div
          className={
            c.layout === 'two_col'
              ? 'grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-start'
              : 'max-w-xl mx-auto'
          }
        >
          {/* ── Produto ── */}
          <div
            className="rounded-2xl border p-6"
            style={{ background: palette.surface, borderColor: palette.border }}
          >
            {/* Urgency countdown */}
            {c.countdown_end && urgencyLeft !== null && urgencyLeft > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4 text-[12.5px] font-semibold"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
              >
                <Clock size={14} className="shrink-0" />
                Oferta termina em{' '}
                <span className="font-mono">{fmtCountdown(urgencyLeft)}</span>
              </div>
            )}

            {c.badge && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider mb-3"
                style={{ background: c.primary_color + '22', color: c.primary_color }}
              >
                {c.badge}
              </span>
            )}
            {c.product_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.product_image}
                alt={c.product_name}
                className="w-full aspect-[4/3] object-cover rounded-xl mb-4"
              />
            ) : (
              <div
                className="aspect-[4/3] rounded-xl mb-4 flex items-center justify-center text-[13px]"
                style={{ background: `linear-gradient(135deg, ${c.primary_color}18, ${palette.bg})`, border: `1px dashed ${palette.border}`, color: palette.muted }}
              />
            )}
            <h1 className="text-[22px] font-bold tracking-tight leading-snug">{c.product_name}</h1>
            <p className="text-[14px] mt-2 leading-relaxed" style={{ color: palette.muted }}>{c.product_desc}</p>

            <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${palette.border}` }}>
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: palette.subtle }}>Valor</div>
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] font-extrabold tracking-tight">{fmtBRL(c.price)}</span>
                {c.installments > 1 && (
                  <span className="text-[13px]" style={{ color: palette.muted }}>
                    ou {c.installments}× de <strong style={{ color: palette.text }}>{fmtBRL(installmentValue)}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Guarantee badge */}
            {c.guarantee_days && c.guarantee_days > 0 && (
              <div
                className="flex items-center gap-2 mt-4 rounded-xl px-3 py-2.5 text-[12.5px] font-medium"
                style={{ background: isDark ? '#0d2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`, color: isDark ? '#86efac' : '#166534' }}
              >
                <Shield size={14} className="shrink-0" />
                Garantia de {c.guarantee_days} dias · sem burocracia
              </div>
            )}
          </div>

          {/* ── Formulário / Pagamento / Sucesso ── */}
          <div
            className="rounded-2xl border p-6"
            style={{ background: palette.surface, borderColor: palette.border }}
          >
            {/* === FORMULÁRIO === */}
            {step === 'form' && (
              <>
                <h2 className="text-[15px] font-semibold mb-4">Seus dados</h2>
                <div className="space-y-4">
                  {fields.map((f) => (
                    <div key={f.id}>
                      <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: palette.muted }}>
                        {f.label}
                      </label>
                      <div className="relative">
                        <f.icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: palette.subtle }} />
                        <input
                          type={f.type}
                          value={form[f.id] ?? ''}
                          onChange={(e) => handleField(f.id, e.target.value)}
                          className="w-full h-11 pl-9 pr-3 rounded-xl text-[13.5px] border focus:outline-none focus:ring-2 transition"
                          style={{
                            background:   palette.inputBg,
                            color:        palette.text,
                            borderColor:  errors[f.id] ? '#ef4444' : palette.border,
                            // @ts-expect-error – CSS variable assignment
                            '--tw-ring-color': errors[f.id] ? '#ef444440' : `${c.primary_color}40`,
                          }}
                          placeholder={
                            f.id === 'email' ? 'voce@email.com' :
                            f.id === 'cpf'   ? 'CPF ou CNPJ' : ''
                          }
                          inputMode={f.id === 'cpf' || f.id === 'phone' || f.id === 'cep' ? 'numeric' : undefined}
                        />
                      </div>
                      {errors[f.id] && (
                        <p className="text-[11.5px] text-red-500 mt-1 flex items-center gap-1">
                          <AlertTriangle size={11} /> {errors[f.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Métodos de pagamento */}
                <div className="mt-5">
                  <h2 className="text-[15px] font-semibold mb-3">Forma de pagamento</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {methods.map((m) => {
                      const MIcon  = methodIcon[m]
                      const active = method === m
                      const isPix  = m === 'pix'
                      return (
                        <button
                          key={m}
                          onClick={() => setMethod(m)}
                          className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-[12px] font-medium transition-colors focus:outline-none relative"
                          style={{
                            background:   active ? c.primary_color + '15' : 'transparent',
                            borderColor:  active ? c.primary_color : palette.border,
                            color:        active ? c.primary_color : palette.muted,
                            opacity:      isPix ? 1 : 0.5,
                          }}
                        >
                          <MIcon size={18} />
                          {methodLabel[m]}
                          {!isPix && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: palette.subtle }}>
                              Em breve
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {method !== 'pix' && (
                    <p className="text-[11.5px] mt-2 text-center" style={{ color: palette.muted }}>
                      Apenas Pix disponível no momento. Selecione Pix para continuar.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || method !== 'pix'}
                  className="w-full mt-6 h-12 rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: c.primary_color }}
                >
                  {submitting
                    ? <><Loader2 size={18} className="animate-spin" /> Processando…</>
                    : <><Lock size={15} /> Pagar {fmtBRL(c.price)}</>}
                </button>
                <p className="text-[11px] text-center mt-2.5" style={{ color: palette.subtle }}>
                  🔒 Compra 100% segura · SSL · dados criptografados
                </p>
              </>
            )}

            {/* === PIX QR CODE === */}
            {step === 'payment' && pixData && (
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: c.primary_color + '20' }}
                >
                  <QrCode size={22} style={{ color: c.primary_color }} />
                </div>
                <h2 className="text-[17px] font-bold mb-1">Pague via Pix</h2>
                <p className="text-[12.5px] mb-5 text-center" style={{ color: palette.muted }}>
                  Escaneie o QR Code ou copie o código abaixo. Confirmação automática após o pagamento.
                </p>

                {pixData.qr_code && (
                  <div
                    className="p-3 rounded-2xl mb-4"
                    style={{ background: '#fff', border: `1px solid ${palette.border}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${pixData.qr_code}`}
                      alt="QR Code Pix"
                      className="w-44 h-44"
                    />
                  </div>
                )}

                <div
                  className="w-full rounded-xl p-3 mb-3 flex items-center gap-2"
                  style={{ background: isDark ? '#1e293b' : '#f1f5f9', border: `1px solid ${palette.border}` }}
                >
                  <code className="flex-1 text-[11px] font-mono break-all leading-snug" style={{ color: palette.muted }}>
                    {pixData.copy_paste.slice(0, 80)}…
                  </code>
                  <button
                    onClick={copyPixCode}
                    className="shrink-0 h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
                    style={{ background: c.primary_color, color: '#fff' }}
                  >
                    {copied ? <><Check size={13} /> Copiado!</> : 'Copiar'}
                  </button>
                </div>

                {/* Countdown do PIX */}
                {pixSecondsLeft !== null && pixSecondsLeft > 0 && (
                  <div
                    className="w-full rounded-xl px-3 py-2.5 mb-2 flex items-center justify-between"
                    style={{ background: isDark ? '#1e1a0a' : '#fffbeb', border: `1px solid ${isDark ? '#854d0e' : '#fde68a'}` }}
                  >
                    <span className="text-[11.5px]" style={{ color: isDark ? '#fde68a' : '#92400e' }}>
                      Código expira em
                    </span>
                    <span className="text-[13px] font-bold font-mono tabular-nums" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
                      {fmtCountdown(pixSecondsLeft)}
                    </span>
                  </div>
                )}

                {/* Indicador de polling */}
                <div
                  className="w-full rounded-xl px-3 py-2.5 mb-2 flex items-center gap-2"
                  style={{ background: isDark ? '#0d2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}` }}
                >
                  <RefreshCw size={12} className="animate-spin shrink-0" style={{ color: '#22c55e' }} />
                  <span className="text-[11.5px]" style={{ color: isDark ? '#86efac' : '#166534' }}>
                    Aguardando confirmação do pagamento…
                  </span>
                </div>
              </div>
            )}

            {/* === SUCESSO === */}
            {step === 'success' && (
              <div className="flex flex-col items-center py-8">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: '#22c55e20' }}
                >
                  <Check size={32} className="text-green-500" />
                </div>
                <h2 className="text-[20px] font-bold mb-2">Pagamento confirmado!</h2>
                <p className="text-[13px] text-center leading-relaxed mb-4" style={{ color: palette.muted }}>
                  Seu Pix foi recebido e o pedido foi confirmado com sucesso.
                </p>

                {c.success_url && (
                  <div
                    className="rounded-xl px-4 py-3 text-[12px] text-center w-full"
                    style={{ background: isDark ? '#0d2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`, color: isDark ? '#86efac' : '#166534' }}
                  >
                    <Loader2 size={13} className="inline animate-spin mr-1.5" />
                    Redirecionando em instantes…
                  </div>
                )}
              </div>
            )}

            {/* === ERRO === */}
            {step === 'error' && (
              <div className="flex flex-col items-center py-6">
                <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
                  <X size={26} className="text-red-500" />
                </div>
                <h2 className="text-[18px] font-bold mb-2">Falha no pagamento</h2>
                <p className="text-[13px] text-center leading-relaxed mb-5" style={{ color: palette.muted }}>
                  {errMsg}
                </p>
                <button
                  onClick={() => setStep('form')}
                  className="h-10 px-5 rounded-xl text-[13px] font-semibold text-white"
                  style={{ background: c.primary_color }}
                >
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t mt-10 py-4 text-center text-[11px]"
        style={{ borderColor: palette.border, color: palette.subtle }}
      >
        Powered by <strong>Umbra Bot</strong> · Pagamentos processados com segurança
      </footer>

      {/* Pixels browser-side: PageView, InitiateCheckout, Purchase */}
      <PixelScripts
        pixels={pixels}
        step={step}
        price={c.price}
        productName={c.product_name}
      />
    </div>
  )
}
