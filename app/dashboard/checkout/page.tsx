'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, ChevronLeft, Eye, Save, Rocket, ExternalLink,
  Lock, Zap, CreditCard, FileText, Check, X, User, Mail,
  BadgeCheck, Phone, MapPin, Type,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

interface CheckoutFields { name: boolean; email: boolean; cpf: boolean; phone: boolean; address: boolean; cep: boolean }
interface CheckoutMethods { pix: boolean; card: boolean; boleto: boolean }

interface Checkout {
  id: string; name: string; slug: string; productName: string; productDesc: string
  productImage: string; price: number; installments: number
  gateway: string; pixel: string; primaryColor: string; bgVariant: 'light' | 'dark'
  font: string; logo: string; badge?: string
  fields: CheckoutFields
  methods: CheckoutMethods
  layout: 'two_col' | 'one_col'; status: 'published' | 'draft' | 'archived'
  visits: number; conversions: number; conversion: number; updatedAt: number
}

interface GatewayChoice { id: string; label: string; color: string }
interface PixelChoice   { id: string; label: string }
interface FieldDef      { id: keyof CheckoutFields; label: string; icon: React.ElementType; required: boolean; always: boolean }

/* ============================================================
   Constants / mock data
   ============================================================ */

const NOW_C = new Date('2026-05-18T15:30:00').getTime()

const gatewayChoices: GatewayChoice[] = [
  { id: 'pushinpay',   label: 'Pushinpay',    color: 'oklch(0.65 0.18 145)' },
  { id: 'mercadopago', label: 'Mercado Pago', color: 'oklch(0.62 0.16 240)' },
  { id: 'pagarme',     label: 'Pagar.me',     color: 'oklch(0.55 0.20 285)' },
  { id: 'stripe',      label: 'Stripe',       color: 'oklch(0.62 0.16 290)' },
]

const pixelChoices: PixelChoice[] = [
  { id: 'meta',   label: 'Meta Pixel'       },
  { id: 'tiktok', label: 'TikTok Pixel'     },
  { id: 'google', label: 'Google Tag (GA4)' },
  { id: 'none',   label: 'Sem pixel'        },
]

const colorPresets = ['#7c3aed', '#22c55e', '#0ea5e9', '#f97316', '#ec4899', '#0f172a']
const fontPresets  = ['Inter', 'Manrope', 'DM Sans', 'Plus Jakarta Sans']

const allFields: FieldDef[] = [
  { id: 'name',    label: 'Nome completo', icon: User,       required: true,  always: true  },
  { id: 'email',   label: 'E-mail',        icon: Mail,       required: true,  always: true  },
  { id: 'cpf',     label: 'CPF',           icon: BadgeCheck, required: false, always: false },
  { id: 'phone',   label: 'Telefone',      icon: Phone,      required: false, always: false },
  { id: 'address', label: 'Endereço',      icon: MapPin,     required: false, always: false },
  { id: 'cep',     label: 'CEP',           icon: MapPin,     required: false, always: false },
]

const coStatusMap: Record<string, { label: string; tone: string }> = {
  published: { label: 'Publicado', tone: 'success' },
  draft:     { label: 'Rascunho',  tone: 'muted'   },
  archived:  { label: 'Arquivado', tone: 'muted'   },
}

const MOCK_CHECKOUTS: Checkout[] = [
  {
    id: 'co_001', name: 'Mentoria VIP Anual', slug: 'mentoria-vip',
    productName: 'Mentoria Premium Anual',
    productDesc: 'Acesso completo por 12 meses ao programa premium. Mentor dedicado, encontros semanais, comunidade VIP e materiais exclusivos.',
    productImage: 'umbra-product-01', price: 1297.00, installments: 12,
    gateway: 'pushinpay', pixel: 'meta', primaryColor: '#7c3aed', bgVariant: 'light', font: 'Inter', logo: 'MV', badge: 'Mais escolhido',
    fields: { name: true, email: true, cpf: true, phone: true, address: false, cep: false },
    methods: { pix: true, card: true, boleto: false },
    layout: 'two_col', status: 'published', visits: 2840, conversions: 487, conversion: 17.1,
    updatedAt: NOW_C - 2 * 24 * 3600 * 1000,
  },
  {
    id: 'co_002', name: 'Curso 90 dias', slug: 'curso-90',
    productName: 'Curso Intensivo 90 dias',
    productDesc: 'Transforme sua rotina em 90 dias. Aulas semanais ao vivo + 60 h de conteúdo gravado + grupo de WhatsApp.',
    productImage: 'umbra-product-02', price: 147.00, installments: 6,
    gateway: 'mercadopago', pixel: 'meta', primaryColor: '#0ea5e9', bgVariant: 'light', font: 'Manrope', logo: 'C9',
    fields: { name: true, email: true, cpf: true, phone: false, address: false, cep: false },
    methods: { pix: true, card: true, boleto: true },
    layout: 'two_col', status: 'published', visits: 1840, conversions: 312, conversion: 16.9,
    updatedAt: NOW_C - 5 * 24 * 3600 * 1000,
  },
  {
    id: 'co_003', name: 'Templates Pro', slug: 'templates-pro',
    productName: 'Pack Templates Pro',
    productDesc: '120 templates prontos para uso em campanhas e funis. Atualização mensal grátis.',
    productImage: 'umbra-product-03', price: 70.00, installments: 3,
    gateway: 'pushinpay', pixel: 'tiktok', primaryColor: '#f97316', bgVariant: 'light', font: 'DM Sans', logo: 'TP',
    fields: { name: true, email: true, cpf: false, phone: false, address: false, cep: false },
    methods: { pix: true, card: false, boleto: false },
    layout: 'one_col', status: 'published', visits: 4218, conversions: 412, conversion: 9.8,
    updatedAt: NOW_C - 8 * 24 * 3600 * 1000,
  },
  {
    id: 'co_004', name: 'Black Friday 2025', slug: 'bf-2025',
    productName: 'Combo Black 2025',
    productDesc: 'Mentoria + Curso + Pack em condições especiais Black Friday.',
    productImage: 'umbra-product-04', price: 1497.00, installments: 12,
    gateway: 'pushinpay', pixel: 'meta', primaryColor: '#0f172a', bgVariant: 'dark', font: 'Plus Jakarta Sans', logo: 'BF', badge: 'Black Friday',
    fields: { name: true, email: true, cpf: true, phone: true, address: false, cep: false },
    methods: { pix: true, card: true, boleto: false },
    layout: 'two_col', status: 'archived', visits: 8420, conversions: 1148, conversion: 13.6,
    updatedAt: NOW_C - 90 * 24 * 3600 * 1000,
  },
  {
    id: 'co_005', name: 'Consultoria 1:1 — rascunho', slug: 'consultoria',
    productName: 'Consultoria Individual',
    productDesc: 'Sessão estratégica individual de 90 minutos com diagnóstico completo e plano de ação.',
    productImage: 'umbra-product-05', price: 675.00, installments: 6,
    gateway: 'stripe', pixel: 'none', primaryColor: '#ec4899', bgVariant: 'light', font: 'Inter', logo: 'C1',
    fields: { name: true, email: true, cpf: false, phone: false, address: false, cep: false },
    methods: { pix: false, card: true, boleto: false },
    layout: 'one_col', status: 'draft', visits: 0, conversions: 0, conversion: 0,
    updatedAt: NOW_C - 5 * 3600 * 1000,
  },
]

/* ============================================================
   Helpers
   ============================================================ */

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
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
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
   Checkout Miniature (thumbnail)
   ============================================================ */

function CheckoutMiniature({ checkout }: { checkout: Checkout }) {
  const c = checkout
  const isDark = c.bgVariant === 'dark'
  return (
    <div
      className="rounded-md overflow-hidden border border-[var(--border)] pointer-events-none select-none"
      style={{
        background: isDark ? '#0f172a' : '#fafbfc',
        fontFamily: c.font + ', sans-serif',
        color: isDark ? '#e5e7eb' : '#0f172a',
      }}
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
          <div className="h-1 rounded-sm w-1/2" style={{ background: isDark ? '#334155' : '#cbd5e1' }} />
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

function CheckoutPreview({ checkout }: { checkout: Checkout }) {
  const c = checkout
  const isDark = c.bgVariant === 'dark'
  const visibleFields = allFields.filter((f) => c.fields[f.id])
  const methodsList = (['pix', 'card', 'boleto'] as const).filter((m) => c.methods[m])
  const installmentValue = c.price / Math.min(c.installments, 12)

  const palette = isDark ? {
    bg: '#0b1220', surface: '#0f1b2d', text: '#e5e7eb', muted: '#94a3b8', border: '#1e293b', subtle: '#64748b',
  } : {
    bg: '#f6f7f9', surface: '#ffffff', text: '#0f172a', muted: '#475569', border: '#e2e8f0', subtle: '#94a3b8',
  }

  const methodIcon: Record<string, React.ElementType> = { pix: Zap, card: CreditCard, boleto: FileText }
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
          <Lock size={10} />
          Pagamento seguro
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
          <div className="aspect-[4/3] rounded-lg mb-3 flex items-center justify-center text-[10px] font-mono" style={{ background: `linear-gradient(135deg, ${c.primaryColor}22, ${palette.surface})`, border: `1px dashed ${palette.border}`, color: palette.muted }}>
            imagem do produto
          </div>
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
        <span>Processado por {gatewayChoices.find((g) => g.id === c.gateway)?.label}</span>
        <span>powered by Umbra Bot</span>
      </div>
    </div>
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

function CheckoutCard({ checkout, onOpen }: { checkout: Checkout; onOpen: () => void }) {
  const st  = coStatusMap[checkout.status]
  const gw  = gatewayChoices.find((g) => g.id === checkout.gateway)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--text-muted)]/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
    >
      <div className="p-3 bg-[var(--surface-2)]/40 border-b border-[var(--border)]">
        <CheckoutMiniature checkout={checkout} />
      </div>
      <div className="p-4">
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
            {gw?.label || checkout.gateway}
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
      </div>
    </div>
  )
}

/* ============================================================
   Slug Card
   ============================================================ */

function SlugCard({ slug, setSlug }: { slug: string; setSlug: (v: string) => void }) {
  return (
    <SectionCard title="URL pública do checkout" subtitle="Slug é o caminho público — usuários acessam por este link.">
      <div className="flex items-center bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg overflow-hidden">
        <span className="px-3 text-[12.5px] text-[var(--text-muted)] font-mono">umbra.bot/c/</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
          className="flex-1 h-10 pr-3 bg-transparent text-[13px] font-mono text-[var(--text)] focus:outline-none"
        />
      </div>
    </SectionCard>
  )
}

/* ============================================================
   Checkout Editor
   ============================================================ */

function CheckoutEditor({ checkout, onBack, onSave, onPublish }: {
  checkout: Checkout; onBack: () => void; onSave: (c: Checkout) => void; onPublish: (c: Checkout) => void
}) {
  const [draft, setDraft] = useState<Checkout>(checkout)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(checkout)

  function set(patch: Partial<Checkout>) { setDraft((d) => ({ ...d, ...patch })); setSaved(false) }
  function setFields(patch: Partial<CheckoutFields>) { setDraft((d) => ({ ...d, fields: { ...d.fields, ...patch } })) }
  function setMethods(patch: Partial<CheckoutMethods>) { setDraft((d) => ({ ...d, methods: { ...d.methods, ...patch } })) }

  function save() { onSave({ ...draft, updatedAt: Date.now() }); setSaved(true); setTimeout(() => setSaved(false), 2200) }
  function publish() { onPublish({ ...draft, status: 'published', updatedAt: Date.now() }); setSaved(true); setTimeout(() => setSaved(false), 2200) }

  const st = coStatusMap[draft.status]

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-7" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Topbar */}
      <div className="h-[60px] bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
        <button
          onClick={onBack}
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
          />
          <Badge tone={st.tone}>{st.label}</Badge>
          <code className="hidden md:inline text-[10.5px] font-mono text-[var(--text-muted)]">umbra.bot/c/{draft.slug}</code>
        </div>
        <div className="flex items-center gap-1.5">
          {saved && (
            <span className="text-[11.5px] text-green-500 flex items-center gap-1 mr-1">
              <Check size={12} /> Salvo
            </span>
          )}
          <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
            <ExternalLink size={13} />
            Abrir
          </button>
          <button
            onClick={save}
            disabled={!dirty}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={13} />
            Salvar
          </button>
          <button
            onClick={publish}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
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
            <SlugCard slug={draft.slug} setSlug={(v) => set({ slug: v })} />

            {/* Identidade */}
            <SectionCard title="Identidade visual" subtitle="Como sua marca aparece no topo do checkout">
              <div className="mt-2 space-y-3.5">
                <FieldC label="Logo (texto curto)">
                  <input
                    type="text" value={draft.logo} maxLength={4}
                    onChange={(e) => set({ logo: e.target.value.slice(0, 4) })}
                    className={inputCls}
                  />
                  <div className="text-[10.5px] text-[var(--text-muted)] mt-1">Até 4 caracteres — exibido no header do checkout.</div>
                </FieldC>

                <FieldC label="Cor primária">
                  <div className="flex items-center gap-2 flex-wrap">
                    {colorPresets.map((c) => {
                      const active = draft.primaryColor.toLowerCase() === c.toLowerCase()
                      return (
                        <button
                          key={c}
                          onClick={() => set({ primaryColor: c })}
                          className={`relative w-9 h-9 rounded-md border-2 focus:outline-none focus-visible:ring-2 ${active ? 'border-[var(--text)]' : 'border-transparent'}`}
                          style={{ background: c }}
                        >
                          {active && <Check size={14} className="absolute inset-0 m-auto text-white" />}
                        </button>
                      )
                    })}
                    <div className="flex items-center gap-2 ml-2 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-md px-2 py-1.5">
                      <span className="w-5 h-5 rounded border border-[var(--border)]" style={{ background: draft.primaryColor }} />
                      <input
                        type="text" value={draft.primaryColor}
                        onChange={(e) => set({ primaryColor: e.target.value })}
                        className="w-20 bg-transparent text-[11.5px] font-mono text-[var(--text)] focus:outline-none"
                      />
                    </div>
                  </div>
                </FieldC>

                <FieldC label="Tema do fundo">
                  <div className="grid grid-cols-2 gap-2 max-w-[280px]">
                    {([{ id: 'light', label: 'Claro' }, { id: 'dark', label: 'Escuro' }] as const).map((b) => {
                      const active = draft.bgVariant === b.id
                      return (
                        <button
                          key={b.id}
                          onClick={() => set({ bgVariant: b.id })}
                          className={`h-9 rounded-md text-[12px] font-medium border-2 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
                        >
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
                        <button
                          key={f}
                          onClick={() => set({ font: f })}
                          className={`h-8 px-3 rounded-md text-[12px] border-2 transition-colors focus:outline-none flex items-center gap-1.5 ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
                          style={{ fontFamily: f + ', sans-serif' }}
                        >
                          <Type size={12} />
                          {f}
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
                <div className="grid grid-cols-2 gap-3">
                  <FieldC label="Preço (R$)">
                    <input
                      type="number" step="0.01" min="0"
                      value={draft.price}
                      onChange={(e) => set({ price: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </FieldC>
                  <FieldC label="Parcelamento máximo">
                    <select
                      value={draft.installments}
                      onChange={(e) => set({ installments: parseInt(e.target.value, 10) })}
                      className={inputCls}
                    >
                      {[1, 2, 3, 6, 10, 12].map((n) => <option key={n} value={n}>Até {n}×</option>)}
                    </select>
                  </FieldC>
                </div>
                <FieldC label="Selo (opcional)">
                  <input
                    type="text" value={draft.badge || ''} placeholder="Ex.: Mais escolhido"
                    onChange={(e) => set({ badge: e.target.value })}
                    className={inputCls}
                  />
                </FieldC>
              </div>
            </SectionCard>

            {/* Pagamento + Pixel */}
            <SectionCard title="Pagamento & rastreamento" subtitle="Integrações do checkout">
              <div className="mt-2 space-y-3.5">
                <FieldC label="Gateway vinculado">
                  <div className="grid grid-cols-2 gap-1.5">
                    {gatewayChoices.map((g) => {
                      const active = draft.gateway === g.id
                      return (
                        <button
                          key={g.id}
                          onClick={() => set({ gateway: g.id })}
                          className={`h-9 rounded-md text-[12px] font-medium border-2 inline-flex items-center gap-2 px-2.5 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: g.color }} />
                          <span className={active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>{g.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </FieldC>

                <FieldC label="Métodos de pagamento">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'pix',    label: 'Pix',    icon: Zap },
                      { id: 'card',   label: 'Cartão', icon: CreditCard },
                      { id: 'boleto', label: 'Boleto', icon: FileText },
                    ].map((m) => {
                      const active = draft.methods[m.id as keyof CheckoutMethods]
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMethods({ [m.id]: !active })}
                          className={`h-10 rounded-md text-[12px] font-medium border-2 inline-flex flex-col items-center justify-center gap-0.5 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
                        >
                          <m.icon size={14} />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </FieldC>

                <FieldC label="Pixel de rastreamento">
                  <select
                    value={draft.pixel}
                    onChange={(e) => set({ pixel: e.target.value })}
                    className={inputCls}
                  >
                    {pixelChoices.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </FieldC>
              </div>
            </SectionCard>

            {/* Campos do comprador */}
            <SectionCard title="Campos do comprador" subtitle="Dados solicitados no formulário">
              <div className="mt-2 space-y-1.5">
                {allFields.map((f) => (
                  <label key={f.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${f.always ? 'opacity-60' : 'hover:bg-[var(--surface-2)]/50 cursor-pointer'}`}>
                    <Toggle
                      checked={!!draft.fields[f.id]}
                      onChange={() => { if (!f.always) setFields({ [f.id]: !draft.fields[f.id] }) }}
                    />
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
                    <button
                      key={l.id}
                      onClick={() => set({ layout: l.id as Checkout['layout'] })}
                      className={`text-left p-3 rounded-lg border-2 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'}`}
                    >
                      <div className="text-[12.5px] font-medium text-[var(--text)]">{l.label}</div>
                      <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 leading-snug">{l.desc}</div>
                    </button>
                  )
                })}
              </div>
            </SectionCard>
          </div>

          {/* Preview column (sticky) */}
          <div className="xl:sticky xl:top-[80px]">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={13} className="text-[var(--text-muted)]" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Prévia ao vivo</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <CheckoutPreview checkout={draft} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Checkouts List
   ============================================================ */

function CheckoutsList({ checkouts, onOpen, onCreate }: {
  checkouts: Checkout[]; onOpen: (id: string) => void; onCreate: () => void
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

  return (
    <>
      <PageHeader
        title="Checkout"
        subtitle="Páginas de pagamento personalizadas — identidade, gateway, pixel e formulário."
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
              Templates
            </button>
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              Criar checkout
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            className="w-full h-9 pl-9 pr-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[12.5px] placeholder:text-[var(--text-muted)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
          />
        </div>
        <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatusF(s)}
              className={`h-7 px-3 text-[11.5px] font-medium rounded-md transition-colors ${statusF === s ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((c) => <CheckoutCard key={c.id} checkout={c} onOpen={() => onOpen(c.id)} />)}
        <button
          onClick={onCreate}
          className="group min-h-[260px] bg-[var(--surface-2)]/30 border border-dashed border-[var(--border)] rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors focus:outline-none"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] flex items-center justify-center mb-3 group-hover:border-[var(--primary)] group-hover:text-[var(--primary)] transition-colors">
            <Plus size={20} />
          </div>
          <div className="text-[13px] font-semibold text-[var(--text)]">Criar novo checkout</div>
          <div className="text-[11.5px] text-[var(--text-muted)] mt-1 max-w-[220px] leading-snug">Comece do zero ou duplique um existente.</div>
        </button>
      </div>
    </>
  )
}

/* ============================================================
   CheckoutPage
   ============================================================ */

export default function CheckoutPage() {
  const [checkouts, setCheckouts] = useState<Checkout[]>(MOCK_CHECKOUTS)
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data, error } = await sb.from('checkouts').select('*')
        if (error || !data || data.length === 0) throw new Error('no data')
        setCheckouts(data as Checkout[])
      } catch { setCheckouts(MOCK_CHECKOUTS) } finally { setLoading(false) }
    }
    load()
  }, [])

  const editing = checkouts.find((c) => c.id === editingId) ?? null

  function createCheckout() {
    const id = 'co_' + Date.now()
    const newC: Checkout = {
      id, name: 'Novo checkout', slug: 'novo-checkout-' + Math.random().toString(36).slice(2, 6),
      productName: 'Nome do produto', productDesc: 'Descrição curta que aparece logo abaixo do nome.',
      productImage: '', price: 100, installments: 6,
      gateway: 'pushinpay', pixel: 'none', primaryColor: '#7c3aed', bgVariant: 'light', font: 'Inter', logo: 'NC',
      fields: { name: true, email: true, cpf: false, phone: false, address: false, cep: false },
      methods: { pix: true, card: true, boleto: false },
      layout: 'two_col', status: 'draft', visits: 0, conversions: 0, conversion: 0, updatedAt: Date.now(),
    }
    setCheckouts((arr) => [newC, ...arr])
    setEditingId(id)
  }

  async function save(updated: Checkout) {
    setCheckouts((arr) => arr.map((c) => (c.id === updated.id ? updated : c)))
    try {
      const sb = createClient()
      await sb.from('checkouts').upsert({
        id: updated.id, name: updated.name, slug: updated.slug,
        product_name: updated.productName, product_desc: updated.productDesc,
        price: updated.price, installments: updated.installments,
        gateway: updated.gateway, pixel: updated.pixel,
        primary_color: updated.primaryColor, bg_variant: updated.bgVariant,
        font: updated.font, logo: updated.logo, badge: updated.badge,
        fields: updated.fields, methods: updated.methods, layout: updated.layout,
        status: updated.status, updated_at: new Date(updated.updatedAt).toISOString(),
      })
    } catch { /* silent */ }
  }

  if (editing) {
    return (
      <DashboardLayout>
        <CheckoutEditor
          checkout={editing}
          onBack={() => setEditingId(null)}
          onSave={save}
          onPublish={save}
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {loading ? (
        <>
          <PageHeader title="Checkout" subtitle="Páginas de pagamento personalizadas." />
          <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
            <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin mr-2" />
            Carregando…
          </div>
        </>
      ) : (
        <CheckoutsList
          checkouts={checkouts}
          onOpen={setEditingId}
          onCreate={createCheckout}
        />
      )}
    </DashboardLayout>
  )
}
