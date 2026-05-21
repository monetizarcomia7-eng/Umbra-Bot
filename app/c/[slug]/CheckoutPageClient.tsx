'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Lock, Zap, CreditCard, FileText, User, Mail, BadgeCheck,
  Phone, MapPin, Loader2, Check, AlertTriangle, X, QrCode, RefreshCw,
} from 'lucide-react'
import type { PublicCheckout } from './page'

/* ─── Types ──────────────────────────────────────────────── */

interface CheckoutPageClientProps {
  checkout:    PublicCheckout
  utmSource?:  string
  utmMedium?:  string
  utmCampaign?: string
  appUrl:      string
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

const allFieldDefs: FieldDef[] = [
  { id: 'name',    label: 'Nome completo', icon: User,       type: 'text'  },
  { id: 'email',   label: 'E-mail',        icon: Mail,       type: 'email' },
  { id: 'cpf',     label: 'CPF',           icon: BadgeCheck, type: 'text',  mask: (v) => v.replace(/\D/g,'').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2').slice(0,14) },
  { id: 'phone',   label: 'Telefone',      icon: Phone,      type: 'tel',   mask: (v) => v.replace(/\D/g,'').replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2').slice(0,15) },
  { id: 'address', label: 'Endereço',      icon: MapPin,     type: 'text'  },
  { id: 'cep',     label: 'CEP',           icon: MapPin,     type: 'text',  mask: (v) => v.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9) },
]

const methodIcon:  Record<string, React.ElementType> = { pix: Zap,  card: CreditCard, boleto: FileText }
const methodLabel: Record<string, string>             = { pix: 'Pix', card: 'Cartão',  boleto: 'Boleto' }

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

/* ─── Component ──────────────────────────────────────────── */

export default function CheckoutPageClient({
  checkout, utmSource, utmMedium, utmCampaign, appUrl,
}: CheckoutPageClientProps) {
  const c       = checkout
  const isDark  = c.bg_variant === 'dark'
  const methods = (['pix', 'card', 'boleto'] as const).filter((m) => c.methods[m])
  const fields  = allFieldDefs.filter((f) => c.fields[f.id])

  const [step,          setStep]          = useState<PayStep>('form')
  const [method,        setMethod]        = useState<string>(methods[0] ?? 'pix')
  const [form,          setForm]          = useState<Record<string, string>>({})
  const [errors,        setErrors]        = useState<Record<string, string>>({})
  const [submitting,    setSubmitting]    = useState(false)
  const [pixData,       setPixData]       = useState<{ qr_code: string; copy_paste: string; expires_at: string } | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [errMsg,        setErrMsg]        = useState('')
  const [copied,        setCopied]        = useState(false)
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

    // Chama RPC pública via fetch — grant to anon na migração 078
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

  // Polling de confirmação PIX — a cada 4s enquanto step='payment'
  // Para automaticamente em: aprovado, cancelado ou após 120 tentativas (≈8 min)
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

  function handleField(id: string, raw: string) {
    const def = allFieldDefs.find((f) => f.id === id)
    const val = def?.mask ? def.mask(raw) : raw
    setForm((prev) => ({ ...prev, [id]: val }))
    if (errors[id]) setErrors((prev) => { const e = { ...prev }; delete e[id]; return e })
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    for (const f of fields) {
      const v = (form[f.id] ?? '').trim()
      if (!v) { errs[f.id] = `${f.label} é obrigatório.`; continue }
      if (f.id === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errs[f.id] = 'E-mail inválido.'
      if (f.id === 'cpf'   && v.replace(/\D/g,'').length !== 11)      errs[f.id] = 'CPF deve ter 11 dígitos.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
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

      if (method === 'pix') {
        setPixData({ qr_code: data.pix_qr_code, copy_paste: data.pix_copy_paste, expires_at: data.expires_at })
        setTransactionId(data.transaction_id ?? null)
        setStep('payment')
      } else {
        setStep('success')
      }
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
            {c.badge && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider mb-3"
                style={{ background: c.primary_color + '22', color: c.primary_color }}
              >
                {c.badge}
              </span>
            )}
            <div
              className="aspect-[4/3] rounded-xl mb-4 flex items-center justify-center text-[13px]"
              style={{ background: `linear-gradient(135deg, ${c.primary_color}18, ${palette.bg})`, border: `1px dashed ${palette.border}`, color: palette.muted }}
            >
              imagem do produto
            </div>
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
                          placeholder={f.id === 'email' ? 'voce@email.com' : f.id === 'cpf' ? '000.000.000-00' : ''}
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
                      return (
                        <button
                          key={m}
                          onClick={() => setMethod(m)}
                          className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border-2 text-[12px] font-medium transition-colors focus:outline-none"
                          style={{
                            background:   active ? c.primary_color + '15' : 'transparent',
                            borderColor:  active ? c.primary_color : palette.border,
                            color:        active ? c.primary_color : palette.muted,
                          }}
                        >
                          <MIcon size={18} />
                          {methodLabel[m]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
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
                  Escaneie o QR Code ou copie o código abaixo. Após o pagamento, a confirmação é automática.
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

                {/* Indicador de polling — aguardando confirmação do pagamento */}
                <div
                  className="w-full rounded-xl px-3 py-2.5 mb-2 flex items-center gap-2"
                  style={{ background: isDark ? '#0d2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}` }}
                >
                  <RefreshCw size={12} className="animate-spin shrink-0" style={{ color: '#22c55e' }} />
                  <span className="text-[11.5px]" style={{ color: isDark ? '#86efac' : '#166534' }}>
                    Aguardando confirmação do pagamento…
                  </span>
                </div>

                <p className="text-[11px]" style={{ color: palette.subtle }}>
                  Código válido por 30 minutos · confirmação automática após o pagamento.
                </p>
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
                  {method === 'pix'
                    ? 'Seu Pix foi recebido e o pedido foi confirmado com sucesso.'
                    : 'Recebemos o seu pagamento e você receberá um e-mail de confirmação em breve.'}
                </p>
                {form.email && (
                  <div
                    className="rounded-xl px-4 py-3 text-[12px] text-center"
                    style={{ background: isDark ? '#0d2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`, color: isDark ? '#86efac' : '#166534' }}
                  >
                    Uma confirmação foi enviada para <strong>{form.email}</strong>
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
    </div>
  )
}
