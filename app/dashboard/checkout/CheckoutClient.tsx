'use client'

import {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react'
import {
  Search, Plus, ChevronLeft, Eye, Save, Rocket, ExternalLink,
  Lock, Zap, CreditCard, FileText, Check, X, User, Mail,
  BadgeCheck, Phone, MapPin, Type, Copy, Trash2, MoreHorizontal,
  Layers, Clock, AlertTriangle, Loader2, Archive, Upload,
  Monitor, Smartphone, Shield, BarChart2, ChevronDown,
} from 'lucide-react'
import { DashboardLayout }  from '@/components/dashboard/Layout'
import { PageHeader }       from '@/components/dashboard/PageHeader'
import { createClient }     from '@/lib/supabase/client'
import { useAnalytics }     from '@/hooks/use-analytics'
import type { RawCheckout, RawGateway, RawPixel } from './page'

/* ============================================================
   Types
   ============================================================ */

interface CheckoutFields  { name: boolean; email: boolean; cpf: boolean; phone: boolean; address: boolean; cep: boolean }
interface CheckoutMethods { pix: boolean; card: boolean; boleto: boolean }

interface Checkout {
  id: string; name: string; slug: string; productName: string; productDesc: string
  productImage: string; price: number; installments: number
  gateway: string; pixel: string; primaryColor: string; bgVariant: 'light' | 'dark'
  font: string; logo: string; badge?: string
  fields: CheckoutFields; methods: CheckoutMethods
  layout: 'two_col' | 'one_col'; status: 'published' | 'draft' | 'archived'
  visits: number; conversions: number; conversion: number; updatedAt: number
  successUrl:    string
  guaranteeDays: number | null
  countdownEnd:  string | null
}

interface GatewayChoice { id: string; label: string; color: string }
interface PixelChoice   { id: string; label: string }
interface FieldDef      { id: keyof CheckoutFields; label: string; icon: React.ElementType; required: boolean; always: boolean }

interface CheckoutTemplate {
  name: string; productName: string; productDesc: string; price: number
  installments: number; primaryColor: string; bgVariant: 'light' | 'dark'
  font: string; logo: string; badge?: string
  fields: CheckoutFields; methods: CheckoutMethods; layout: 'two_col' | 'one_col'
}

interface CheckoutClientProps {
  initialCheckouts:  RawCheckout[]
  userId:            string
  connectedGateways: RawGateway[]
  configuredPixels:  RawPixel[]
  appUrl:            string
}

/* ============================================================
   Constants
   ============================================================ */

const GATEWAY_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  pushinpay:   'Pushinpay',
  pagarme:     'Pagar.me',
  stripe:      'Stripe',
}
const GATEWAY_COLOR: Record<string, string> = {
  mercadopago: 'oklch(0.62 0.16 240)',
  pushinpay:   'oklch(0.65 0.18 145)',
  pagarme:     'oklch(0.55 0.20 285)',
  stripe:      'oklch(0.62 0.16 290)',
}
const PIXEL_LABEL: Record<string, string> = {
  meta:   'Meta Pixel',
  tiktok: 'TikTok Pixel',
  google: 'Google Tag (GA4)',
}

const STATIC_GATEWAY_CHOICES: GatewayChoice[] = [
  { id: 'mercadopago', label: 'Mercado Pago', color: GATEWAY_COLOR.mercadopago },
  { id: 'pushinpay',   label: 'Pushinpay',    color: GATEWAY_COLOR.pushinpay   },
  { id: 'pagarme',     label: 'Pagar.me',      color: GATEWAY_COLOR.pagarme     },
  { id: 'stripe',      label: 'Stripe',        color: GATEWAY_COLOR.stripe      },
]

const colorPresets = ['#7c3aed','#22c55e','#0ea5e9','#f97316','#ec4899','#0f172a']
const fontPresets  = ['Inter','Manrope','DM Sans','Plus Jakarta Sans']

const allFields: FieldDef[] = [
  { id: 'name',    label: 'Nome completo', icon: User,       required: true,  always: true  },
  { id: 'email',   label: 'E-mail',        icon: Mail,       required: true,  always: true  },
  { id: 'cpf',     label: 'CPF / CNPJ',    icon: BadgeCheck, required: true,  always: true  },
  { id: 'phone',   label: 'Telefone',      icon: Phone,      required: false, always: false },
  { id: 'address', label: 'Endereço',      icon: MapPin,     required: false, always: false },
  { id: 'cep',     label: 'CEP',           icon: MapPin,     required: false, always: false },
]

const coStatusMap: Record<string, { label: string; tone: string }> = {
  published: { label: 'Publicado', tone: 'success' },
  draft:     { label: 'Rascunho',  tone: 'muted'   },
  archived:  { label: 'Arquivado', tone: 'muted'   },
}

const CHECKOUT_TEMPLATES: Array<{ id: string; title: string; desc: string; data: CheckoutTemplate }> = [
  {
    id: 'blank',
    title: 'Em branco',
    desc: 'Checkout simples para personalizar do zero.',
    data: {
      name: 'Novo checkout', productName: 'Nome do produto',
      productDesc: 'Descrição curta que aparece logo abaixo do nome.',
      price: 100, installments: 6, primaryColor: '#7c3aed', bgVariant: 'light',
      font: 'Inter', logo: 'NC',
      fields: { name: true, email: true, cpf: false, phone: false, address: false, cep: false },
      methods: { pix: true, card: true, boleto: false }, layout: 'two_col',
    },
  },
  {
    id: 'digital',
    title: 'Produto digital',
    desc: 'Ideal para e-books, cursos e templates.',
    data: {
      name: 'Produto Digital', productName: 'Meu Produto Digital',
      productDesc: 'Acesso imediato após a confirmação do pagamento. Conteúdo 100% online.',
      price: 47, installments: 3, primaryColor: '#22c55e', bgVariant: 'light',
      font: 'DM Sans', logo: 'PD', badge: 'Acesso imediato',
      fields: { name: true, email: true, cpf: false, phone: false, address: false, cep: false },
      methods: { pix: true, card: true, boleto: false }, layout: 'two_col',
    },
  },
  {
    id: 'mentoria',
    title: 'Mentoria',
    desc: 'Para mentorias, consultorias e acompanhamentos.',
    data: {
      name: 'Mentoria Premium', productName: 'Mentoria Individual',
      productDesc: 'Sessão estratégica de 90 minutos com diagnóstico completo e plano de ação personalizado.',
      price: 497, installments: 12, primaryColor: '#7c3aed', bgVariant: 'light',
      font: 'Plus Jakarta Sans', logo: 'MP', badge: 'Vagas limitadas',
      fields: { name: true, email: true, cpf: true, phone: true, address: false, cep: false },
      methods: { pix: true, card: true, boleto: false }, layout: 'two_col',
    },
  },
]

/* ============================================================
   Helpers
   ============================================================ */

function mapRaw(row: RawCheckout): Checkout {
  return {
    id:           row.id,
    name:         row.name,
    slug:         row.slug,
    productName:  row.product_name,
    productDesc:  row.product_desc,
    productImage: row.product_image ?? '',
    price:        Number(row.price),
    installments: row.installments,
    gateway:      row.gateway,
    pixel:        row.pixel,
    primaryColor: row.primary_color,
    bgVariant:    row.bg_variant,
    font:         row.font,
    logo:         row.logo,
    badge:        row.badge ?? undefined,
    fields:       row.fields as unknown as CheckoutFields,
    methods:      row.methods as unknown as CheckoutMethods,
    layout:       row.layout,
    status:       row.status,
    visits:       row.visits,
    conversions:  row.conversions,
    conversion:   Number(row.conversion),
    updatedAt:    new Date(row.updated_at).getTime(),
    successUrl:    row.success_url    ?? '',
    guaranteeDays: row.guarantee_days ?? null,
    countdownEnd:  row.countdown_end  ?? null,
  }
}

const fmtNum    = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtBRLdec = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
const fmtPct    = (n: number, d = 0) => n.toFixed(d).replace('.', ',') + '%'
const fmtDate   = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

/* ============================================================
   Micro components
   ============================================================ */

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    muted:   'bg-[var(--surface-2)] text-[var(--text-muted)]',
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    danger:  'bg-red-500/10 text-red-600 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium ${cls[tone] ?? cls.muted}`}>
      {children}
    </span>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

const inputCls    = 'w-full h-10 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50'
const textareaCls = 'w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 resize-none leading-relaxed'

function FieldC({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">{hint}</div>}
    </div>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
      <div className="mb-3">
        <h3 className="text-[13.5px] font-semibold text-[var(--text)]">{title}</h3>
        {subtitle && <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

/* ============================================================
   Toast
   ============================================================ */

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium animate-in slide-in-from-bottom-3 duration-200 ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
      {msg}
    </div>
  )
}

/* ============================================================
   Modais
   ============================================================ */

function DeleteModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text)]">Apagar checkout?</h3>
            <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5 leading-snug">
              <span className="font-medium text-[var(--text)]">"{name}"</span> será removido permanentemente. Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="h-9 px-4 text-[12.5px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 text-[12.5px] font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Apagar
          </button>
        </div>
      </div>
    </div>
  )
}

function BackConfirmModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-yellow-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text)]">Mudanças não salvas</h3>
            <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5 leading-snug">
              Você tem alterações não salvas. Deseja sair mesmo assim?
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="h-9 px-4 text-[12.5px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
            Continuar editando
          </button>
          <button onClick={onConfirm} className="h-9 px-4 text-[12.5px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity">
            Sair sem salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplatesModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: CheckoutTemplate) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text)]">Escolha um template</h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Personalize depois no editor.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 gap-2">
          {CHECKOUT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onCreate(t.data)}
              className="text-left p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors group focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-[11px] font-bold text-[var(--primary)] group-hover:bg-[var(--primary)]/10 transition-colors shrink-0">
                  {t.data.logo}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{t.title}</div>
                  <div className="text-[11.5px] text-[var(--text-muted)] leading-snug mt-0.5">{t.desc}</div>
                </div>
                <ChevronLeft size={14} className="text-[var(--text-muted)] rotate-180 ml-auto shrink-0 group-hover:text-[var(--primary)] transition-colors" />
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={() => onCreate(CHECKOUT_TEMPLATES[0].data)}
            className="w-full h-9 rounded-lg border border-dashed border-[var(--border)] text-[12.5px] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Começar do zero (em branco)
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Checkout Miniature (thumbnail)
   ============================================================ */

function CheckoutMiniature({ checkout }: { checkout: Checkout }) {
  const c = checkout
  const isDark = c.bgVariant === 'dark'
  return (
    <div
      className="rounded-md overflow-hidden border border-[var(--border)] pointer-events-none select-none"
      style={{ background: isDark ? '#0f172a' : '#fafbfc', fontFamily: c.font + ', sans-serif', color: isDark ? '#e5e7eb' : '#0f172a' }}
    >
      <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: isDark ? '1px solid #1e293b' : '1px solid #e5e7eb' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm flex items-center justify-center text-[6px] font-bold text-white" style={{ background: c.primaryColor }}>
            {c.logo[0]}
          </div>
          <span className="text-[6px] font-semibold">checkout.{c.slug}</span>
        </div>
        <span className="text-[6px] opacity-50">🔒 SSL</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-2">
        <div className="space-y-1">
          <div className="h-10 rounded-sm" style={{ background: isDark ? '#1e293b' : '#e5e7eb' }} />
          <div className="h-1 rounded-sm w-3/4" style={{ background: isDark ? '#334155' : '#cbd5e1' }} />
          <div className="h-1 rounded-sm w-1/2"  style={{ background: isDark ? '#334155' : '#cbd5e1' }} />
          <div className="h-2 rounded-sm w-1/3 mt-1" style={{ background: c.primaryColor }} />
        </div>
        <div className="space-y-1">
          <div className="h-2 rounded-sm" style={{ background: isDark ? '#334155' : '#cbd5e1' }} />
          <div className="h-2 rounded-sm" style={{ background: isDark ? '#334155' : '#cbd5e1' }} />
          <div className="h-2 rounded-sm" style={{ background: isDark ? '#334155' : '#cbd5e1' }} />
          <div className="flex gap-0.5">
            {c.methods.pix    && <div className="h-2 flex-1 rounded-sm" style={{ background: isDark ? '#475569' : '#94a3b8' }} />}
            {c.methods.card   && <div className="h-2 flex-1 rounded-sm" style={{ background: isDark ? '#475569' : '#94a3b8' }} />}
            {c.methods.boleto && <div className="h-2 flex-1 rounded-sm" style={{ background: isDark ? '#475569' : '#94a3b8' }} />}
          </div>
          <div className="h-3 rounded-sm mt-1" style={{ background: c.primaryColor }} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Checkout Preview (live)
   ============================================================ */

function CheckoutPreview({ checkout, gatewayChoices }: { checkout: Checkout; gatewayChoices: GatewayChoice[] }) {
  const c = checkout
  const isDark = c.bgVariant === 'dark'
  const visibleFields    = allFields.filter((f) => c.fields[f.id])
  const methodsList      = (['pix', 'card', 'boleto'] as const).filter((m) => c.methods[m])
  const installmentValue = c.price / Math.min(c.installments, 12)

  const palette = isDark ? {
    bg: '#0b1220', surface: '#0f1b2d', text: '#e5e7eb', muted: '#94a3b8', border: '#1e293b', subtle: '#64748b',
  } : {
    bg: '#f6f7f9', surface: '#ffffff', text: '#0f172a', muted: '#475569', border: '#e2e8f0', subtle: '#94a3b8',
  }

  const methodIcon:  Record<string, React.ElementType> = { pix: Zap, card: CreditCard, boleto: FileText }
  const methodLabel: Record<string, string> = { pix: 'Pix', card: 'Cartão', boleto: 'Boleto' }

  const fieldPlaceholder: Partial<Record<keyof CheckoutFields, string>> = {
    email: 'voce@email.com', cpf: '000.000.000-00', phone: '(11) 9 0000-0000', name: 'Seu nome',
  }

  return (
    <div
      className="rounded-xl border overflow-hidden text-[12px]"
      style={{ background: palette.bg, color: palette.text, borderColor: palette.border, fontFamily: c.font + ', Inter, sans-serif' }}
    >
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: palette.border, background: palette.surface }}>
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <div className="ml-3 px-2 py-0.5 rounded text-[10px] font-mono truncate" style={{ background: palette.bg, color: palette.muted, border: `1px solid ${palette.border}` }}>
          🔒 https://umbra.bot/c/{c.slug}
        </div>
      </div>

      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: palette.border, background: palette.surface }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold" style={{ background: c.primaryColor }}>
            {c.logo}
          </div>
          <div className="text-[13px] font-semibold tracking-tight">{c.name}</div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: palette.muted }}>
          <Lock size={10} /> Pagamento seguro
        </div>
      </div>

      {/* Body */}
      <div className={c.layout === 'two_col' ? 'grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-0' : ''} style={{ background: palette.bg }}>
        {/* Produto */}
        <div className="p-5 border-b md:border-b-0 md:border-r" style={{ borderColor: palette.border }}>
          {c.badge && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider mb-2.5" style={{ background: c.primaryColor + '22', color: c.primaryColor }}>
              {c.badge}
            </span>
          )}
          {c.productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.productImage} alt={c.productName} className="w-full aspect-[4/3] object-cover rounded-lg mb-3" />
          ) : (
            <div className="aspect-[4/3] rounded-lg mb-3 flex items-center justify-center text-[10px] font-mono" style={{ background: `linear-gradient(135deg, ${c.primaryColor}22, ${palette.surface})`, border: `1px dashed ${palette.border}`, color: palette.muted }}>
              imagem do produto
            </div>
          )}
          <h2 className="text-[15px] font-semibold tracking-tight leading-tight">{c.productName}</h2>
          <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: palette.muted }}>{c.productDesc}</p>
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${palette.border}` }}>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: palette.subtle }}>Valor</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <div className="text-[22px] font-bold tracking-tight">{fmtBRLdec(c.price)}</div>
              {c.installments > 1 && (
                <div className="text-[11px]" style={{ color: palette.muted }}>
                  ou {c.installments}× de <span className="font-semibold" style={{ color: palette.text }}>{fmtBRLdec(installmentValue)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-5" style={{ background: palette.surface }}>
          <div className="text-[11.5px] font-semibold mb-3 uppercase tracking-wider" style={{ color: palette.subtle }}>Seus dados</div>
          <div className="space-y-2">
            {visibleFields.map((f) => (
              <div key={f.id}>
                <label className="block text-[10.5px] font-medium mb-1" style={{ color: palette.muted }}>
                  {f.label}{f.required && <span style={{ color: c.primaryColor }}> *</span>}
                </label>
                <div className="h-8 px-2.5 rounded-md text-[11px] flex items-center gap-1.5" style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.subtle }}>
                  <f.icon size={11} />
                  {fieldPlaceholder[f.id] ?? '—'}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${palette.border}` }}>
            <div className="text-[11.5px] font-semibold mb-2 uppercase tracking-wider" style={{ color: palette.subtle }}>Forma de pagamento</div>
            <div className="grid grid-cols-3 gap-1.5">
              {methodsList.length === 0 && (
                <div className="col-span-3 text-[10.5px] italic text-center py-3" style={{ color: palette.muted }}>Nenhum método selecionado.</div>
              )}
              {methodsList.map((m, i) => {
                const MIcon = methodIcon[m]
                return (
                  <div
                    key={m}
                    className="flex flex-col items-center gap-1 py-2 rounded-md text-[10px] font-medium"
                    style={{
                      background: i === 0 ? c.primaryColor + '15' : palette.bg,
                      border: `1px solid ${i === 0 ? c.primaryColor : palette.border}`,
                      color: i === 0 ? c.primaryColor : palette.muted,
                    }}
                  >
                    <MIcon size={13} />
                    {methodLabel[m]}
                  </div>
                )
              })}
            </div>
          </div>

          <button
            className="w-full mt-4 h-10 rounded-lg text-[12.5px] font-semibold text-white flex items-center justify-center gap-1.5"
            style={{ background: c.primaryColor }}
          >
            <Lock size={12} />
            Pagar {fmtBRLdec(c.price)}
          </button>
          <div className="text-[9.5px] text-center mt-2" style={{ color: palette.subtle }}>
            🔒 Compra 100% segura · proteção SSL · dados criptografados
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 flex items-center justify-between text-[10px] border-t" style={{ borderColor: palette.border, background: palette.surface, color: palette.subtle }}>
        <span>Processado por {gatewayChoices.find((g) => g.id === c.gateway)?.label ?? c.gateway}</span>
        <span>powered by Umbra Bot</span>
      </div>
    </div>
  )
}

/* ============================================================
   Slug Card
   ============================================================ */

function SlugCard({
  slug, setSlug, appUrl, checkoutId,
}: {
  slug: string; setSlug: (v: string) => void; appUrl: string; checkoutId: string
}) {
  const [copied,      setCopied]    = useState(false)
  const [slugStatus,  setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const publicUrl   = `${appUrl}/c/${slug}`
  const sb          = createClient()

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSlugChange(raw: string) {
    const safe = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60)
    setSlug(safe)
    setSlugStatus('checking')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!safe) { setSlugStatus('idle'); return }
      const { data } = await sb
        .from('checkouts')
        .select('id')
        .eq('slug', safe)
        .neq('id', checkoutId)
        .maybeSingle()
      setSlugStatus(data ? 'taken' : 'ok')
    }, 500)
  }

  const borderColor =
    slugStatus === 'taken' ? 'border-red-500/70' :
    slugStatus === 'ok'    ? 'border-green-500/70' :
    'border-[var(--border)]'

  return (
    <SectionCard title="URL pública do checkout" subtitle="Slug é o caminho público — usuários acessam por este link.">
      <div className={`flex items-center bg-[var(--surface-2)]/40 border rounded-lg overflow-hidden ${borderColor}`}>
        <span className="px-3 text-[12.5px] text-[var(--text-muted)] font-mono whitespace-nowrap">umbra.bot/c/</span>
        <input
          type="text" value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          className="flex-1 h-10 pr-3 bg-transparent text-[13px] font-mono text-[var(--text)] focus:outline-none"
        />
        {slugStatus === 'checking' && <Loader2 size={13} className="mr-2 animate-spin text-[var(--text-muted)]" />}
        {slugStatus === 'ok'       && <Check   size={13} className="mr-2 text-green-500" />}
        {slugStatus === 'taken'    && <AlertTriangle size={13} className="mr-2 text-red-500" />}
        <button
          onClick={copyLink}
          className="h-10 px-3 border-l border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1.5 text-[12px] shrink-0"
          title="Copiar link"
        >
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
      </div>
      {slugStatus === 'taken' && (
        <p className="text-[11.5px] text-red-500 mt-1.5 flex items-center gap-1">
          <AlertTriangle size={11} /> Este slug já está em uso por outro checkout.
        </p>
      )}
    </SectionCard>
  )
}

/* ============================================================
   CheckoutCard
   ============================================================ */

function MiniStatC({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className={`text-[13px] font-semibold tracking-tight leading-none ${tone === 'success' ? 'text-green-500' : 'text-[var(--text)]'}`}>{value}</div>
      <div className="text-[10px] text-[var(--text-muted)] mt-1 leading-tight">{label}</div>
    </div>
  )
}

interface CheckoutFunnel { visited: number; cart: number; paid: number }

function CheckoutCard({ checkout, gatewayChoices, appUrl, onOpen, onDuplicate, onDelete, onArchive, onReactivate }: {
  checkout:       Checkout
  gatewayChoices: GatewayChoice[]
  appUrl:         string
  onOpen:         () => void
  onDuplicate:    () => void
  onDelete:       () => void
  onArchive:      () => void
  onReactivate:   () => void
}) {
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [analyticsOpen,  setAnalyticsOpen]  = useState(false)
  const [funnel,         setFunnel]         = useState<CheckoutFunnel | null>(null)
  const [loadingFunnel,  setLoadingFunnel]  = useState(false)
  const [copied,         setCopied]         = useState(false)
  const st = coStatusMap[checkout.status]
  const gw = gatewayChoices.find((g) => g.id === checkout.gateway)
  const sbCard = createClient()
  const publicUrl = `${appUrl}/c/${checkout.slug}`

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  async function loadFunnel() {
    if (funnel) { setAnalyticsOpen((o) => !o); return }
    setAnalyticsOpen(true)
    setLoadingFunnel(true)
    try {
      const [visitedRes, cartRes, paidRes] = await Promise.all([
        sbCard.from('checkout_events').select('*', { count: 'exact', head: true })
          .eq('checkout_id', checkout.id).eq('event_type', 'visited'),
        sbCard.from('checkout_events').select('*', { count: 'exact', head: true })
          .eq('checkout_id', checkout.id).eq('event_type', 'cart_added'),
        sbCard.from('transactions').select('*', { count: 'exact', head: true })
          .eq('checkout_id', checkout.id).eq('status', 'approved'),
      ])
      setFunnel({
        visited: visitedRes.count ?? 0,
        cart:    cartRes.count   ?? 0,
        paid:    paidRes.count   ?? 0,
      })
    } finally {
      setLoadingFunnel(false)
    }
  }

  function pct(a: number, b: number) {
    return b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—'
  }

  return (
    <div className="group bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--text-muted)]/40 transition-colors relative">
      {/* Context menu button */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--surface)]/90 hover:bg-[var(--surface-2)] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
          title="Ações"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
              <button onClick={() => { setMenuOpen(false); onOpen() }} className="w-full text-left px-3 py-2 text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2 transition-colors">
                <Eye size={13} className="text-[var(--text-muted)]" /> Editar
              </button>
              <button onClick={() => { setMenuOpen(false); onDuplicate() }} className="w-full text-left px-3 py-2 text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2 transition-colors">
                <Copy size={13} className="text-[var(--text-muted)]" /> Duplicar
              </button>
              <button onClick={() => { setMenuOpen(false); copyLink() }} className="w-full text-left px-3 py-2 text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2 transition-colors">
                <Copy size={13} className="text-[var(--text-muted)]" /> {copied ? 'Link copiado!' : 'Copiar link'}
              </button>
              {checkout.status !== 'archived' && (
                <button onClick={() => { setMenuOpen(false); onArchive() }} className="w-full text-left px-3 py-2 text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2 transition-colors">
                  <Archive size={13} className="text-[var(--text-muted)]" /> Arquivar
                </button>
              )}
              {checkout.status === 'archived' && (
                <button onClick={() => { setMenuOpen(false); onReactivate() }} className="w-full text-left px-3 py-2 text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2 transition-colors">
                  <Archive size={13} className="text-[var(--text-muted)]" /> Reativar
                </button>
              )}
              <div className="h-px bg-[var(--border)] my-1" />
              <button onClick={() => { setMenuOpen(false); onDelete() }} className="w-full text-left px-3 py-2 text-[12.5px] text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition-colors">
                <Trash2 size={13} /> Apagar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Miniature */}
      <button
        onClick={onOpen}
        className="block w-full text-left p-3 bg-[var(--surface-2)]/40 border-b border-[var(--border)] focus:outline-none"
        tabIndex={0}
      >
        <CheckoutMiniature checkout={checkout} />
      </button>

      <div className="p-4 cursor-pointer" onClick={onOpen}>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <Badge tone={st.tone}>
            {checkout.status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
            {st.label}
          </Badge>
          <span className="text-[10.5px] text-[var(--text-muted)]">{fmtDate(checkout.updatedAt)}</span>
        </div>
        <h3 className="text-[14.5px] font-semibold text-[var(--text)] leading-snug">{checkout.name}</h3>
        <code className="text-[10.5px] font-mono text-[var(--text-muted)]">umbra.bot/c/{checkout.slug}</code>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-muted)] flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: gw?.color || 'var(--text-muted)' }} />
            {gw?.label || GATEWAY_LABEL[checkout.gateway] || checkout.gateway}
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{fmtBRLdec(checkout.price)}</span>
        </div>
        {checkout.visits > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-[var(--border)]">
            <MiniStatC label="Visitas"    value={fmtNum(checkout.visits)} />
            <MiniStatC label="Conversões" value={fmtNum(checkout.conversions)} />
            <MiniStatC label="Conv."      value={fmtPct(checkout.conversion, 1)} tone={checkout.conversion >= 10 ? 'success' : 'default'} />
          </div>
        )}

        {/* Analytics drill-down */}
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <button
            onClick={(e) => { e.stopPropagation(); loadFunnel() }}
            className="w-full flex items-center justify-between text-[11.5px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <span className="flex items-center gap-1.5"><BarChart2 size={12} /> Funil de conversão</span>
            <ChevronDown size={12} className={`transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
          </button>
          {analyticsOpen && (
            <div className="mt-2">
              {loadingFunnel ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
                </div>
              ) : funnel ? (
                <div className="space-y-1.5">
                  {[
                    { label: 'Visitou',         value: funnel.visited, ref: funnel.visited },
                    { label: 'Adicionou ao carrinho', value: funnel.cart, ref: funnel.visited },
                    { label: 'Comprou',         value: funnel.paid,  ref: funnel.visited },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10.5px] text-[var(--text-muted)]">{row.label}</span>
                        <span className="text-[10.5px] font-medium text-[var(--text)]">
                          {fmtNum(row.value)} <span className="text-[var(--text-muted)] font-normal">({pct(row.value, row.ref)})</span>
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--surface-2)]">
                        <div
                          className="h-1 rounded-full bg-[var(--primary)] transition-all"
                          style={{ width: row.ref > 0 ? `${Math.min(100, (row.value / row.ref) * 100)}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Preview Panel (desktop / mobile toggle)
   ============================================================ */

function PreviewPanel({ draft, gatewayChoices }: { draft: Checkout; gatewayChoices: GatewayChoice[] }) {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Eye size={13} className="text-[var(--text-muted)]" />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Prévia ao vivo</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
        <div className="flex items-center gap-0.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-0.5">
          <button
            onClick={() => setMode('desktop')}
            title="Desktop"
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-medium transition-colors ${mode === 'desktop' ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
          >
            <Monitor size={13} /> Desktop
          </button>
          <button
            onClick={() => setMode('mobile')}
            title="Mobile"
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-medium transition-colors ${mode === 'mobile' ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
          >
            <Smartphone size={13} /> Mobile
          </button>
        </div>
      </div>
      {mode === 'mobile' ? (
        <div className="flex justify-center">
          <div className="w-[375px] border-4 border-[var(--border)] rounded-[32px] overflow-hidden shadow-xl bg-[var(--surface)]">
            <div className="h-5 bg-[var(--surface-2)] flex items-center justify-center">
              <div className="w-16 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '640px' }}>
              <CheckoutPreview checkout={draft} gatewayChoices={gatewayChoices} />
            </div>
          </div>
        </div>
      ) : (
        <CheckoutPreview checkout={draft} gatewayChoices={gatewayChoices} />
      )}
    </div>
  )
}

/* ============================================================
   Checkout Editor
   ============================================================ */

function CheckoutEditor({ checkout, gatewayChoices, pixelChoices, appUrl, userId, onBack, onSave, onPublish, onDelete, showToast }: {
  checkout:       Checkout
  gatewayChoices: GatewayChoice[]
  pixelChoices:   PixelChoice[]
  appUrl:         string
  userId:         string
  onBack:         () => void
  onSave:         (c: Checkout) => Promise<boolean>
  onPublish:      (c: Checkout) => Promise<boolean>
  onDelete:       (id: string) => void
  showToast:      (msg: string, type: 'success' | 'error') => void
}) {
  const [draft, setDraft]             = useState<Checkout>(checkout)
  const [saving, setSaving]           = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)
  const [autoSaveLabel, setAutoSaveLabel] = useState<string | null>(null)
  const sbEditor = createClient()

  const draftRef     = useRef(draft)
  const onSaveRef    = useRef(onSave)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs up to date
  useEffect(() => { draftRef.current = draft },   [draft])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const dirty = JSON.stringify(draft) !== JSON.stringify(checkout)

  function set(patch: Partial<Checkout>) { setDraft((d) => ({ ...d, ...patch })) }
  function setFields(patch: Partial<CheckoutFields>) { setDraft((d) => ({ ...d, fields: { ...d.fields, ...patch } })) }
  function setMethods(patch: Partial<CheckoutMethods>) { setDraft((d) => ({ ...d, methods: { ...d.methods, ...patch } })) }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast('Imagem muito grande. Máximo 2 MB.', 'error')
      e.target.value = ''
      return
    }
    setUploadingImage(true)
    try {
      // Remove imagem anterior para evitar arquivos órfãos quando a extensão muda
      if (draft.productImage) {
        const match = draft.productImage.match(/checkout-images\/([^?]+)/)
        if (match) {
          await sbEditor.storage.from('checkout-images').remove([match[1]])
        }
      }
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${userId}/${draft.id}.${ext}`
      const { error: uploadError } = await sbEditor.storage
        .from('checkout-images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) { showToast('Erro ao enviar imagem.', 'error'); return }
      const { data: { publicUrl } } = sbEditor.storage
        .from('checkout-images')
        .getPublicUrl(path)
      set({ productImage: publicUrl })
      showToast('Imagem enviada!', 'success')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  // Auto-save 30s
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (!dirty || !draft.name.trim()) return

    setAutoSaveLabel('Auto-save em 30s')
    autoSaveTimer.current = setTimeout(async () => {
      const ok = await onSaveRef.current({ ...draftRef.current, updatedAt: Date.now() })
      if (ok) setAutoSaveLabel('Auto-salvo ✓')
      setTimeout(() => setAutoSaveLabel(null), 2000)
    }, 30_000)

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  async function handleSave() {
    if (!draft.name.trim()) { showToast('O nome do checkout não pode estar vazio.', 'error'); return }
    if (draft.successUrl) {
      try { const u = new URL(draft.successUrl); if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error() }
      catch { showToast('URL de redirecionamento inválida. Use http:// ou https://', 'error'); return }
    }
    setSaving(true)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    const updated = { ...draft, updatedAt: Date.now() }
    const ok = await onSave(updated)
    if (ok) {
      setDraft(updated)
      showToast('Rascunho salvo!', 'success')
    } else {
      showToast('Erro ao salvar. Tente novamente.', 'error')
    }
    setSaving(false)
    setAutoSaveLabel(null)
  }

  async function handlePublish() {
    if (!draft.name.trim()) { showToast('O nome do checkout não pode estar vazio.', 'error'); return }
    if (!draft.methods.pix && !draft.methods.card && !draft.methods.boleto) {
      showToast('Selecione pelo menos um método de pagamento.', 'error'); return
    }
    if (draft.successUrl) {
      try { const u = new URL(draft.successUrl); if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error() }
      catch { showToast('URL de redirecionamento inválida. Use http:// ou https://', 'error'); return }
    }
    setSaving(true)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    const updated = { ...draft, status: 'published' as const, updatedAt: Date.now() }
    const ok = await onPublish(updated)
    if (ok) {
      setDraft(updated)
      showToast('Checkout publicado!', 'success')
    } else {
      showToast('Erro ao publicar. Tente novamente.', 'error')
    }
    setSaving(false)
    setAutoSaveLabel(null)
  }

  function handleBack() {
    if (dirty) { setBackConfirmOpen(true) } else { onBack() }
  }

  const st = coStatusMap[draft.status]
  const publicUrl = `${appUrl}/c/${draft.slug}`

  return (
    <>
      <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-7" style={{ minHeight: 'calc(100vh - 64px)' }}>
        {/* Topbar */}
        <div className="h-[60px] bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 h-9 px-2.5 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          >
            <ChevronLeft size={14} />
            Checkouts
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              className="bg-transparent text-[15px] font-semibold text-[var(--text)] focus:outline-none focus:bg-[var(--surface-2)] px-2 py-1 rounded-md min-w-0 max-w-md"
              placeholder="Nome do checkout"
            />
            <Badge tone={st.tone}>{st.label}</Badge>
            <code className="hidden md:inline text-[10.5px] font-mono text-[var(--text-muted)]">umbra.bot/c/{draft.slug}</code>
          </div>
          <div className="flex items-center gap-1.5">
            {autoSaveLabel && (
              <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mr-1">
                <Clock size={11} /> {autoSaveLabel}
              </span>
            )}
            {/* Abrir link público */}
            {draft.status === 'published' ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <ExternalLink size={13} />
                Abrir
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] rounded-lg text-[var(--text-muted)] opacity-40 cursor-not-allowed" title="Publique o checkout para acessar o link">
                <ExternalLink size={13} />
                Abrir
              </span>
            )}
            {/* Apagar */}
            <button
              onClick={() => onDelete(checkout.id)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              title="Apagar checkout"
            >
              <Trash2 size={13} />
            </button>
            {/* Salvar */}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Salvar
            </button>
            {/* Publicar */}
            <button
              onClick={handlePublish}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Rocket size={13} />
              Publicar
            </button>
          </div>
        </div>

        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-7">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_580px] gap-5 items-start">
            {/* Editor column */}
            <div className="space-y-4 min-w-0">
              <SlugCard slug={draft.slug} setSlug={(v) => set({ slug: v })} appUrl={appUrl} checkoutId={draft.id} />

              {/* Identidade */}
              <SectionCard title="Identidade visual" subtitle="Como sua marca aparece no topo do checkout">
                <div className="mt-2 space-y-3.5">
                  <FieldC label="Logo (texto curto)">
                    <input type="text" value={draft.logo} maxLength={4} onChange={(e) => set({ logo: e.target.value.slice(0, 4) })} className={inputCls} />
                    <div className="text-[10.5px] text-[var(--text-muted)] mt-1">Até 4 caracteres — exibido no header do checkout.</div>
                  </FieldC>

                  <FieldC label="Cor primária">
                    <div className="flex items-center gap-2 flex-wrap">
                      {colorPresets.map((pc) => {
                        const active = draft.primaryColor.toLowerCase() === pc.toLowerCase()
                        return (
                          <button key={pc} onClick={() => set({ primaryColor: pc })}
                            className={`relative w-9 h-9 rounded-md border-2 focus:outline-none focus-visible:ring-2 ${active ? 'border-[var(--text)]' : 'border-transparent'}`}
                            style={{ background: pc }}>
                            {active && <Check size={14} className="absolute inset-0 m-auto text-white" />}
                          </button>
                        )
                      })}
                      <div className="flex items-center gap-2 ml-2 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-md px-2 py-1.5">
                        <span className="w-5 h-5 rounded border border-[var(--border)]" style={{ background: draft.primaryColor }} />
                        <input type="text" value={draft.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })}
                          className="w-20 bg-transparent text-[11.5px] font-mono text-[var(--text)] focus:outline-none" />
                      </div>
                    </div>
                  </FieldC>

                  <FieldC label="Tema do fundo">
                    <div className="grid grid-cols-2 gap-2 max-w-[280px]">
                      {([{ id: 'light', label: 'Claro' }, { id: 'dark', label: 'Escuro' }] as const).map((b) => {
                        const active = draft.bgVariant === b.id
                        return (
                          <button key={b.id} onClick={() => set({ bgVariant: b.id })}
                            className={`h-9 rounded-md text-[12px] font-medium border-2 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
                            {b.label}
                          </button>
                        )
                      })}
                    </div>
                  </FieldC>

                  <FieldC label="Tipografia">
                    <div className="flex flex-wrap gap-1.5">
                      {fontPresets.map((f) => {
                        const active = draft.font === f
                        return (
                          <button key={f} onClick={() => set({ font: f })}
                            className={`h-8 px-3 rounded-md text-[12px] border-2 transition-colors focus:outline-none flex items-center gap-1.5 ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
                            style={{ fontFamily: f + ', sans-serif' }}>
                            <Type size={12} />{f}
                          </button>
                        )
                      })}
                    </div>
                  </FieldC>
                </div>
              </SectionCard>

              {/* Produto */}
              <SectionCard title="Produto" subtitle="Conteúdo principal exibido no checkout">
                <div className="mt-2 space-y-3.5">
                  <FieldC label="Nome do produto">
                    <input type="text" value={draft.productName} onChange={(e) => set({ productName: e.target.value })} className={inputCls} />
                  </FieldC>
                  <FieldC label="Descrição curta">
                    <textarea value={draft.productDesc} onChange={(e) => set({ productDesc: e.target.value })} rows={3} className={textareaCls} />
                  </FieldC>

                  <FieldC label="Imagem do produto">
                    {draft.productImage ? (
                      <div className="relative rounded-lg overflow-hidden border border-[var(--border)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draft.productImage} alt="Produto" className="w-full aspect-video object-cover" />
                        <button
                          type="button"
                          onClick={() => set({ productImage: '' })}
                          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                          title="Remover imagem"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center w-full aspect-video rounded-lg border-2 border-dashed cursor-pointer transition-colors group ${uploadingImage ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5'}`}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                        />
                        {uploadingImage ? (
                          <div className="flex flex-col items-center gap-2 text-[var(--primary)]">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-[11.5px] font-medium">Enviando…</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
                            <Upload size={20} />
                            <span className="text-[12px] font-medium">Clique para enviar imagem</span>
                            <span className="text-[11px]">JPG, PNG, WebP · até 2 MB</span>
                          </div>
                        )}
                      </label>
                    )}
                  </FieldC>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldC label="Preço (R$)">
                      <input type="number" step="0.01" min="0" value={draft.price}
                        onChange={(e) => set({ price: parseFloat(e.target.value) || 0 })} className={inputCls} />
                    </FieldC>
                    <FieldC label="Parcelamento máximo">
                      <select value={draft.installments} onChange={(e) => set({ installments: parseInt(e.target.value, 10) })} className={inputCls}>
                        {[1, 2, 3, 6, 10, 12].map((n) => <option key={n} value={n}>Até {n}×</option>)}
                      </select>
                    </FieldC>
                  </div>
                  <FieldC label="Selo (opcional)">
                    <input type="text" value={draft.badge || ''} placeholder="Ex.: Mais escolhido"
                      onChange={(e) => set({ badge: e.target.value })} className={inputCls} />
                  </FieldC>
                </div>
              </SectionCard>

              {/* Pagamento + Pixel */}
              <SectionCard title="Pagamento & rastreamento" subtitle="Integrações do checkout">
                <div className="mt-2 space-y-3.5">
                  <FieldC label="Gateway vinculado">
                    {gatewayChoices.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-[12px] text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle size={14} />
                        Nenhum gateway conectado. <a href="/dashboard/gateways" className="underline">Conectar gateway →</a>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {gatewayChoices.map((g) => {
                          const active = draft.gateway === g.id
                          return (
                            <button key={g.id} onClick={() => set({ gateway: g.id })}
                              className={`h-9 rounded-md text-[12px] font-medium border-2 inline-flex items-center gap-2 px-2.5 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'}`}>
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: g.color }} />
                              <span className={active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>{g.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </FieldC>

                  <FieldC label="Métodos de pagamento">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[{ id: 'pix', label: 'Pix', icon: Zap }, { id: 'card', label: 'Cartão', icon: CreditCard }, { id: 'boleto', label: 'Boleto', icon: FileText }].map((m) => {
                        const active = draft.methods[m.id as keyof CheckoutMethods]
                        return (
                          <button key={m.id} onClick={() => setMethods({ [m.id]: !active })}
                            className={`h-10 rounded-md text-[12px] font-medium border-2 inline-flex flex-col items-center justify-center gap-0.5 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
                            <m.icon size={14} />{m.label}
                          </button>
                        )
                      })}
                    </div>
                  </FieldC>

                  <FieldC label="Pixel de rastreamento">
                    <select value={draft.pixel} onChange={(e) => set({ pixel: e.target.value })} className={inputCls}>
                      {pixelChoices.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </FieldC>
                </div>
              </SectionCard>

              {/* Campos */}
              <SectionCard title="Campos do comprador" subtitle="Dados solicitados no formulário">
                <div className="mt-2 space-y-1.5">
                  {allFields.map((f) => (
                    <label key={f.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${f.always ? 'opacity-60' : 'hover:bg-[var(--surface-2)]/50 cursor-pointer'}`}>
                      <Toggle checked={!!draft.fields[f.id]} onChange={() => { if (!f.always) setFields({ [f.id]: !draft.fields[f.id] }) }} />
                      <f.icon size={13} className="text-[var(--text-muted)] shrink-0" />
                      <span className="text-[12.5px] text-[var(--text)] flex-1">{f.label}</span>
                      {f.always && <Badge tone="muted">Obrigatório</Badge>}
                    </label>
                  ))}
                </div>
              </SectionCard>

              {/* Layout */}
              <SectionCard title="Layout" subtitle="Como produto e formulário se organizam">
                <div className="mt-2 grid grid-cols-2 gap-2 max-w-[400px]">
                  {[
                    { id: 'two_col', label: 'Duas colunas', desc: 'Produto à esquerda, formulário à direita.' },
                    { id: 'one_col', label: 'Uma coluna',   desc: 'Produto e formulário empilhados.' },
                  ].map((l) => {
                    const active = draft.layout === l.id
                    return (
                      <button key={l.id} onClick={() => set({ layout: l.id as Checkout['layout'] })}
                        className={`text-left p-3 rounded-lg border-2 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'}`}>
                        <div className="text-[12.5px] font-medium text-[var(--text)]">{l.label}</div>
                        <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 leading-snug">{l.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </SectionCard>

              {/* Configurações avançadas */}
              <SectionCard title="Configurações avançadas" subtitle="Redirecionamento, garantia e urgência">
                <div className="mt-2 space-y-3.5">
                  <FieldC label="URL de redirecionamento (após pagamento)" hint="Onde o comprador será enviado ao confirmar o Pix. Deixe vazio para usar a tela de sucesso padrão.">
                    <input
                      type="url"
                      value={draft.successUrl}
                      onChange={(e) => set({ successUrl: e.target.value })}
                      placeholder="https://seu-site.com/obrigado"
                      className={inputCls}
                    />
                  </FieldC>
                  <FieldC label="Dias de garantia" hint="Exibe um badge de garantia no checkout. Deixe 0 ou vazio para não exibir.">
                    <div className="flex items-center gap-2 max-w-[180px]">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        step="1"
                        value={draft.guaranteeDays ?? ''}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10)
                          set({ guaranteeDays: isNaN(v) || v <= 0 ? null : v })
                        }}
                        placeholder="0"
                        className={inputCls}
                      />
                      <span className="text-[12.5px] text-[var(--text-muted)] whitespace-nowrap">dias</span>
                    </div>
                    {draft.guaranteeDays && draft.guaranteeDays > 0 && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-[11.5px] text-green-600 dark:text-green-400">
                        <Shield size={12} /> Garantia de {draft.guaranteeDays} dias · sem burocracia
                      </div>
                    )}
                  </FieldC>
                  <FieldC label="Fim do contador de urgência" hint="Exibe um countdown regressivo no checkout. Deixe vazio para não exibir.">
                    <input
                      type="datetime-local"
                      value={draft.countdownEnd ? draft.countdownEnd.slice(0, 16) : ''}
                      onChange={(e) => set({ countdownEnd: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className={inputCls}
                    />
                    {draft.countdownEnd && new Date(draft.countdownEnd) > new Date() && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-[11.5px] text-orange-600 dark:text-orange-400">
                        <Clock size={12} /> Countdown ativo até {new Date(draft.countdownEnd).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </FieldC>
                </div>
              </SectionCard>
            </div>

            {/* Preview column (sticky) */}
            <div className="xl:sticky xl:top-[80px]">
              <PreviewPanel draft={draft} gatewayChoices={gatewayChoices} /></div>
          </div>
        </div>
      </div>

      {/* Unsaved changes modal */}
      {backConfirmOpen && (
        <BackConfirmModal
          onConfirm={onBack}
          onClose={() => setBackConfirmOpen(false)}
        />
      )}
    </>
  )
}

/* ============================================================
   CheckoutsList
   ============================================================ */

function CheckoutsList({ checkouts, creating, gatewayChoices, appUrl, onOpen, onCreate, onDuplicate, onDelete, onArchive, onReactivate, onOpenTemplates }: {
  checkouts:       Checkout[]
  creating:        boolean
  gatewayChoices:  GatewayChoice[]
  appUrl:          string
  onOpen:          (id: string) => void
  onCreate:        () => void
  onDuplicate:     (id: string) => void
  onDelete:        (id: string) => void
  onArchive:       (id: string) => void
  onReactivate:    (id: string) => void
  onOpenTemplates: () => void
}) {
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('Todos')

  const filtered = useMemo(() => checkouts.filter((c) => {
    const q = search.trim().toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !c.slug.includes(q)) return false
    if (statusF === 'Publicados' && c.status !== 'published') return false
    if (statusF === 'Rascunhos'  && c.status !== 'draft')     return false
    if (statusF === 'Arquivados' && c.status !== 'archived')  return false
    return true
  }), [checkouts, search, statusF])

  const statusOptions = ['Todos', 'Publicados', 'Rascunhos', 'Arquivados']
  const published     = checkouts.filter((c) => c.status === 'published').length

  return (
    <>
      <PageHeader
        title="Checkout"
        subtitle={`Páginas de pagamento personalizadas — ${checkouts.length} checkout${checkouts.length !== 1 ? 's' : ''} · ${published} publicado${published !== 1 ? 's' : ''}.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenTemplates}
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Layers size={14} />
              Templates
            </button>
            <button
              onClick={onCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
              Criar checkout
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            className="w-full h-9 pl-9 pr-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[12.5px] placeholder:text-[var(--text-muted)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
          />
        </div>
        <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
          {statusOptions.map((s) => (
            <button key={s} onClick={() => setStatusF(s)}
              className={`h-7 px-3 text-[11.5px] font-medium rounded-md transition-colors ${statusF === s ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {checkouts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-4">
            <Layers size={28} className="text-[var(--primary)]" />
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--text)]">Nenhum checkout ainda</h3>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-[300px] leading-snug">Crie sua primeira página de pagamento personalizada.</p>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={onOpenTemplates} className="h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors inline-flex items-center gap-2">
              <Layers size={14} /> Usar template
            </button>
            <button onClick={onCreate} className="h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity inline-flex items-center gap-2">
              <Plus size={14} /> Criar do zero
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {checkouts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((c) => (
            <CheckoutCard
              key={c.id}
              checkout={c}
              gatewayChoices={gatewayChoices}
              appUrl={appUrl}
              onOpen={() => onOpen(c.id)}
              onDuplicate={() => onDuplicate(c.id)}
              onDelete={() => onDelete(c.id)}
              onArchive={() => onArchive(c.id)}
              onReactivate={() => onReactivate(c.id)}
            />
          ))}
          <button
            onClick={onCreate}
            disabled={creating}
            className="group min-h-[260px] bg-[var(--surface-2)]/30 border border-dashed border-[var(--border)] rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors focus:outline-none disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] flex items-center justify-center mb-3 group-hover:border-[var(--primary)] group-hover:text-[var(--primary)] transition-colors">
              {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            </div>
            <div className="text-[13px] font-semibold text-[var(--text)]">Criar novo checkout</div>
            <div className="text-[11.5px] text-[var(--text-muted)] mt-1 max-w-[220px] leading-snug">Comece do zero ou use um template.</div>
          </button>
        </div>
      )}
    </>
  )
}

/* ============================================================
   CheckoutClient — export default
   ============================================================ */

export default function CheckoutClient({
  initialCheckouts, userId, connectedGateways, configuredPixels, appUrl,
}: CheckoutClientProps) {
  const sb     = createClient()
  const { track } = useAnalytics()

  const [checkouts,     setCheckouts]     = useState<Checkout[]>(initialCheckouts.map(mapRaw))
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [deleteId,      setDeleteId]      = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  /* ── Gateway/pixel choices from DB ─────────────────────── */
  const gatewayChoices: GatewayChoice[] = useMemo(() => {
    const connected = connectedGateways.map((g) => ({
      id:    g.provider,
      label: GATEWAY_LABEL[g.provider] ?? g.provider,
      color: GATEWAY_COLOR[g.provider] ?? 'var(--primary)',
    }))
    return connected.length > 0 ? connected : STATIC_GATEWAY_CHOICES
  }, [connectedGateways])

  const pixelChoices: PixelChoice[] = useMemo(() => {
    const configured = configuredPixels
      .filter((p) => p.pixel_id)
      .map((p) => ({ id: p.provider, label: PIXEL_LABEL[p.provider] ?? p.provider }))
    return [...configured, { id: 'none', label: 'Sem pixel' }]
  }, [configuredPixels])

  /* ── Toast helper ──────────────────────────────────────── */
  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  /* ── Realtime ──────────────────────────────────────────── */
  useEffect(() => {
    const channel = sb
      .channel('checkouts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkouts', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as RawCheckout
            setCheckouts((prev) => prev.map((c) => c.id === row.id ? mapRaw(row) : c))
          }
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setCheckouts((prev) => prev.filter((c) => c.id !== old.id))
          }
        },
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── CRUD ──────────────────────────────────────────────── */

  async function createCheckout(template?: CheckoutTemplate) {
    setCreating(true)
    setShowTemplates(false)
    try {
      const id   = crypto.randomUUID()
      const slug = 'checkout-' + id.slice(0, 8)

      const payload = {
        id,
        user_id:       userId,
        name:          template?.name          ?? 'Novo checkout',
        slug,
        product_name:  template?.productName   ?? 'Nome do produto',
        product_desc:  template?.productDesc   ?? 'Descrição curta do produto.',
        price:         template?.price         ?? 100,
        installments:  template?.installments  ?? 6,
        gateway:       connectedGateways[0]?.provider ?? 'pushinpay',
        pixel:         configuredPixels.find((p) => p.pixel_id)?.provider ?? 'none',
        primary_color: template?.primaryColor  ?? '#7c3aed',
        bg_variant:    template?.bgVariant     ?? 'light',
        font:          template?.font          ?? 'Inter',
        logo:          template?.logo          ?? id.slice(0, 2).toUpperCase(),
        badge:         template?.badge         ?? null,
        fields:        template?.fields        ?? { name: true, email: true, cpf: false, phone: false, address: false, cep: false },
        methods:       template?.methods       ?? { pix: true, card: true, boleto: false },
        layout:        template?.layout        ?? 'two_col',
        product_image:  null,
        status:         'draft',
        visits:         0,
        conversions:    0,
        conversion:     0,
        success_url:    null,
        guarantee_days: null,
        countdown_end:  null,
      }

      const { data, error } = await sb
        .from('checkouts')
        .insert(payload)
        .select('*')
        .single()

      if (error) { showToast('Erro ao criar checkout.', 'error'); return }

      const newC = mapRaw(data as RawCheckout)
      setCheckouts((prev) => [newC, ...prev])
      setEditingId(id)
      track('checkout_created', { layout: payload.layout, gateway: payload.gateway })
    } finally {
      setCreating(false)
    }
  }

  const saveCheckout = useCallback(async (updated: Checkout): Promise<boolean> => {
    const snapshot = checkouts.find((c) => c.id === updated.id)
    setCheckouts((prev) => prev.map((c) => c.id === updated.id ? updated : c))

    const { error } = await sb
      .from('checkouts')
      .update({
        name:          updated.name,
        slug:          updated.slug,
        product_name:  updated.productName,
        product_desc:  updated.productDesc,
        product_image: updated.productImage || null,
        price:         updated.price,
        installments:  updated.installments,
        gateway:       updated.gateway,
        pixel:         updated.pixel,
        primary_color: updated.primaryColor,
        bg_variant:    updated.bgVariant,
        font:          updated.font,
        logo:          updated.logo,
        badge:         updated.badge ?? null,
        fields:        updated.fields,
        methods:       updated.methods,
        layout:        updated.layout,
        status:        updated.status,
        success_url:    updated.successUrl    || null,
        guarantee_days: updated.guaranteeDays ?? null,
        countdown_end:  updated.countdownEnd  || null,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', updated.id)
      .eq('user_id', userId)   // IDOR duplo: código + RLS

    if (error) {
      if (snapshot) setCheckouts((prev) => prev.map((c) => c.id === updated.id ? snapshot : c))
      return false
    }
    return true
  }, [checkouts, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const publishCheckout = useCallback(async (updated: Checkout): Promise<boolean> => {
    const toPublish = { ...updated, status: 'published' as const, updatedAt: Date.now() }
    const ok        = await saveCheckout(toPublish)
    if (ok) track('checkout_published', { slug: toPublish.slug, price: toPublish.price })
    return ok
  }, [saveCheckout, track])

  async function archiveCheckout(id: string) {
    const c = checkouts.find((co) => co.id === id)
    if (!c) return
    const updated = { ...c, status: 'archived' as const, updatedAt: Date.now() }
    const ok = await saveCheckout(updated)
    if (ok) showToast('Checkout arquivado.', 'success')
    else    showToast('Erro ao arquivar.', 'error')
  }

  async function reactivateCheckout(id: string) {
    const c = checkouts.find((co) => co.id === id)
    if (!c) return
    const updated = { ...c, status: 'draft' as const, updatedAt: Date.now() }
    const ok = await saveCheckout(updated)
    if (ok) showToast('Checkout reativado como rascunho.', 'success')
    else    showToast('Erro ao reativar.', 'error')
  }

  async function deleteCheckout(id: string) {
    const c = checkouts.find((co) => co.id === id)
    setCheckouts((prev) => prev.filter((co) => co.id !== id))
    setDeleteId(null)

    // Remove imagem do Storage antes de apagar o checkout
    if (c?.productImage) {
      const match = c.productImage.match(/checkout-images\/([^?]+)/)
      if (match) {
        sb.storage.from('checkout-images').remove([match[1]]).catch(() => {})
      }
    }

    const { error } = await sb
      .from('checkouts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      if (c) setCheckouts((prev) => [c, ...prev])
      showToast('Erro ao apagar checkout.', 'error')
      return
    }

    track('checkout_deleted', { status: c?.status ?? 'unknown' })
    if (editingId === id) setEditingId(null)
    showToast('Checkout apagado.', 'success')
  }

  async function duplicateCheckout(id: string) {
    const original = checkouts.find((c) => c.id === id)
    if (!original) return

    const newId   = crypto.randomUUID()
    const newSlug = original.slug + '-copia-' + newId.slice(0, 4)

    const { data, error } = await sb
      .from('checkouts')
      .insert({
        id:            newId,
        user_id:       userId,
        name:          original.name + ' (cópia)',
        slug:          newSlug,
        product_name:  original.productName,
        product_desc:  original.productDesc,
        price:         original.price,
        installments:  original.installments,
        gateway:       original.gateway,
        pixel:         original.pixel,
        primary_color: original.primaryColor,
        bg_variant:    original.bgVariant,
        font:          original.font,
        logo:          original.logo,
        badge:         original.badge ?? null,
        fields:        original.fields,
        methods:       original.methods,
        layout:        original.layout,
        product_image:  original.productImage || null,
        status:         'draft',
        visits:         0,
        conversions:    0,
        conversion:     0,
        success_url:    original.successUrl    || null,
        guarantee_days: original.guaranteeDays ?? null,
        countdown_end:  original.countdownEnd  || null,
      })
      .select('*')
      .single()

    if (error) { showToast('Erro ao duplicar checkout.', 'error'); return }

    const copy = mapRaw(data as RawCheckout)
    setCheckouts((prev) => [copy, ...prev])
    track('checkout_duplicated', {})
    showToast('Checkout duplicado com sucesso.', 'success')
  }

  /* ── Render ────────────────────────────────────────────── */

  const editing = checkouts.find((c) => c.id === editingId) ?? null

  return (
    <DashboardLayout>
      {editing ? (
        <CheckoutEditor
          checkout={editing}
          gatewayChoices={gatewayChoices}
          pixelChoices={pixelChoices}
          appUrl={appUrl}
          userId={userId}
          onBack={() => setEditingId(null)}
          onSave={saveCheckout}
          onPublish={publishCheckout}
          onDelete={(id) => setDeleteId(id)}
          showToast={showToast}
        />
      ) : (
        <CheckoutsList
          checkouts={checkouts}
          creating={creating}
          gatewayChoices={gatewayChoices}
          appUrl={appUrl}
          onOpen={setEditingId}
          onCreate={() => createCheckout()}
          onDuplicate={duplicateCheckout}
          onDelete={(id) => setDeleteId(id)}
          onArchive={archiveCheckout}
          onReactivate={reactivateCheckout}
          onOpenTemplates={() => setShowTemplates(true)}
        />
      )}

      {/* Modais globais */}
      {showTemplates && (
        <TemplatesModal
          onClose={() => setShowTemplates(false)}
          onCreate={createCheckout}
        />
      )}
      {deleteId && (
        <DeleteModal
          name={checkouts.find((c) => c.id === deleteId)?.name ?? ''}
          onConfirm={() => deleteCheckout(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </DashboardLayout>
  )
}
