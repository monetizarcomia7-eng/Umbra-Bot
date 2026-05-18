'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Search, ArrowUpDown, CheckCircle, UsersRound, UserPlus, ShoppingBag,
  Wallet, ExternalLink, MoreHorizontal, Check, Copy, X, SlidersHorizontal,
  Send, Zap, ArrowUpRight, ArrowDownRight, Link2, ChevronLeft, ChevronRight,
  CheckCircle2, ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Affiliate {
  id: string
  name: string
  email: string
  avatar: string
  slug: string
  url: string
  clicks: number
  sales: number
  commission: number
  conversionRate: number
  status: 'active' | 'paused' | 'archived'
  joined: number
  paymentMethod: string
}

interface AffPayment {
  id: string
  affiliateId: string
  cycle: string
  sales: number
  amount: number
  status: 'pending' | 'paid'
  paidAt?: string
}

interface Config {
  percentage: number
  attributionRule: 'first_click' | 'last_click'
  cookieWindow: number
  upsellCommissions: boolean
  recurringCommissions: boolean
  autoPayment: boolean
  minPayout: number
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRLdec(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' }
function fmtDate(d: string | number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

// ─── Mock data ────────────────────────────────────────────────────────────────

const BASE_URL = 'umbra.bot/r/'
const FIRST_NAMES = ['Ana','Bruno','Carla','Diego','Elisa','Felipe','Gabriela','Henrique','Isabela','Júlio','Kátia','Lucas','Marina','Nathan','Olívia','Paulo','Rafaela','Sérgio','Tatiana','Vitor']
const LAST_NAMES  = ['Lima','Tavares','Mendonça','Borges','Carvalho','Pereira','Almeida','Ribeiro','Macedo','Sousa','Barbosa','Cardoso','Vieira','Rocha','Gomes']

function seededRand(seed: number) {
  let s = seed % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}
function pick<T>(arr: T[], r: () => number): T { return arr[Math.floor(r() * arr.length)] }
function normalize(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
function mkInitials(name: string) { const p = name.split(' '); return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase() }

function generateAffiliates(): Affiliate[] {
  const r = seededRand(11)
  const out: Affiliate[] = []
  const used = new Set<string>()
  for (let i = 0; i < 16; i++) {
    const first = pick(FIRST_NAMES, r), last = pick(LAST_NAMES, r), name = `${first} ${last}`
    let slug = `${normalize(first)}-${normalize(last)}`
    while (used.has(slug)) slug = slug + (Math.floor(r() * 90) + 10)
    used.add(slug)
    const sRoll = r()
    const status: Affiliate['status'] = sRoll < 0.72 ? 'active' : sRoll < 0.90 ? 'paused' : 'archived'
    const clicks = status === 'archived' ? Math.floor(50 + r() * 400) : Math.floor(200 + r() * 1800)
    const convRate = 1.5 + r() * 4.5
    const sales = Math.floor((clicks * convRate) / 100)
    const commission = Math.round((sales * (80 + r() * 800)) * 0.30 * 100) / 100
    out.push({
      id: 'aff_' + String(i + 1).padStart(3, '0'),
      name, email: `${normalize(first)}.${normalize(last)}@${pick(['gmail.com','outlook.com','hotmail.com'], r)}`,
      avatar: mkInitials(name), slug, url: BASE_URL + slug,
      clicks, sales, commission, conversionRate: Math.round(convRate * 100) / 100, status,
      joined: new Date('2026-05-18').getTime() - Math.floor((30 + r() * 240) * 24 * 3600 * 1000),
      paymentMethod: 'Pix · ' + (r() > 0.5 ? `${normalize(first)}.${normalize(last)}@email.com` : `+55 11 9${Math.floor(1000 + r() * 8999)}-${Math.floor(1000 + r() * 8999)}`),
    })
  }
  return out.sort((a, b) => b.commission - a.commission)
}

function generatePayments(affiliates: Affiliate[]): AffPayment[] {
  const r = seededRand(33)
  const out: AffPayment[] = []
  affiliates.forEach((aff) => {
    if (aff.status !== 'active' || r() > 0.55) return
    const sales = 2 + Math.floor(r() * 14)
    out.push({ id: `pay_pending_${aff.id}`, affiliateId: aff.id, cycle: 'maio/2026', sales, amount: Math.round((sales * (80 + r() * 600)) * 100) / 100, status: 'pending' })
  })
  const cycles = [
    { label: 'abril/2026', paidAt: '2026-05-05' },
    { label: 'março/2026', paidAt: '2026-04-05' },
    { label: 'fevereiro/2026', paidAt: '2026-03-05' },
    { label: 'janeiro/2026', paidAt: '2026-02-05' },
  ]
  cycles.forEach((c) => {
    affiliates.forEach((aff) => {
      if ((aff.status === 'archived' && r() > 0.2) || r() > 0.7) return
      const sales = 1 + Math.floor(r() * 16)
      out.push({ id: `pay_${c.label}_${aff.id}`, affiliateId: aff.id, cycle: c.label, sales, amount: Math.round((sales * (60 + r() * 600)) * 100) / 100, status: 'paid', paidAt: c.paidAt })
    })
  })
  return out
}

const MOCK_AFFILIATES = generateAffiliates()
const MOCK_PAYMENTS   = generatePayments(MOCK_AFFILIATES)
const DEFAULT_CONFIG: Config = { percentage: 30, attributionRule: 'last_click', cookieWindow: 30, upsellCommissions: true, recurringCommissions: false, autoPayment: false, minPayout: 100 }

// ─── UI primitives ────────────────────────────────────────────────────────────

function Card({ children, title, subtitle, action, noPadding }: { children: React.ReactNode; title?: string; subtitle?: string; action?: React.ReactNode; noPadding?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-xl">
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            {title && <div className="text-[14px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; onClick?: () => void; disabled?: boolean; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger hover:bg-danger/20',
  }[variant]
  return <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}
function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>{children}</span>
}

function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spin inline-block rounded-full border-2 border-current border-t-transparent" style={{ width: size, height: size }} />
}

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 accent-primary rounded cursor-pointer"
    />
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= totalPages - 2) return totalPages - 4 + i
    return page - 2 + i
  })
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40 focus-ring">
        <ChevronLeft size={13} />
      </button>
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)} className={`w-7 h-7 flex items-center justify-center rounded-md text-[12px] font-medium focus-ring ${p === page ? 'bg-primary text-primary-fg' : 'text-text-muted hover:bg-surface-2'}`}>{p}</button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40 focus-ring">
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring shrink-0 ${checked ? 'bg-primary' : 'bg-surface-3 border border-border'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Dropdown({ label, value, options, onChange, width = 170 }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2 focus-ring"
      >
        <span className="truncate max-w-[120px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 overflow-hidden" style={{ minWidth: width }}>
          {options.map((o) => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}
            >
              {o === value && <Check size={12} />}
              <span className={o !== value ? 'pl-[20px]' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface border border-border rounded-2xl shadow-xl w-full ${w} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="text-[15px] font-semibold text-text">{title}</div>
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text focus-ring shrink-0">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--danger)']
function Avatar({ name, initials: ini, size = 32 }: { name: string; initials: string; size?: number }) {
  const seed = (name + ini).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return (
    <span className="inline-flex items-center justify-center rounded-md font-semibold shrink-0 text-white"
      style={{ width: size, height: size, background: AVATAR_COLORS[seed % AVATAR_COLORS.length], fontSize: size * 0.40 }}>
      {ini}
    </span>
  )
}

// ─── CopyableLink ─────────────────────────────────────────────────────────────

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try { navigator.clipboard?.writeText('https://' + url) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={handleCopy} className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border focus-ring text-text font-mono text-[11px] tnum max-w-full" title="Copiar link">
      <Link2 size={11} className="text-text-muted shrink-0" />
      <span className="truncate">{url}</span>
      {copied ? <Check size={11} className="text-success shrink-0" /> : <Copy size={11} className="text-text-muted group-hover:text-text shrink-0" />}
    </button>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, delta, icon: Icon, tone, sub }: {
  label: string; value: string; delta?: number; icon: React.ElementType; tone?: 'primary' | 'warning'; sub?: string
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tone === 'primary' ? 'bg-primary-soft text-primary' : tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-text-muted'}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-[24px] font-semibold tnum tracking-tight text-text leading-none">{value}</div>
      <div className="flex items-center gap-2 mt-2.5">
        {delta !== undefined && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium text-[11px] ${positive ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {fmtPct(Math.abs(delta))}
          </span>
        )}
        {sub && <span className="text-[11.5px] text-text-muted">{sub}</span>}
      </div>
    </div>
  )
}

// ─── Affiliates Table ─────────────────────────────────────────────────────────

const STATUS_MAP = {
  active:   { label: 'Ativo',     tone: 'success', dot: true  },
  paused:   { label: 'Pausado',   tone: 'warning', dot: false },
  archived: { label: 'Arquivado', tone: 'muted',   dot: false },
} as const

const SORT_LABEL: Record<string, string> = {
  commission_desc: 'Maior comissão', commission_asc: 'Menor comissão',
  sales_desc: 'Mais vendas', sales_asc: 'Menos vendas',
  clicks_desc: 'Mais cliques', clicks_asc: 'Menos cliques',
  joined_desc: 'Mais recentes', joined_asc: 'Mais antigos',
}
const SORT_MAP: Record<string, string> = Object.fromEntries(Object.entries(SORT_LABEL).map(([k, v]) => [v, k]))

function AffiliatesTable({ data, onAddClick }: { data: Affiliate[]; onAddClick: () => void }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos os status')
  const [sort, setSort] = useState('commission_desc')
  const [page, setPage] = useState(1)
  const perPage = 8

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let arr = data.filter((a) => {
      if (q && !(a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.slug.includes(q))) return false
      if (statusFilter === 'Ativos' && a.status !== 'active') return false
      if (statusFilter === 'Pausados' && a.status !== 'paused') return false
      if (statusFilter === 'Arquivados' && a.status !== 'archived') return false
      return true
    })
    const [field, dir] = sort.split('_')
    arr = [...arr].sort((a, b) => {
      const va = ((a as unknown) as Record<string, number>)[field] ?? 0
      const vb = ((b as unknown) as Record<string, number>)[field] ?? 0
      return dir === 'asc' ? va - vb : vb - va
    })
    return arr
  }, [data, search, statusFilter, sort])

  useEffect(() => { setPage(1) }, [search, statusFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage   = Math.min(page, totalPages)
  const start      = (safePage - 1) * perPage
  const pageItems  = filtered.slice(start, start + perPage)

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou slug…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <Dropdown label="Status" value={statusFilter} options={['Todos os status', 'Ativos', 'Pausados', 'Arquivados']} onChange={setStatusFilter} />
        <Dropdown
          label="Ordenar" value={SORT_LABEL[sort]}
          options={Object.values(SORT_LABEL)}
          onChange={(v) => setSort(SORT_MAP[v])}
          width={200}
        />
        <div className="flex-1" />
        <Btn variant="primary" size="sm" onClick={onAddClick}><UserPlus size={13} />Adicionar afiliado</Btn>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
            <UsersRound size={20} />
          </div>
          <div className="text-[14px] font-semibold text-text">Nenhum afiliado encontrado</div>
          <div className="text-[12.5px] text-text-muted mt-1">Ajuste filtros ou convide novos parceiros.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[940px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
                <th className="text-left pl-4 pr-2 py-2.5">Afiliado</th>
                <th className="text-left px-2 py-2.5">Link de divulgação</th>
                <th className="text-right px-2 py-2.5">Cliques</th>
                <th className="text-right px-2 py-2.5">Vendas</th>
                <th className="text-right px-2 py-2.5">Comissão</th>
                <th className="text-left px-2 py-2.5">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((a) => {
                const s = STATUS_MAP[a.status]
                return (
                  <tr key={a.id} className="border-t border-border hover:bg-surface-2/50 transition-colors">
                    <td className="pl-4 pr-2 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={a.name} initials={a.avatar} size={32} />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-text truncate">{a.name}</div>
                          <div className="text-[11px] text-text-muted truncate">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5"><CopyableLink url={a.url} /></td>
                    <td className="px-2 py-2.5 text-right tnum text-text">{fmtNum(a.clicks)}</td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="tnum text-text">{fmtNum(a.sales)}</div>
                      <div className="text-[10.5px] text-text-muted tnum">Conv. {fmtPct(a.conversionRate)}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[13px] tnum font-semibold text-text">{fmtBRLdec(a.commission)}</td>
                    <td className="px-2 py-2.5">
                      <Badge tone={s.tone}>
                        {s.dot && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                        {s.label}
                      </Badge>
                    </td>
                    <td className="pl-2 pr-4 py-2.5 text-right">
                      <button className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-ring">
                        <MoreHorizontal size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11.5px] text-text-muted tnum">
            Mostrando <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, filtered.length)}</span> de <span className="text-text font-medium">{filtered.length}</span> afiliados
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  )
}

// ─── Program Config ────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="pb-5 border-b border-border last:border-b-0 last:pb-0">
      <div className="text-[13px] font-semibold text-text">{title}</div>
      {description && <div className="text-[12px] text-text-muted mt-0.5 mb-3 max-w-md">{description}</div>}
      {!description && <div className="h-2.5" />}
      {children}
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-text">{label}</div>
        {description && <div className="text-[11.5px] text-text-muted leading-snug mt-0.5">{description}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

function ProgramConfigSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const [local, setLocal] = useState(config)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(local) !== JSON.stringify(config)

  function update(patch: Partial<Config>) { setLocal((c) => ({ ...c, ...patch })); setSaved(false) }
  function save() { onChange(local); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  function reset() { setLocal(config) }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
      <Card
        title="Configuração do programa"
        subtitle="Defina como os afiliados serão atribuídos e remunerados."
        action={
          <div className="flex items-center gap-2">
            {saved && <span className="text-[11.5px] text-success flex items-center gap-1 fade-up"><Check size={12} /> Salvo</span>}
            {dirty && !saved && <Btn variant="ghost" size="sm" onClick={reset}>Descartar</Btn>}
            <Btn variant="primary" size="sm" disabled={!dirty} onClick={save}>Salvar alterações</Btn>
          </div>
        }
      >
        <div className="space-y-6 mt-1">
          <Section title="Comissão padrão" description="Percentual pago sobre o valor líquido de cada venda atribuída a um afiliado.">
            <div className="flex items-center gap-4">
              <input type="range" min={5} max={50} step={1} value={local.percentage}
                onChange={(e) => update({ percentage: parseInt(e.target.value, 10) })} className="flex-1" />
              <div className="w-20 h-10 bg-surface-2 border border-border rounded-lg flex items-center justify-center text-[15px] font-semibold tnum text-text">
                {local.percentage}%
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-text-subtle tnum">
              <span>5%</span><span>25%</span><span>50%</span>
            </div>
          </Section>

          <Section title="Regra de atribuição" description="Qual clique fica com a venda quando há mais de um afiliado envolvido.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'first_click' as const, label: 'Primeiro clique', desc: 'O afiliado do primeiro toque recebe a comissão, mesmo se outros vierem depois.' },
                { id: 'last_click'  as const, label: 'Último clique',   desc: 'O último afiliado antes da compra fica com a comissão. Padrão recomendado.' },
              ].map((opt) => {
                const active = local.attributionRule === opt.id
                return (
                  <button key={opt.id} onClick={() => update({ attributionRule: opt.id })}
                    className={`text-left p-3 rounded-lg border-2 transition-colors focus-ring ${active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2 hover:border-border-strong'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-primary' : 'border-border-strong'}`}>
                        {active && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </span>
                      <div className="text-[13px] font-medium text-text">{opt.label}</div>
                    </div>
                    <div className="text-[11.5px] text-text-muted leading-snug">{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Janela de cookie" description="Tempo que o clique de um afiliado fica vinculado ao lead antes de expirar.">
            <div className="flex flex-wrap gap-1.5">
              {[7, 14, 30, 60, 90].map((d) => {
                const active = local.cookieWindow === d
                return (
                  <button key={d} onClick={() => update({ cookieWindow: d })}
                    className={`h-9 px-3 text-[12.5px] font-medium tnum rounded-lg border focus-ring ${active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text'}`}>
                    {d} dias
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Regras avançadas">
            <div className="space-y-3">
              <ToggleRow label="Comissão sobre upsells" description="Inclui produtos comprados após a venda inicial dentro da janela." checked={local.upsellCommissions} onChange={(v) => update({ upsellCommissions: v })} />
              <ToggleRow label="Comissão recorrente" description="Paga o afiliado em todas as renovações da assinatura." checked={local.recurringCommissions} onChange={(v) => update({ recurringCommissions: v })} />
              <ToggleRow label="Pagamento automático" description={`Quita comissões acima de ${fmtBRLdec(local.minPayout)} no dia 5 de cada mês.`} checked={local.autoPayment} onChange={(v) => update({ autoPayment: v })} />
            </div>
          </Section>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Como funciona" subtitle="Preview da configuração atual">
          <ul className="space-y-2.5 mt-1 text-[12px] text-text-muted leading-relaxed">
            <li className="flex items-start gap-2">
              <Check size={12} className="text-success mt-0.5 shrink-0" />
              <span>Afiliado recebe <strong className="text-text tnum">{local.percentage}%</strong> do valor líquido de cada venda.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={12} className="text-success mt-0.5 shrink-0" />
              <span>Atribuição pelo <strong className="text-text">{local.attributionRule === 'first_click' ? 'primeiro' : 'último'} clique</strong>, cookie de <strong className="text-text tnum">{local.cookieWindow} dias</strong>.</span>
            </li>
            {local.upsellCommissions && <li className="flex items-start gap-2"><Check size={12} className="text-success mt-0.5 shrink-0" /><span>Upsells contam para a comissão.</span></li>}
            {local.recurringCommissions
              ? <li className="flex items-start gap-2"><Check size={12} className="text-success mt-0.5 shrink-0" /><span>Renovações de assinatura também são remuneradas.</span></li>
              : <li className="flex items-start gap-2 opacity-60"><X size={12} className="text-text-subtle mt-0.5 shrink-0" /><span>Sem comissão em renovações.</span></li>}
            {local.autoPayment
              ? <li className="flex items-start gap-2"><Check size={12} className="text-success mt-0.5 shrink-0" /><span>Pagamentos automáticos no dia 5.</span></li>
              : <li className="flex items-start gap-2 opacity-60"><X size={12} className="text-text-subtle mt-0.5 shrink-0" /><span>Pagamento manual a cada ciclo.</span></li>}
          </ul>
        </Card>
        <Card title="Dica" subtitle="Boas práticas">
          <div className="text-[12px] text-text-muted leading-relaxed">
            Programas com comissão entre <strong className="text-text">25–35%</strong> e janela de <strong className="text-text">30 dias</strong> têm a melhor retenção de afiliados em SaaS no Brasil.
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Payments Section ─────────────────────────────────────────────────────────

function PaymentsSection({ affiliates, payments, onPay }: {
  affiliates: Affiliate[]; payments: AffPayment[]; onPay: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState(new Set<string>())
  const [paying,   setPaying]   = useState(new Set<string>())

  const pending = payments.filter((p) => p.status === 'pending')
  const paid    = payments.filter((p) => p.status === 'paid').sort((a, b) => new Date(b.paidAt ?? '').getTime() - new Date(a.paidAt ?? '').getTime())
  const pendingTotal   = pending.reduce((s, p) => s + p.amount, 0)
  const selectedTotal  = pending.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.amount, 0)

  function toggleOne(id: string) { setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((p) => p.id))) }

  function payOne(p: AffPayment) {
    setPaying((s) => new Set(s).add(p.id))
    setTimeout(() => { onPay([p.id]); setPaying((s) => { const n = new Set(s); n.delete(p.id); return n }); setSelected((s) => { const n = new Set(s); n.delete(p.id); return n }) }, 900)
  }
  function paySelected() {
    const ids = Array.from(selected)
    if (!ids.length) return
    setPaying((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n })
    setTimeout(() => { onPay(ids); setPaying((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n }); setSelected(new Set()) }, 1100)
  }
  function payAll() { setSelected(new Set(pending.map((p) => p.id))); setTimeout(paySelected, 50) }

  const affMap = useMemo(() => Object.fromEntries(affiliates.map((a) => [a.id, a])), [affiliates])

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Comissões a pagar</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="text-[28px] font-semibold tnum text-warning leading-none tracking-tight">{fmtBRLdec(pendingTotal)}</div>
              <div className="text-[12px] text-text-muted">{pending.length} {pending.length === 1 ? 'pagamento pendente' : 'pagamentos pendentes'} · ciclo maio/2026</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <div className="text-[12px] text-text-muted mr-2 fade-up">
                {selected.size} selecionado{selected.size === 1 ? '' : 's'} · <span className="text-text font-semibold tnum">{fmtBRLdec(selectedTotal)}</span>
              </div>
            )}
            <Btn variant={selected.size > 0 ? 'primary' : 'secondary'} onClick={paySelected} disabled={selected.size === 0}>
              <Send size={13} />Pagar {selected.size > 0 ? `${selected.size} selecionado${selected.size === 1 ? '' : 's'}` : 'selecionados'}
            </Btn>
            <Btn variant="primary" onClick={payAll} disabled={pending.length === 0}><Zap size={13} />Pagar todos</Btn>
          </div>
        </div>
      </Card>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[14px] font-semibold text-text">Pendentes</div>
          <div className="text-[12px] text-text-muted mt-0.5">Selecione um ou mais afiliados para liberar pagamento</div>
        </div>
        {pending.length === 0 ? (
          <div className="py-14 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-success-soft text-success flex items-center justify-center mb-4"><CheckCircle2 size={22} /></div>
            <div className="text-[14px] font-semibold text-text">Tudo em dia</div>
            <div className="text-[12.5px] text-text-muted mt-1">Não há comissões pendentes neste momento.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
                  <th className="pl-4 pr-2 py-2.5 w-10">
                    <Checkbox checked={selected.size === pending.length && pending.length > 0} indeterminate={selected.size > 0 && selected.size < pending.length} onChange={toggleAll} />
                  </th>
                  <th className="text-left px-2 py-2.5">Afiliado</th>
                  <th className="text-left px-2 py-2.5">Forma de pagamento</th>
                  <th className="text-right px-2 py-2.5">Vendas</th>
                  <th className="text-right px-2 py-2.5">Comissão</th>
                  <th className="pl-2 pr-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => {
                  const aff = affMap[p.affiliateId]
                  if (!aff) return null
                  const isPaying = paying.has(p.id)
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-surface-2/50 transition-colors">
                      <td className="pl-4 pr-2 py-2.5"><Checkbox checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} /></td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={aff.name} initials={aff.avatar} size={30} />
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-text truncate">{aff.name}</div>
                            <div className="text-[11px] text-text-muted truncate">{aff.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-[11.5px] text-text-muted">{aff.paymentMethod}</td>
                      <td className="px-2 py-2.5 text-right tnum text-text">{fmtNum(p.sales)}</td>
                      <td className="px-2 py-2.5 text-right text-[13px] tnum font-semibold text-text">{fmtBRLdec(p.amount)}</td>
                      <td className="pl-2 pr-4 py-2.5 text-right">
                        <Btn variant="secondary" size="sm" onClick={() => payOne(p)} disabled={isPaying}>
                          {isPaying ? <><Spinner size={11} />Processando…</> : <><Send size={12} />Pagar</>}
                        </Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[14px] font-semibold text-text">Histórico de pagamentos</div>
          <div className="text-[12px] text-text-muted mt-0.5">{paid.length} pagamentos nos últimos 4 ciclos</div>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold border-b border-border">
                <th className="text-left pl-4 pr-2 py-2.5">Afiliado</th>
                <th className="text-left px-2 py-2.5">Ciclo</th>
                <th className="text-right px-2 py-2.5">Vendas</th>
                <th className="text-right px-2 py-2.5">Comissão</th>
                <th className="text-left px-2 py-2.5">Pago em</th>
                <th className="text-left pl-2 pr-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((p) => {
                const aff = affMap[p.affiliateId]
                if (!aff) return null
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-surface-2/50 transition-colors">
                    <td className="pl-4 pr-2 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={aff.name} initials={aff.avatar} size={28} />
                        <div className="text-[12.5px] font-medium text-text truncate">{aff.name}</div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-text">{p.cycle}</td>
                    <td className="px-2 py-2.5 text-right text-text-muted tnum">{fmtNum(p.sales)}</td>
                    <td className="px-2 py-2.5 text-right text-text tnum font-semibold">{fmtBRLdec(p.amount)}</td>
                    <td className="px-2 py-2.5 text-text-muted tnum">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                    <td className="pl-2 pr-4 py-2.5"><Badge tone="success"><Check size={10} />Pago</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Add Affiliate Modal ───────────────────────────────────────────────────────

function AddAffiliateModal({ open, onClose, onAdd, defaultPercentage }: {
  open: boolean; onClose: () => void; onAdd: (a: { name: string; email: string; payment: string }) => void; defaultPercentage: number
}) {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [pct, setPct]     = useState(defaultPercentage)
  const [useOverride, setUseOverride] = useState(false)
  const [payment, setPayment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) { setName(''); setEmail(''); setPct(defaultPercentage); setUseOverride(false); setPayment(''); setLoading(false) }
  }, [open, defaultPercentage])

  const previewSlug = useMemo(() => {
    if (!name.trim()) return 'meu-afiliado'
    return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }, [name])

  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  function submit() {
    if (!valid) return
    setLoading(true)
    setTimeout(() => { onAdd({ name: name.trim(), email: email.trim(), payment: payment.trim() || 'Pix · ' + email.trim() }); setLoading(false); onClose() }, 900)
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar afiliado" subtitle="Convide um parceiro para divulgar seus produtos."
      footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn variant="primary" disabled={!valid || loading} onClick={submit}>{loading ? <><Spinner />Enviando…</> : 'Enviar convite'}</Btn></>}>
      <div className="space-y-3.5">
        {[{ label: 'Nome do afiliado', type: 'text', value: name, onChange: setName, placeholder: 'Ex.: Ana Lima' },
          { label: 'E-mail de contato', type: 'email', value: email, onChange: setEmail, placeholder: 'ana.lima@email.com' }].map(({ label, type, value, onChange, placeholder }) => (
          <div key={label}>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">{label}</label>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
          </div>
        ))}
        <div>
          <label className="block text-[12.5px] font-medium text-text mb-1.5">Link de divulgação</label>
          <div className="h-10 px-3 bg-surface-2 border border-dashed border-border rounded-lg text-[13px] font-mono tnum text-text-muted flex items-center">
            {BASE_URL}<span className="text-text">{previewSlug}</span>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-3 bg-surface-2/50 border border-border rounded-lg">
          <input id="pct-override" type="checkbox" checked={useOverride} onChange={(e) => setUseOverride(e.target.checked)} className="mt-0.5 accent-primary" />
          <div className="flex-1">
            <label htmlFor="pct-override" className="text-[12.5px] font-medium text-text cursor-pointer">Comissão personalizada</label>
            <div className="text-[11.5px] text-text-muted">{useOverride ? 'Define um percentual diferente do padrão.' : `Usar comissão padrão do programa (${defaultPercentage}%).`}</div>
            {useOverride && (
              <div className="flex items-center gap-3 mt-2 fade-up">
                <input type="range" min={5} max={50} step={1} value={pct} onChange={(e) => setPct(parseInt(e.target.value, 10))} className="flex-1" />
                <div className="w-16 h-8 bg-surface border border-border rounded-md flex items-center justify-center text-[13px] font-semibold tnum">{pct}%</div>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[12.5px] font-medium text-text mb-1.5">Forma de pagamento (opcional)</label>
          <input type="text" value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Pix · chave@email.com"
            className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-border mb-4">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors focus-ring ${active === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}>
          {t.label}
          {t.count !== undefined && (
            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${active === t.id ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-text-muted'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>(MOCK_AFFILIATES)
  const [payments,   setPayments]   = useState<AffPayment[]>(MOCK_PAYMENTS)
  const [config,     setConfig]     = useState<Config>(DEFAULT_CONFIG)
  const [tab, setTab]               = useState('affiliates')
  const [addOpen, setAddOpen]       = useState(false)
  const [toast, setToast]           = useState('')

  // Supabase — initial fetch
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('affiliates').select('*').order('commission', { ascending: false })
        if (!error && data && data.length > 0) {
          setAffiliates(data.map((row) => ({
            id: String(row.id), name: String(row.name ?? ''), email: String(row.email ?? ''),
            avatar: mkInitials(String(row.name ?? 'A')), slug: String(row.slug ?? ''),
            url: BASE_URL + String(row.slug ?? ''), clicks: Number(row.clicks ?? 0),
            sales: Number(row.sales ?? 0), commission: Number(row.commission ?? 0),
            conversionRate: Number(row.conversion_rate ?? 0),
            status: (row.status as Affiliate['status']) ?? 'active',
            joined: row.joined_at ? new Date(String(row.joined_at)).getTime() : Date.now(),
            paymentMethod: String(row.payment_method ?? 'Pix'),
          })))
        }
        const { data: pd, error: pe } = await supabase.from('affiliate_payments').select('*').order('created_at', { ascending: false })
        if (!pe && pd && pd.length > 0) {
          setPayments(pd.map((row) => ({
            id: String(row.id), affiliateId: String(row.affiliate_id ?? ''),
            cycle: String(row.cycle ?? ''), sales: Number(row.sales ?? 0),
            amount: Number(row.amount ?? 0), status: (row.status as AffPayment['status']) ?? 'pending',
            paidAt: row.paid_at ? String(row.paid_at) : undefined,
          })))
        }
      } catch { /* tabelas não existem ainda — usa mock */ }
    }
    load()
  }, [])

  // KPIs
  const active       = affiliates.filter((a) => a.status === 'active').length
  const totalSales   = affiliates.reduce((s, a) => s + a.sales, 0)
  const totalComm    = affiliates.reduce((s, a) => s + a.commission, 0)
  const pendingCount = payments.filter((p) => p.status === 'pending').length
  const pendingTotal = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0)

  async function handleAdd({ name, email, payment }: { name: string; email: string; payment: string }) {
    const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const newAff: Affiliate = { id: 'aff_' + Date.now(), name, email, avatar: mkInitials(name), slug, url: BASE_URL + slug, clicks: 0, sales: 0, commission: 0, conversionRate: 0, status: 'active', joined: Date.now(), paymentMethod: payment }
    setAffiliates((arr) => [newAff, ...arr])
    try {
      const supabase = createClient()
      await supabase.from('affiliates').insert({ name, email, slug, status: 'active', payment_method: payment, clicks: 0, sales: 0, commission: 0, conversion_rate: 0 })
    } catch { }
  }

  function handlePay(ids: string[]) {
    const total = payments.filter((p) => ids.includes(p.id)).reduce((s, p) => s + p.amount, 0)
    setPayments((arr) => arr.map((p) => ids.includes(p.id) ? { ...p, status: 'paid' as const, paidAt: new Date().toISOString().slice(0, 10) } : p))
    setToast(`${ids.length} pagamento${ids.length === 1 ? '' : 's'} de ${fmtBRLdec(total)} processado${ids.length === 1 ? '' : 's'}.`)
    setTimeout(() => setToast(''), 4000)
    try {
      const supabase = createClient()
      ids.forEach((id) => supabase.from('affiliate_payments').update({ status: 'paid', paid_at: new Date().toISOString().slice(0, 10) }).eq('id', id))
    } catch { }
  }

  const tabsConfig = [
    { id: 'affiliates', label: 'Afiliados',    count: affiliates.length },
    { id: 'program',    label: 'Configuração' },
    { id: 'payments',   label: 'Pagamentos',   count: pendingCount > 0 ? pendingCount : undefined },
  ]

  return (
    <DashboardLayout>
      <PageHeader
        title="Afiliados"
        subtitle="Gerencie parceiros, comissões e pagamentos do seu programa de afiliação."
        actions={
          <>
            <Btn variant="secondary"><ExternalLink size={14} />Página pública</Btn>
            <Btn variant="primary" onClick={() => setAddOpen(true)}><UserPlus size={14} />Adicionar afiliado</Btn>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard label="Afiliados ativos" value={`${fmtNum(active)} / ${fmtNum(affiliates.length)}`} delta={12.4} icon={UsersRound} tone="primary" sub="no período" />
        <SummaryCard label="Vendas atribuídas" value={fmtNum(totalSales)} delta={18.1} icon={ShoppingBag} sub={fmtBRLdec(totalComm)} />
        <SummaryCard label="Comissões a pagar" value={fmtBRLdec(pendingTotal)} icon={Wallet} tone="warning" sub={`${pendingCount} pendente${pendingCount === 1 ? '' : 's'}`} />
      </div>

      <Tabs tabs={tabsConfig} active={tab} onChange={setTab} />

      {toast && (
        <div className="mb-3 flex items-center gap-2.5 bg-success-soft border border-success/30 rounded-lg px-3 py-2 fade-up">
          <CheckCircle2 size={15} className="text-success" />
          <div className="text-[12.5px] text-success">{toast}</div>
        </div>
      )}

      {tab === 'affiliates' && <AffiliatesTable data={affiliates} onAddClick={() => setAddOpen(true)} />}
      {tab === 'program'    && <ProgramConfigSection config={config} onChange={setConfig} />}
      {tab === 'payments'   && <PaymentsSection affiliates={affiliates} payments={payments} onPay={handlePay} />}

      <AddAffiliateModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} defaultPercentage={config.percentage} />
    </DashboardLayout>
  )
}
