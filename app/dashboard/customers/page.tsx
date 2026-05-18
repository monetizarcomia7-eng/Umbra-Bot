'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { cn } from '@/lib/utils'
import {
  Search, CheckCircle, Compass, Tag, Calendar, X,
  UserSearch, ChevronRight, ChevronLeft, ShoppingBag, Mail, Phone,
  Bot, Clock, Plus, Activity, MessageCircle, PackageX, ShoppingCart,
  Undo2, ExternalLink, Upload, UserPlus, Download, ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { exportCSV } from '@/lib/csv'
import { useAnalytics } from '@/hooks/use-analytics'

/* ── Icon map ─────────────────────────────────────────────── */

const iconMap: Record<string, LucideIcon> = {
  'search': Search, 'check-circle': CheckCircle, 'compass': Compass,
  'tag': Tag, 'calendar': Calendar, 'x': X,
  'user-search': UserSearch, 'chevron-right': ChevronRight, 'chevron-left': ChevronLeft,
  'shopping-bag': ShoppingBag, 'mail': Mail, 'phone': Phone,
  'bot': Bot, 'clock': Clock, 'plus': Plus,
  'activity': Activity, 'message-circle': MessageCircle, 'package-x': PackageX,
  'shopping-cart': ShoppingCart, 'undo-2': Undo2, 'external-link': ExternalLink,
  'upload': Upload, 'user-plus': UserPlus, 'download': Download, 'chevron-down': ChevronDown,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Comp = iconMap[name]
  if (!Comp) return null
  return <Comp size={size} className={className} />
}

/* ── Formatters ───────────────────────────────────────────── */

const fmtNum    = (v: number) => v.toLocaleString('pt-BR')
const fmtBRLdec = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
const fmtDate   = (dt: number | string) =>
  new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateTime = (dt: number | string) =>
  new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/* ── Types ────────────────────────────────────────────────── */

interface TimelineEvent {
  type: 'purchase' | 'message' | 'abandon' | 'cart' | 'refund'
  dt: number; desc: string; value?: number; gateway?: string
}

interface Customer {
  id: string; name: string; username: string; avatar: string
  email: string; phone: string; origin: string; bot: string
  status: 'buyer' | 'lead'; purchases: number; totalSpent: number
  avgTicket: number; tags: string[]; firstContact: number
  lastContact: number; firstPurchase?: number; lastPurchase?: number
  timeline: TimelineEvent[]
}

/* ── Mock data (determinístico) ───────────────────────────── */

function seededRand(seed: number) {
  let s = seed % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}
const pickC = <T,>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length)]

function normalize(str: string) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function buildAvatar(name: string) {
  const parts = name.split(' ')
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase()
}

const firstNames = ['João', 'Maria', 'Pedro', 'Ana', 'Luana', 'Rafael', 'Bianca', 'Thiago', 'Camila', 'Diego', 'Sabrina', 'Fernando', 'Igor', 'Renata', 'Patrícia', 'Vinícius', 'Beatriz', 'Marcos', 'Carla', 'Bruno', 'Júlia', 'Lucas', 'Mariana', 'Felipe', 'Gabriela', 'André', 'Larissa', 'Daniel', 'Fernanda', 'Rodrigo', 'Letícia', 'Caio']
const lastNames  = ['Silva', 'Souza', 'Castro', 'Lima', 'Andrade', 'Mendes', 'Ramos', 'Lopes', 'Oliveira', 'Antunes', 'Pinheiro', 'Pires', 'Bertolini', 'Cavalcanti', 'Albuquerque', 'Costa', 'Nogueira', 'Tavares', 'Cardoso', 'Moreira']
const origins    = ['Instagram Ads', 'Google Ads', 'YouTube Ads', 'Afiliados', 'Tráfego orgânico', 'Indicação']
const botNames   = ['@mentoria_vip_bot', '@lancamento_black_bot', '@upsell_pos_bot', '@vendas_curso_bot', '@suporte_premium_bot']
const products   = ['Mentoria Premium Anual', 'Curso Intensivo 90 dias', 'Pack Templates Pro', 'Consultoria Individual', 'E-book Estratégias']
const ticketsByProduct: Record<string, number> = {
  'Mentoria Premium Anual': 1297, 'Curso Intensivo 90 dias': 147,
  'Pack Templates Pro': 70, 'Consultoria Individual': 675, 'E-book Estratégias': 20,
}
const tagPool = ['VIP', 'Mentoria', 'Black Friday', 'Trial', 'Frio', 'Quente', 'Recorrente', 'Novo', 'Reativado']
const emailDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'empresa.com.br', 'uol.com.br']
const gateways = ['Pushinpay · Pix', 'Mercado Pago · Cartão', 'Stripe · Cartão']

const NOW_C = new Date('2026-05-18T15:30:00').getTime()

function makeTimeline(customer: Customer, r: () => number, isBuyer: boolean): TimelineEvent[] {
  const events: TimelineEvent[] = []
  let cursor = NOW_C - Math.floor(r() * 8 * 3600 * 1000)
  customer.lastContact = cursor

  if (isBuyer) {
    let purchasesLeft = customer.purchases
    while (purchasesLeft > 0) {
      const product = pickC(products, r)
      const ticket = ticketsByProduct[product]
      events.push({ type: 'purchase', dt: cursor, desc: product, value: ticket, gateway: pickC(gateways, r) })
      cursor -= (10 + Math.floor(r() * 60)) * 60 * 1000
      events.push({ type: 'message', dt: cursor, desc: 'Entrou no funil de vendas via ' + customer.bot })
      purchasesLeft--
      cursor -= (3 + Math.floor(r() * 25)) * 24 * 3600 * 1000
    }
    const purchEvts = events.filter((e) => e.type === 'purchase')
    customer.firstPurchase = purchEvts[purchEvts.length - 1]?.dt
    customer.lastPurchase  = purchEvts[0]?.dt
  } else {
    const n = 1 + Math.floor(r() * 4)
    for (let i = 0; i < n; i++) {
      const type = pickC(['message', 'abandon', 'cart'] as const, r)
      const desc = type === 'message' ? 'Iniciou conversa no ' + customer.bot
                 : type === 'abandon' ? 'Abandonou o carrinho — ' + pickC(products, r)
                 : 'Clicou em "Comprar" — ' + pickC(products, r)
      events.push({ type, dt: cursor, desc })
      cursor -= (1 + Math.floor(r() * 7)) * 24 * 3600 * 1000
    }
  }
  events.sort((a, b) => b.dt - a.dt)
  return events
}

function generateCustomers(): Customer[] {
  const r = seededRand(7)
  const result: Customer[] = []
  for (let i = 0; i < 38; i++) {
    const first = pickC(firstNames, r)
    const last  = pickC(lastNames, r)
    const name = `${first} ${last}`
    const username = '@' + normalize(first) + '_' + (i + 100).toString(36)
    const isBuyer = r() > 0.40
    const purchases = isBuyer ? 1 + Math.floor(r() * 5) : 0
    const totalSpent = isBuyer ? Math.round((purchases * (50 + r() * 1300)) * 100) / 100 : 0
    const tagCount = Math.floor(r() * 3)
    const tags: string[] = []
    for (let j = 0; j < tagCount; j++) {
      const t = pickC(tagPool, r)
      if (!tags.includes(t)) tags.push(t)
    }
    if (isBuyer && purchases >= 3 && !tags.includes('VIP')) tags.push('VIP')
    if (isBuyer && purchases >= 2 && !tags.includes('Recorrente')) tags.push('Recorrente')

    const customer: Customer = {
      id: 'cust_' + String(i + 1).padStart(4, '0'),
      name, username, avatar: buildAvatar(name),
      email: normalize(first) + '.' + normalize(last) + '@' + pickC(emailDomains, r),
      phone: '+55 11 9' + Math.floor(1000 + r() * 8999) + '-' + Math.floor(1000 + r() * 8999),
      origin: pickC(origins, r),
      bot: pickC(botNames, r),
      status: isBuyer ? 'buyer' : 'lead',
      purchases, totalSpent,
      avgTicket: purchases > 0 ? Math.round((totalSpent / purchases) * 100) / 100 : 0,
      tags,
      firstContact: NOW_C - Math.floor((30 + r() * 300) * 24 * 3600 * 1000),
      lastContact: 0, // set in makeTimeline
      timeline: [],
    }
    customer.timeline = makeTimeline(customer, r, isBuyer)
    result.push(customer)
  }
  return result
}

const allCustomersMock = generateCustomers()

/* ── Status & helpers visuais ─────────────────────────────── */

const statusMap: Record<string, { label: string; tone: string }> = {
  buyer: { label: 'Comprou',     tone: 'success' },
  lead:  { label: 'Não comprou', tone: 'muted'   },
}

const AVATAR_COLORS: [string, string][] = [
  ['var(--primary)', '#fff'],
  ['var(--success)', '#fff'],
  ['var(--warning)', '#fff'],
  ['var(--danger)', '#fff'],
]

function Avatar({ name, initials, size = 32 }: { name: string; initials: string; size?: number }) {
  const seed = (name || initials).charCodeAt(0) + (name || initials).length
  const [bg, fg] = AVATAR_COLORS[seed % AVATAR_COLORS.length]
  return (
    <span className="inline-flex items-center justify-center rounded-md font-semibold shrink-0"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.40 }}>
      {initials}
    </span>
  )
}

function relTimeC(dt: number) {
  const diff = NOW_C - dt
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d} d`
  return fmtDate(dt)
}

const toneClasses: Record<string, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger',
  primary: 'bg-primary-soft text-primary',
  muted:   'bg-surface-2 text-text-muted',
}

function Badge({ tone = 'muted', children }: { tone?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium', toneClasses[tone] ?? toneClasses.muted)}>
      {children}
    </span>
  )
}

/* ── Filter options ───────────────────────────────────────── */

const periodOptions = ['Sempre', 'Últimos 7 dias', 'Últimos 30 dias', 'Últimos 90 dias', 'Este mês']
const statusOptions = ['Todos os status', 'Comprou', 'Não comprou']
const originOptions = ['Todas as origens', ...origins]
const tagOptions    = ['Todas as tags', ...tagPool]

/* ── Local helpers ────────────────────────────────────────── */

function Dropdown({ icon, label, value, options, onChange, width }: {
  icon?: string; label: string; value: string; options: string[]
  onChange: (v: string) => void; width?: number
}) {
  const Ico = icon ? (iconMap[icon] ?? null) : null
  return (
    <div className="relative h-9" style={width ? { width } : { minWidth: 150 }}>
      {Ico && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10"><Ico size={13} /></span>}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className={cn('h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50', Ico ? 'pl-8' : 'pl-3')}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"><ChevronDown size={12} /></span>
    </div>
  )
}

function Btn({ variant = 'secondary', size = 'md', iconName, children, onClick, disabled, className }: {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'; iconName?: string; children?: React.ReactNode
  onClick?: () => void; disabled?: boolean; className?: string
}) {
  const Ico = iconName ? (iconMap[iconName] ?? null) : null
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
      size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
      variant === 'primary' ? 'bg-primary text-primary-fg hover:opacity-90' :
      variant === 'secondary' ? 'border border-border bg-surface text-text hover:bg-surface-2' :
      'text-text-muted hover:bg-surface-2 hover:text-text',
      className,
    )}>
      {Ico && <Ico size={size === 'sm' ? 12 : 14} className="shrink-0" />}
      {children}
    </button>
  )
}

function Tabs({ tabs, active, onChange, className }: {
  tabs: { id: string; label: string; icon?: string; count?: number }[]
  active: string; onChange: (id: string) => void; className?: string
}) {
  return (
    <div className={cn('flex items-center gap-0.5 border-b border-border', className)}>
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)} className={cn(
          'inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-t-md -mb-px border-b-2 transition-colors',
          active === tab.id ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text',
        )}>
          {tab.icon && <Icon name={tab.icon} size={14} />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md min-w-[20px] text-center tnum',
              active === tab.id ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages])
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed focus-ring">
        <ChevronLeft size={14} />
      </button>
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)} className={cn(
          'min-w-[32px] h-8 px-2 text-[12px] font-medium rounded-md tnum focus-ring',
          p === page ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-surface-2 hover:text-text',
        )}>{p}</button>
      ))}
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed focus-ring">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30 cursor-pointer accent-primary" />
  )
}

/* ── Filter Bar ───────────────────────────────────────────── */

interface CustFilters { search: string; status: string; origin: string; tag: string; period: string }

function FilterBar({ filters, setFilters, hasFilters, onClear }: {
  filters: CustFilters
  setFilters: React.Dispatch<React.SetStateAction<CustFilters>>
  hasFilters: boolean; onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input type="text" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar por nome, usuário ou e-mail…"
          className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
      </div>
      <Dropdown icon="check-circle" label="Status" value={filters.status} options={statusOptions} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
      <Dropdown icon="compass" label="Origem" value={filters.origin} options={originOptions} onChange={(v) => setFilters((f) => ({ ...f, origin: v }))} width={220} />
      <Dropdown icon="tag" label="Tag" value={filters.tag} options={tagOptions} onChange={(v) => setFilters((f) => ({ ...f, tag: v }))} />
      <Dropdown icon="calendar" label="Período" value={filters.period} options={periodOptions} onChange={(v) => setFilters((f) => ({ ...f, period: v }))} />
      {hasFilters && (
        <button onClick={onClear} className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-ring">
          <X size={13} />
          Limpar
        </button>
      )}
    </div>
  )
}

/* ── Bulk Actions ─────────────────────────────────────────── */

function AddTagPopover({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (t: string) => void }) {
  const [input, setInput] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div ref={ref} className="absolute right-0 top-full mt-1.5 w-[240px] bg-surface border border-border rounded-xl p-1.5 z-50 fade-up" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle px-2 pt-1 pb-1.5">Tags existentes</div>
      <div className="flex flex-wrap gap-1 px-1 pb-1.5">
        {tagPool.map((t) => (
          <button key={t} onClick={() => { onAdd(t); onClose() }}
            className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text hover:border-primary hover:text-primary focus-ring">
            {t}
          </button>
        ))}
      </div>
      <div className="h-px bg-border my-1" />
      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); onClose(); setInput('') } }} className="flex items-center gap-1 p-1">
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Criar nova tag…"
          className="flex-1 h-7 px-2 bg-surface-2 border border-border rounded-md text-[12px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button type="submit" className="h-7 px-2 text-[11.5px] font-medium bg-primary text-primary-fg rounded-md hover:bg-primary-hover focus-ring">Criar</button>
      </form>
    </div>
  )
}

function BulkActionsBar({ count, onAddTag, onExport, onClear, toast }: {
  count: number; onAddTag: () => void; onExport: () => void; onClear: () => void; toast: string
}) {
  return (
    <div className="mb-3 bg-primary-soft border border-primary/30 rounded-xl px-3.5 py-2 flex items-center gap-3 fade-up">
      <div className="text-[12.5px] font-medium text-primary tnum">
        {count} {count === 1 ? 'cliente selecionado' : 'clientes selecionados'}
      </div>
      <div className="flex-1" />
      {toast && (
        <span className="text-[11.5px] text-text-muted flex items-center gap-1 mr-2 fade-up">
          <CheckCircle size={11} className="text-success" />
          {toast}
        </span>
      )}
      <Btn variant="secondary" size="sm" iconName="tag" onClick={onAddTag}>Adicionar tag</Btn>
      <Btn variant="secondary" size="sm" iconName="download" onClick={onExport}>Exportar</Btn>
      <button onClick={onClear} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 focus-ring" title="Cancelar seleção">
        <X size={14} />
      </button>
    </div>
  )
}

/* ── Customer Row ─────────────────────────────────────────── */

function CustomerRow({ c, selected, onToggleSelect, onOpen }: {
  c: Customer; selected: boolean; onToggleSelect: () => void; onOpen: () => void
}) {
  const s = statusMap[c.status]
  return (
    <tr onClick={onOpen} className={cn('border-t border-border cursor-pointer transition-colors', selected ? 'bg-primary-soft/40' : 'hover:bg-surface-2/60')}>
      <td className="pl-4 pr-2 py-2.5 w-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggleSelect} />
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={c.name} initials={c.avatar} size={32} />
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-text truncate">{c.name}</div>
            <div className="text-[11px] text-text-muted tnum truncate">{c.username}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5 text-[12px] text-text-muted whitespace-nowrap">{c.origin}</td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <Badge tone={s.tone}>
          {c.status === 'buyer' && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
          {s.label}
        </Badge>
      </td>
      <td className="px-2 py-2.5 text-right text-[12.5px] tnum text-text whitespace-nowrap">{c.purchases || '—'}</td>
      <td className="px-2 py-2.5 text-right text-[12.5px] tnum font-semibold text-text whitespace-nowrap">
        {c.totalSpent > 0 ? fmtBRLdec(c.totalSpent) : <span className="text-text-subtle font-normal">—</span>}
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <div className="text-[11.5px] text-text-muted tnum">{relTimeC(c.lastContact)}</div>
      </td>
      <td className="pl-2 pr-4 py-2.5 text-right w-10">
        <ChevronRight size={14} className="text-text-muted" />
      </td>
    </tr>
  )
}

/* ── Customers Table ──────────────────────────────────────── */

function CustomersTable({ data, selected, setSelected, onOpenCustomer }: {
  data: Customer[]
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  onOpenCustomer: (id: string) => void
}) {
  const [page, setPage] = useState(1)
  const perPage = 10
  const totalPages = Math.max(1, Math.ceil(data.length / perPage))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * perPage
  const pageItems = data.slice(start, start + perPage)

  useEffect(() => { setPage(1) }, [data.length])

  const pageIds = pageItems.map((c) => c.id)
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPageSelected = pageIds.some((id) => selected.has(id))

  function togglePage() {
    setSelected((sel) => {
      const next = new Set(sel)
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }
  function toggleOne(id: string) {
    setSelected((sel) => { const next = new Set(sel); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {data.length === 0 ? (
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
            <UserSearch size={20} />
          </div>
          <div className="text-[14px] font-semibold text-text">Nenhum cliente encontrado</div>
          <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">Ajuste filtros ou amplie o período para ver mais resultados.</div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse min-w-[880px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
                  <th className="pl-4 pr-2 py-2.5 w-10">
                    <Checkbox checked={allOnPageSelected} indeterminate={someOnPageSelected && !allOnPageSelected} onChange={togglePage} />
                  </th>
                  <th className="text-left  font-semibold px-2 py-2.5">Cliente</th>
                  <th className="text-left  font-semibold px-2 py-2.5">Origem</th>
                  <th className="text-left  font-semibold px-2 py-2.5">Status</th>
                  <th className="text-right font-semibold px-2 py-2.5">Compras</th>
                  <th className="text-right font-semibold px-2 py-2.5">Total gasto</th>
                  <th className="text-left  font-semibold px-2 py-2.5">Último contato</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <CustomerRow key={c.id} c={c} selected={selected.has(c.id)} onToggleSelect={() => toggleOne(c.id)} onOpen={() => onOpenCustomer(c.id)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11.5px] text-text-muted tnum">
              Mostrando <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, data.length)}</span> de <span className="text-text font-medium">{data.length}</span>
              {selected.size > 0 && <> · <span className="text-primary">{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span></>}
            </div>
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}

/* ── Profile Panel ────────────────────────────────────────── */

const timelineTypeMap: Record<string, { icon: string; severity: string; label: string }> = {
  purchase: { icon: 'shopping-bag',   severity: 'success', label: 'Compra'               },
  message:  { icon: 'message-circle', severity: 'info',    label: 'Mensagem'             },
  abandon:  { icon: 'package-x',      severity: 'warning', label: 'Carrinho abandonado'  },
  cart:     { icon: 'shopping-cart',  severity: 'info',    label: 'Adicionou ao carrinho' },
  refund:   { icon: 'undo-2',         severity: 'danger',  label: 'Estorno'              },
}
const sevTones: Record<string, { bg: string; text: string }> = {
  success: { bg: 'bg-success-soft', text: 'text-success' },
  info:    { bg: 'bg-primary-soft', text: 'text-primary' },
  warning: { bg: 'bg-warning-soft', text: 'text-warning' },
  danger:  { bg: 'bg-danger-soft',  text: 'text-danger'  },
}

function InfoLine({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <Icon name={icon} size={11} className="text-text-subtle shrink-0 self-center" />
      <span className="text-text-muted shrink-0">{label}:</span>
      <span className="text-text truncate">{value}</span>
    </div>
  )
}

function TagChip({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md bg-primary-soft text-primary text-[11.5px] font-medium border border-primary/20">
      {tag}
      <button onClick={onRemove} className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-sm hover:bg-primary/20 focus-ring" title="Remover tag">
        <X size={10} />
      </button>
    </span>
  )
}

function MetricCell({ label, value, tone, emphasize }: { label: string; value: string; tone?: string; emphasize?: boolean }) {
  return (
    <div className={cn('p-3 rounded-lg border', emphasize ? 'bg-success-soft border-success/20' : 'bg-surface-2/50 border-border')}>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{label}</div>
      <div className={cn('text-[15px] font-semibold tnum tracking-tight mt-1', tone === 'success' ? 'text-success' : 'text-text')}>{value}</div>
    </div>
  )
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const t = timelineTypeMap[event.type] ?? timelineTypeMap.message
  const tone = sevTones[t.severity]
  return (
    <div className="relative pl-10 py-2">
      <div className={cn('absolute left-0 top-2 w-7 h-7 rounded-md flex items-center justify-center', tone.bg, tone.text)}
        style={{ boxShadow: '0 0 0 4px var(--surface)' }}>
        <Icon name={t.icon} size={13} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">{t.label}</div>
          <div className="text-[12.5px] text-text font-medium mt-0.5 leading-snug">{event.desc}</div>
          {event.value !== undefined && (
            <div className="text-[11.5px] text-text-muted mt-0.5 tnum">
              {fmtBRLdec(event.value)}{event.gateway ? ` · ${event.gateway}` : ''}
            </div>
          )}
        </div>
        <time className="text-[10.5px] text-text-muted tnum shrink-0" title={fmtDateTime(event.dt)}>{relTimeC(event.dt)}</time>
      </div>
    </div>
  )
}

function ProfilePanel({ customer, open, onClose, onUpdate }: {
  customer: Customer | null; open: boolean; onClose: () => void
  onUpdate: (id: string, patch: { tags: string[] }) => void
}) {
  const [tab, setTab] = useState('timeline')
  const [addingTag, setAddingTag] = useState(false)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => { if (open) setTab('timeline') }, [open, customer?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!customer) return null

  function removeTag(t: string) { onUpdate(customer!.id, { tags: customer!.tags.filter((x) => x !== t) }) }
  function addTag(t: string) {
    if (!t.trim() || customer!.tags.includes(t.trim())) return
    onUpdate(customer!.id, { tags: [...customer!.tags, t.trim()] })
  }

  const purchaseEvents = customer.timeline.filter((e) => e.type === 'purchase')
  const items = tab === 'timeline' ? customer.timeline : purchaseEvents

  return (
    <>
      <div
        className={cn('fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />
      <aside
        className={cn('fixed right-0 inset-y-0 z-50 w-full md:w-[480px] bg-surface border-l border-border flex flex-col transition-transform duration-200', open ? 'translate-x-0' : 'translate-x-full')}
        style={{ boxShadow: 'var(--shadow-xl)' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <header className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3 mb-4">
            <Avatar name={customer.name} initials={customer.avatar} size={48} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold text-text leading-tight truncate">{customer.name}</h2>
              <div className="text-[12px] text-text-muted tnum truncate">{customer.username}</div>
              <div className="mt-1">
                <Badge tone={statusMap[customer.status].tone}>
                  {customer.status === 'buyer' && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                  {statusMap[customer.status].label}
                </Badge>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text shrink-0 focus-ring" title="Fechar">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
            <InfoLine icon="mail"     label="E-mail"           value={customer.email} />
            <InfoLine icon="phone"    label="Telefone"         value={customer.phone} />
            <InfoLine icon="compass"  label="Origem"           value={customer.origin} />
            <InfoLine icon="bot"      label="Bot de entrada"   value={<span className="tnum">{customer.bot}</span>} />
            <InfoLine icon="calendar" label="Primeiro contato" value={fmtDate(customer.firstContact)} />
            <InfoLine icon="clock"    label="Último contato"   value={relTimeC(customer.lastContact)} />
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Tags */}
          <section className="px-5 py-4 border-b border-border">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2.5">Tags</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {customer.tags.length === 0 && !addingTag && <span className="text-[12px] text-text-muted">Nenhuma tag.</span>}
              {customer.tags.map((t) => <TagChip key={t} tag={t} onRemove={() => removeTag(t)} />)}
              {addingTag ? (
                <form onSubmit={(e) => { e.preventDefault(); if (tagInput.trim()) { addTag(tagInput); setTagInput(''); setAddingTag(false) } }} className="inline-flex items-center gap-1">
                  <input autoFocus value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onBlur={() => { if (!tagInput.trim()) setAddingTag(false) }}
                    placeholder="Nova tag"
                    className="h-7 px-2 bg-surface-2 border border-primary/40 rounded-md text-[11.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 w-28" />
                  <button type="submit" className="h-7 px-2 text-[11px] font-medium bg-primary text-primary-fg rounded-md hover:bg-primary-hover focus-ring">OK</button>
                </form>
              ) : (
                <button onClick={() => setAddingTag(true)}
                  className="h-7 px-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-text-muted bg-surface border border-dashed border-border rounded-md hover:bg-surface-2 hover:text-text focus-ring">
                  <Plus size={11} />
                  Adicionar
                </button>
              )}
            </div>
          </section>

          {/* Métricas */}
          <section className="px-5 py-4 border-b border-border">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2.5">Métricas</div>
            <div className="grid grid-cols-2 gap-2.5">
              <MetricCell label="Total gasto"     value={fmtBRLdec(customer.totalSpent)} tone="success" emphasize />
              <MetricCell label="Ticket médio"    value={customer.purchases > 0 ? fmtBRLdec(customer.avgTicket) : '—'} />
              <MetricCell label="Primeira compra" value={customer.firstPurchase ? fmtDate(customer.firstPurchase) : '—'} />
              <MetricCell label="Última compra"   value={customer.lastPurchase  ? fmtDate(customer.lastPurchase)  : '—'} />
            </div>
          </section>

          {/* Timeline */}
          <section className="px-5 py-4">
            <Tabs className="-mx-1 mb-3"
              tabs={[
                { id: 'timeline',  label: 'Linha do tempo', icon: 'activity',     count: customer.timeline.length },
                { id: 'purchases', label: 'Compras',        icon: 'shopping-bag', count: purchaseEvents.length    },
              ]}
              active={tab}
              onChange={setTab}
            />
            {items.length === 0 ? (
              <div className="text-[12px] text-text-muted py-4 text-center">Sem registros nesta aba.</div>
            ) : (
              <div className="relative pb-2">
                <div className="absolute left-[14px] top-2 bottom-2 w-px bg-border" />
                {items.map((e, i) => <TimelineItem key={i} event={e} />)}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-border bg-surface-2/40 flex items-center justify-between gap-2">
          <Btn variant="ghost" size="sm" iconName="external-link">Abrir página</Btn>
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" iconName="mail">Enviar e-mail</Btn>
            <Btn variant="primary" size="sm" iconName="message-circle">Mensagem</Btn>
          </div>
        </footer>
      </aside>
    </>
  )
}

/* ── Page ─────────────────────────────────────────────────── */

const defaultCustFilters: CustFilters = {
  search: '', status: 'Todos os status', origin: 'Todas as origens',
  tag: 'Todas as tags', period: 'Sempre',
}

export default function CustomersPage() {
  const [filters, setFilters] = useState<CustFilters>(defaultCustFilters)
  const [customers, setCustomers] = useState<Customer[]>(allCustomersMock)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null)
  const [addTagOpen, setAddTagOpen] = useState(false)
  const [toast, setToast] = useState('')
  const { track } = useAnalytics()

  /* Carrega clientes do Supabase — fallback para mock se tabela não existir */
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .order('last_contact', { ascending: false })
        if (!error && data && data.length > 0) {
          const mapped: Customer[] = data.map((row) => ({
            id: String(row.id),
            name: String(row.name ?? ''),
            username: String(row.username ?? ''),
            avatar: buildAvatar(String(row.name ?? 'U')),
            email: String(row.email ?? ''),
            phone: String(row.phone ?? ''),
            origin: String(row.origin ?? ''),
            bot: String(row.bot ?? ''),
            status: (row.status === 'buyer' ? 'buyer' : 'lead') as 'buyer' | 'lead',
            purchases: Number(row.purchases ?? 0),
            totalSpent: Number(row.total_spent ?? 0),
            avgTicket: Number(row.avg_ticket ?? 0),
            tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
            firstContact: row.first_contact ? new Date(String(row.first_contact)).getTime() : Date.now(),
            lastContact: row.last_contact ? new Date(String(row.last_contact)).getTime() : Date.now(),
            firstPurchase: row.first_purchase ? new Date(String(row.first_purchase)).getTime() : undefined,
            lastPurchase: row.last_purchase ? new Date(String(row.last_purchase)).getTime() : undefined,
            timeline: [],
          }))
          setCustomers(mapped)
        }
      } catch {
        // tabela não existe ainda — usa mock
      }
    }
    load()
  }, [])

  /* Filtragem */
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return customers.filter((c) => {
      if (q && !(c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))) return false
      if (filters.status === 'Comprou'     && c.status !== 'buyer') return false
      if (filters.status === 'Não comprou' && c.status !== 'lead')  return false
      if (filters.origin !== 'Todas as origens' && c.origin !== filters.origin) return false
      if (filters.tag    !== 'Todas as tags'    && !c.tags.includes(filters.tag)) return false
      if (filters.period !== 'Sempre') {
        const days = filters.period === 'Últimos 7 dias' ? 7
                   : filters.period === 'Últimos 30 dias' ? 30
                   : filters.period === 'Últimos 90 dias' ? 90 : 0
        if (days > 0 && (NOW_C - c.lastContact) / (1000 * 3600 * 24) > days) return false
        if (filters.period === 'Este mês' && (NOW_C - c.lastContact) / (1000 * 3600 * 24) > 30) return false
      }
      return true
    })
  }, [customers, filters])

  /* Toast auto-dismiss */
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(defaultCustFilters)
  const openCustomer = customers.find((c) => c.id === openCustomerId) ?? null

  /* Atualiza cliente localmente e no Supabase */
  async function updateCustomer(id: string, patch: { tags: string[] }) {
    setCustomers((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    try {
      const supabase = createClient()
      await supabase.from('contacts').update({ tags: patch.tags }).eq('id', id)
    } catch {
      // silent — estado local já atualizado
    }
  }

  async function bulkAddTag(tag: string) {
    const ids = Array.from(selected)
    setCustomers((cs) => cs.map((c) => {
      if (!selected.has(c.id) || c.tags.includes(tag)) return c
      return { ...c, tags: [...c.tags, tag] }
    }))
    setToast(`Tag "${tag}" adicionada a ${ids.length} cliente${ids.length === 1 ? '' : 's'}.`)
    try {
      const supabase = createClient()
      await Promise.all(
        ids.map((id) => {
          const c = customers.find((x) => x.id === id)
          if (!c || c.tags.includes(tag)) return null
          return supabase.from('contacts').update({ tags: [...c.tags, tag] }).eq('id', id)
        })
      )
    } catch {
      // silent
    }
  }

  function bulkExport() {
    const targets = selected.size > 0
      ? customers.filter((c) => selected.has(c.id))
      : filtered
    const today = new Date().toISOString().slice(0, 10)
    exportCSV(`clientes_${today}.csv`,
      ['ID', 'Nome', 'Username', 'E-mail', 'Telefone', 'Status', 'Origem', 'Bot', 'Compras', 'Total gasto (R$)', 'Tags'],
      targets.map((c) => [
        c.id, c.name, c.username, c.email, c.phone,
        c.status === 'buyer' ? 'Comprador' : 'Lead',
        c.origin, c.bot, c.purchases, c.totalSpent,
        c.tags.join('; '),
      ]),
    )
    track('csv_exported', { section: 'clientes', rows: targets.length })
    if (selected.size > 0) setToast(`${targets.length} cliente${targets.length === 1 ? '' : 's'} exportado${targets.length === 1 ? '' : 's'}.`)
  }

  const buyers = customers.filter((c) => c.status === 'buyer').length
  const leads  = customers.length - buyers

  return (
    <DashboardLayout>
      <PageHeader
        title="Clientes"
        subtitle={`${fmtNum(customers.length)} contatos · ${fmtNum(buyers)} compradores · ${fmtNum(leads)} leads`}
        actions={
          <>
            <Btn iconName="download" onClick={() => bulkExport()}>Exportar CSV</Btn>
            <Btn iconName="upload">Importar CSV</Btn>
            <Btn variant="primary" iconName="user-plus">Adicionar cliente</Btn>
          </>
        }
      />

      <FilterBar filters={filters} setFilters={setFilters} hasFilters={hasFilters} onClear={() => setFilters(defaultCustFilters)} />

      {selected.size > 0 && (
        <div className="relative">
          <BulkActionsBar
            count={selected.size}
            onAddTag={() => setAddTagOpen((o) => !o)}
            onExport={bulkExport}
            onClear={() => setSelected(new Set())}
            toast={toast}
          />
          <AddTagPopover open={addTagOpen} onClose={() => setAddTagOpen(false)} onAdd={bulkAddTag} />
        </div>
      )}

      <CustomersTable
        data={filtered}
        selected={selected}
        setSelected={setSelected}
        onOpenCustomer={setOpenCustomerId}
      />

      <ProfilePanel
        customer={openCustomer}
        open={!!openCustomerId}
        onClose={() => setOpenCustomerId(null)}
        onUpdate={updateCustomer}
      />
    </DashboardLayout>
  )
}
