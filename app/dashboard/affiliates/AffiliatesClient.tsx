'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Search, CheckCircle2, UsersRound, UserPlus, ShoppingBag,
  Wallet, ExternalLink, MoreHorizontal, Check, Copy, X,
  Send, Zap, Link2, ChevronLeft, ChevronRight,
  ChevronDown, Edit2, Pause, Play, Archive, Trash2, Loader2, Plus,
} from 'lucide-react'

/* ── Exported types (for page.tsx) ────────────────────────── */

export interface RawAffiliate {
  id: string
  name: string
  email: string
  slug: string
  status: 'active' | 'paused' | 'archived' | 'pending'
  clicks: number
  sales: number
  commission: number
  conversion_rate: number
  payment_method: string | null
  commission_pct: number
  joined_at: string
  notes: string | null
}

export interface RawPayment {
  id: string
  affiliate_id: string
  cycle: string
  sales: number
  amount: number
  status: 'pending' | 'paid'
  paid_at: string | null
  created_at: string
}

export interface RawConfig {
  percentage: number
  attributionRule: 'first_click' | 'last_click'
  cookieWindow: number
  upsellCommissions: boolean
  recurringCommissions: boolean
  autoPayment: boolean
  minPayout: number
  active: boolean
  programName: string
  programDescription: string
  benefits: string[]
}

export interface RawBot {
  id: string
  name: string
  username: string | null
}

/* ── Internal types ───────────────────────────────────────── */

interface Affiliate {
  id: string
  name: string
  email: string
  initials: string
  slug: string
  url: string
  clicks: number
  sales: number
  commission: number
  conversionRate: number
  status: 'active' | 'paused' | 'archived' | 'pending'
  joined: number
  paymentMethod: string
  commissionPct: number
  notes: string | null
}

interface Payment {
  id: string
  affiliateId: string
  cycle: string
  sales: number
  amount: number
  status: 'pending' | 'paid'
  paidAt?: string
}

type Config = RawConfig

/* ── Utilities ────────────────────────────────────────────── */

const BASE_URL = 'umbra.bot/r/'
const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function currentCycleLabel() {
  const d = new Date()
  return `${MONTHS[d.getMonth()]}/${d.getFullYear()}`
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function mkSlug(name: string) {
  return normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function mkInitials(name: string) {
  const p = name.trim().split(' ')
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase()
}

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' }
function fmtDate(d: string | number) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}

function mapAffiliate(row: RawAffiliate): Affiliate {
  return {
    id: String(row.id),
    name: row.name ?? '',
    email: row.email ?? '',
    initials: mkInitials(row.name ?? 'A'),
    slug: row.slug ?? '',
    url: BASE_URL + (row.slug ?? ''),
    clicks: Number(row.clicks ?? 0),
    sales: Number(row.sales ?? 0),
    commission: Number(row.commission ?? 0),
    conversionRate: Number(row.conversion_rate ?? 0),
    status: (row.status as Affiliate['status']) ?? 'active',
    joined: row.joined_at ? new Date(row.joined_at).getTime() : Date.now(),
    paymentMethod: row.payment_method ?? 'Pix',
    commissionPct: Number(row.commission_pct ?? 30),
    notes: row.notes ?? null,
  }
}

function mapPayment(row: RawPayment): Payment {
  return {
    id: String(row.id),
    affiliateId: String(row.affiliate_id ?? ''),
    cycle: row.cycle ?? '',
    sales: Number(row.sales ?? 0),
    amount: Number(row.amount ?? 0),
    status: (row.status as Payment['status']) ?? 'pending',
    paidAt: row.paid_at ?? undefined,
  }
}

/* ── UI primitives ────────────────────────────────────────── */

function Card({ children, title, subtitle, action, noPadding }: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  action?: React.ReactNode
  noPadding?: boolean
}) {
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

function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '', type = 'button' }: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  const sz = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:opacity-90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger text-white hover:opacity-90',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cn('inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none', sz, v, className)}>
      {children}
    </button>
  )
}

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium', BADGE_TONES[tone] ?? BADGE_TONES.muted)}>
      {children}
    </span>
  )
}

function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" />
}

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="w-4 h-4 accent-primary rounded cursor-pointer" />
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
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40">
        <ChevronLeft size={13} />
      </button>
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={cn('w-7 h-7 flex items-center justify-center rounded-md text-[12px] font-medium',
            p === page ? 'bg-primary text-primary-fg' : 'text-text-muted hover:bg-surface-2')}>
          {p}
        </button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40">
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
        checked ? 'bg-primary' : 'bg-surface-3 border border-border')}>
      <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5')} />
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
      <button onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2">
        <span className="truncate max-w-[120px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 overflow-hidden" style={{ minWidth: width }}>
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }}
              className={cn('w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2',
                o === value ? 'text-primary font-medium' : 'text-text')}>
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
  open: boolean; onClose: () => void; title: string; subtitle?: string
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-surface border border-border rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col', w)}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="text-[15px] font-semibold text-text">{title}</div>
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text shrink-0">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

const AVATAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--danger)']

function Avatar({ name, initials, size = 32 }: { name: string; initials: string; size?: number }) {
  const seed = (name + initials).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return (
    <span className="inline-flex items-center justify-center rounded-md font-semibold shrink-0 text-white"
      style={{ width: size, height: size, background: AVATAR_COLORS[seed % AVATAR_COLORS.length], fontSize: size * 0.40 }}>
      {initials}
    </span>
  )
}

function CopyableLink({ url, onCopy }: { url: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try { navigator.clipboard?.writeText('https://' + url) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
    onCopy?.()
  }
  return (
    <button onClick={handleCopy}
      className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-text font-mono text-[11px] max-w-full"
      title="Copiar link">
      <Link2 size={11} className="text-text-muted shrink-0" />
      <span className="truncate">{url}</span>
      {copied ? <Check size={11} className="text-success shrink-0" /> : <Copy size={11} className="text-text-muted group-hover:text-text shrink-0" />}
    </button>
  )
}

function SummaryCard({ label, value, icon: Icon, tone, sub }: {
  label: string; value: string; icon: React.ElementType; tone?: 'primary' | 'warning'; sub?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center',
          tone === 'primary' ? 'bg-primary-soft text-primary'
          : tone === 'warning' ? 'bg-warning-soft text-warning'
          : 'bg-surface-2 text-text-muted')}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-[24px] font-semibold tracking-tight text-text leading-none">{value}</div>
      {sub && <div className="text-[11.5px] text-text-muted mt-2">{sub}</div>}
    </div>
  )
}

/* ── Status & Sort maps ───────────────────────────────────── */

const STATUS_MAP = {
  active:   { label: 'Ativo',     tone: 'success' },
  paused:   { label: 'Pausado',   tone: 'warning' },
  archived: { label: 'Arquivado', tone: 'muted'   },
  pending:  { label: 'Pendente',  tone: 'primary'  },
} as const

const SORT_LABEL: Record<string, string> = {
  commission_desc: 'Maior comissão', commission_asc: 'Menor comissão',
  sales_desc:      'Mais vendas',    sales_asc:      'Menos vendas',
  clicks_desc:     'Mais cliques',   clicks_asc:     'Menos cliques',
  joined_desc:     'Mais recentes',  joined_asc:     'Mais antigos',
}
const SORT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SORT_LABEL).map(([k, v]) => [v, k])
)

/* ── NoDataState ──────────────────────────────────────────── */

function NoDataState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
        <UsersRound size={22} />
      </div>
      <div className="text-[15px] font-semibold text-text">Nenhum afiliado ainda</div>
      <div className="text-[12.5px] text-text-muted mt-1 max-w-xs mb-4">
        Convide parceiros para divulgar seus produtos e acompanhe as comissões aqui.
      </div>
      <Btn variant="primary" onClick={onAdd}><UserPlus size={13} />Adicionar afiliado</Btn>
    </div>
  )
}

/* ── AffiliateActionsMenu ─────────────────────────────────── */

function AffiliateActionsMenu({ affiliate, onEdit, onStatusChange, onDeleteRequest, onApproveRequest }: {
  affiliate: Affiliate
  onEdit: () => void
  onStatusChange: (status: 'active' | 'paused' | 'archived') => void
  onDeleteRequest: () => void
  onApproveRequest: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const isPending = affiliate.status === 'pending'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 top-full mt-1 bg-surface border border-border rounded-xl shadow-lg py-1 w-44 overflow-hidden">
          {isPending ? (
            <>
              <button onClick={() => { onApproveRequest(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-success hover:bg-success-soft">
                <Check size={13} /> Aprovar
              </button>
              <div className="border-t border-border my-1" />
              <button onClick={() => { onDeleteRequest(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-danger hover:bg-danger-soft">
                <Trash2 size={13} /> Recusar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { onEdit(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text hover:bg-surface-2">
                <Edit2 size={13} className="text-text-muted" /> Editar
              </button>

              {affiliate.status === 'active' && (
                <button onClick={() => { onStatusChange('paused'); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text hover:bg-surface-2">
                  <Pause size={13} className="text-text-muted" /> Pausar
                </button>
              )}
              {affiliate.status === 'paused' && (
                <button onClick={() => { onStatusChange('active'); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text hover:bg-surface-2">
                  <Play size={13} className="text-text-muted" /> Ativar
                </button>
              )}
              {affiliate.status !== 'archived' && (
                <button onClick={() => { onStatusChange('archived'); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text hover:bg-surface-2">
                  <Archive size={13} className="text-text-muted" /> Arquivar
                </button>
              )}
              {affiliate.status === 'archived' && (
                <button onClick={() => { onStatusChange('active'); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text hover:bg-surface-2">
                  <Play size={13} className="text-text-muted" /> Reativar
                </button>
              )}

              <div className="border-t border-border my-1" />
              <button onClick={() => { onDeleteRequest(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-danger hover:bg-danger-soft">
                <Trash2 size={13} /> Apagar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── AffiliatesTable ──────────────────────────────────────── */

function AffiliatesTable({ data, onAddClick, onEdit, onStatusChange, onDeleteRequest, onCopyLink, onApproveRequest }: {
  data: Affiliate[]
  onAddClick: () => void
  onEdit: (id: string) => void
  onStatusChange: (id: string, status: 'active' | 'paused' | 'archived') => void
  onDeleteRequest: (id: string) => void
  onCopyLink: () => void
  onApproveRequest: (id: string) => void
}) {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos os status')
  const [sort, setSort]           = useState('commission_desc')
  const [page, setPage]           = useState(1)
  const perPage = 8

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let arr = data.filter((a) => {
      if (q && !(a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.slug.includes(q))) return false
      if (statusFilter === 'Ativos'     && a.status !== 'active')   return false
      if (statusFilter === 'Pausados'   && a.status !== 'paused')   return false
      if (statusFilter === 'Arquivados' && a.status !== 'archived') return false
      if (statusFilter === 'Pendentes'  && a.status !== 'pending')  return false
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

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <NoDataState onAdd={onAddClick} />
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou slug…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
        <Dropdown label="Status" value={statusFilter}
          options={['Todos os status', 'Ativos', 'Pausados', 'Arquivados', 'Pendentes']}
          onChange={setStatusFilter} />
        <Dropdown label="Ordenar" value={SORT_LABEL[sort]}
          options={Object.values(SORT_LABEL)}
          onChange={(v) => setSort(SORT_MAP[v])}
          width={200} />
        <div className="flex-1" />
        <Btn variant="primary" size="sm" onClick={onAddClick}><UserPlus size={13} />Adicionar afiliado</Btn>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-3">
            <UsersRound size={18} />
          </div>
          <div className="text-[13px] font-medium text-text">Nenhum afiliado encontrado</div>
          <div className="text-[12px] text-text-muted mt-1">Ajuste os filtros para ver mais resultados.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[940px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold bg-surface-2/40">
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
                        <Avatar name={a.name} initials={a.initials} size={32} />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-text truncate">{a.name}</div>
                          <div className="text-[11px] text-text-muted truncate">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <CopyableLink url={a.url} onCopy={onCopyLink} />
                    </td>
                    <td className="px-2 py-2.5 text-right text-text">{fmtNum(a.clicks)}</td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="text-text">{fmtNum(a.sales)}</div>
                      <div className="text-[10.5px] text-text-muted">Conv. {fmtPct(a.conversionRate)}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[13px] font-semibold text-text">{fmtBRL(a.commission)}</td>
                    <td className="px-2 py-2.5">
                      <Badge tone={s.tone}>
                        {a.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                        {s.label}
                      </Badge>
                    </td>
                    <td className="pl-2 pr-4 py-2.5 text-right">
                      <AffiliateActionsMenu
                        affiliate={a}
                        onEdit={() => onEdit(a.id)}
                        onStatusChange={(status) => onStatusChange(a.id, status)}
                        onDeleteRequest={() => onDeleteRequest(a.id)}
                        onApproveRequest={() => onApproveRequest(a.id)}
                      />
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
          <div className="text-[11.5px] text-text-muted">
            Mostrando <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, filtered.length)}</span> de <span className="text-text font-medium">{filtered.length}</span> afiliados
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  )
}

/* ── Program Config ───────────────────────────────────────── */

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

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
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

function ProgramConfigSection({ config, onSave }: {
  config: Config
  onSave: (c: Config) => Promise<void>
}) {
  const [local, setLocal]   = useState(config)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const dirty = JSON.stringify(local) !== JSON.stringify(config)

  useEffect(() => { setLocal(config) }, [config])

  function update(patch: Partial<Config>) { setLocal((c) => ({ ...c, ...patch })); setSaved(false) }
  function reset() { setLocal(config) }

  async function save() {
    setSaving(true)
    await onSave(local)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
      <Card
        title="Configuração do programa"
        subtitle="Defina como os afiliados serão atribuídos e remunerados."
        action={
          <div className="flex items-center gap-2">
            {saved && <span className="text-[11.5px] text-success flex items-center gap-1"><Check size={12} /> Salvo</span>}
            {dirty && !saved && <Btn variant="ghost" size="sm" onClick={reset}>Descartar</Btn>}
            <Btn variant="primary" size="sm" disabled={!dirty || saving} onClick={save}>
              {saving ? <><Spinner size={12} />Salvando…</> : 'Salvar alterações'}
            </Btn>
          </div>
        }
      >
        <div className="space-y-6 mt-1">
          <Section title="Página pública" description="Aparece na URL que os candidatos acessam para se inscrever.">
            <div className="space-y-3">
              <ToggleRow
                label="Aceitar novas candidaturas"
                description="Quando desativado, a página exibe mensagem de programa fechado e o formulário fica oculto."
                checked={local.active}
                onChange={(v) => update({ active: v })}
              />
              <div>
                <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome do programa</label>
                <input
                  type="text"
                  value={local.programName}
                  onChange={(e) => update({ programName: e.target.value })}
                  placeholder="Programa de Afiliados"
                  maxLength={80}
                  className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-text mb-1.5">Descrição</label>
                <textarea
                  value={local.programDescription}
                  onChange={(e) => update({ programDescription: e.target.value })}
                  placeholder="Divulgue nossos produtos e ganhe comissão por cada venda confirmada."
                  rows={3}
                  maxLength={300}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
                />
                <div className="text-right text-[10.5px] text-text-subtle mt-0.5">{local.programDescription.length}/300</div>
              </div>
            </div>
          </Section>

          <Section title="Comissão padrão" description="Percentual pago sobre o valor líquido de cada venda atribuída a um afiliado.">
            <div className="flex items-center gap-4">
              <input type="range" min={5} max={50} step={1} value={local.percentage}
                onChange={(e) => update({ percentage: parseInt(e.target.value, 10) })} className="flex-1" />
              <div className="w-20 h-10 bg-surface-2 border border-border rounded-lg flex items-center justify-center text-[15px] font-semibold text-text">
                {local.percentage}%
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-text-subtle">
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
                    className={cn('text-left p-3 rounded-lg border-2 transition-colors',
                      active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2')}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        active ? 'border-primary' : 'border-border-strong')}>
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
                    className={cn('h-9 px-3 text-[12.5px] font-medium rounded-lg border',
                      active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text')}>
                    {d} dias
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Benefícios" description="Lista exibida na página pública. Vazio = usa lista automática baseada nas suas configurações.">
            <div className="space-y-2">
              {local.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={b}
                    onChange={(e) => {
                      const arr = [...local.benefits]
                      arr[i] = e.target.value
                      update({ benefits: arr })
                    }}
                    placeholder={`Benefício ${i + 1}`}
                    maxLength={100}
                    className="flex-1 h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  />
                  <button
                    onClick={() => update({ benefits: local.benefits.filter((_, j) => j !== i) })}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger-soft transition-colors shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => update({ benefits: [...local.benefits, ''] })}
                disabled={local.benefits.length >= 8}
                className="flex items-center gap-1.5 text-[12px] text-primary hover:opacity-80 font-medium disabled:opacity-40 disabled:pointer-events-none transition-opacity mt-1"
              >
                <Plus size={13} />Adicionar benefício
              </button>
            </div>
          </Section>

          <Section title="Regras avançadas">
            <div className="space-y-3">
              <ToggleRow label="Comissão sobre upsells"
                description="Inclui produtos comprados após a venda inicial dentro da janela."
                checked={local.upsellCommissions} onChange={(v) => update({ upsellCommissions: v })} />
              <ToggleRow label="Comissão recorrente"
                description="Paga o afiliado em todas as renovações da assinatura."
                checked={local.recurringCommissions} onChange={(v) => update({ recurringCommissions: v })} />
              <ToggleRow label="Pagamento automático"
                description="Quita comissões automaticamente no dia 5 de cada mês."
                checked={local.autoPayment} onChange={(v) => update({ autoPayment: v })} />
              {local.autoPayment && (
                <div className="flex items-center gap-2.5 pl-0 pb-1">
                  <span className="text-[12px] text-text-muted">Valor mínimo:</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] text-text-muted pointer-events-none">R$</span>
                    <input
                      type="number" min={10} max={10000} step={10}
                      value={local.minPayout}
                      onChange={(e) => update({ minPayout: Math.max(10, parseInt(e.target.value, 10) || 10) })}
                      className="w-24 h-8 pl-8 pr-2 bg-surface border border-border rounded-lg text-[12.5px] text-right text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Como funciona" subtitle="Preview da configuração atual">
          <ul className="space-y-2.5 mt-1 text-[12px] text-text-muted leading-relaxed">
            <li className="flex items-start gap-2">
              {local.active
                ? <Check size={12} className="text-success mt-0.5 shrink-0" />
                : <X size={12} className="text-danger mt-0.5 shrink-0" />}
              <span className={local.active ? '' : 'text-danger'}>
                {local.active ? 'Programa aberto — aceita candidaturas.' : <><strong>Fechado</strong> — sem novas candidaturas.</>}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={12} className="text-success mt-0.5 shrink-0" />
              <span>Afiliado recebe <strong className="text-text">{local.percentage}%</strong> do valor líquido de cada venda.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={12} className="text-success mt-0.5 shrink-0" />
              <span>Atribuição pelo <strong className="text-text">{local.attributionRule === 'first_click' ? 'primeiro' : 'último'} clique</strong>, cookie de <strong className="text-text">{local.cookieWindow} dias</strong>.</span>
            </li>
            {local.upsellCommissions && <li className="flex items-start gap-2"><Check size={12} className="text-success mt-0.5 shrink-0" /><span>Upsells contam para a comissão.</span></li>}
            {local.recurringCommissions
              ? <li className="flex items-start gap-2"><Check size={12} className="text-success mt-0.5 shrink-0" /><span>Renovações de assinatura também são remuneradas.</span></li>
              : <li className="flex items-start gap-2 opacity-60"><X size={12} className="mt-0.5 shrink-0" /><span>Sem comissão em renovações.</span></li>}
            {local.autoPayment
              ? <li className="flex items-start gap-2"><Check size={12} className="text-success mt-0.5 shrink-0" /><span>Pagamentos automáticos acima de <strong className="text-text">{fmtBRL(local.minPayout)}</strong> no dia 5.</span></li>
              : <li className="flex items-start gap-2 opacity-60"><X size={12} className="mt-0.5 shrink-0" /><span>Pagamento manual a cada ciclo.</span></li>}
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

/* ── PaymentsSection ──────────────────────────────────────── */

function PaymentsSection({ affiliates, payments, onPay }: {
  affiliates: Affiliate[]
  payments: Payment[]
  onPay: (ids: string[]) => Promise<void>
}) {
  const [selected, setSelected] = useState(new Set<string>())
  const [paying,   setPaying]   = useState(new Set<string>())
  const [payingAll, setPayingAll] = useState(false)

  const pending      = payments.filter((p) => p.status === 'pending')
  const paid         = payments.filter((p) => p.status === 'paid').sort((a, b) => new Date(b.paidAt ?? '').getTime() - new Date(a.paidAt ?? '').getTime())
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0)
  const selectedTotal = pending.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.amount, 0)

  function toggleOne(id: string) { setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((p) => p.id))) }

  async function payOne(p: Payment) {
    setPaying((s) => new Set(s).add(p.id))
    await onPay([p.id])
    setPaying((s) => { const n = new Set(s); n.delete(p.id); return n })
    setSelected((s) => { const n = new Set(s); n.delete(p.id); return n })
  }

  async function paySelected() {
    const ids = Array.from(selected)
    if (!ids.length) return
    setPaying((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n })
    await onPay(ids)
    setPaying((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n })
    setSelected(new Set())
  }

  async function payAll() {
    setPayingAll(true)
    const ids = pending.map((p) => p.id)
    setPaying(new Set(ids))
    await onPay(ids)
    setPaying(new Set())
    setSelected(new Set())
    setPayingAll(false)
  }

  const affMap = useMemo(() => Object.fromEntries(affiliates.map((a) => [a.id, a])), [affiliates])
  const cycle  = currentCycleLabel()

  return (
    <div className="space-y-5">
      <Card noPadding>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Comissões a pagar</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="text-[28px] font-semibold text-warning leading-none tracking-tight">{fmtBRL(pendingTotal)}</div>
              <div className="text-[12px] text-text-muted">
                {pending.length} {pending.length === 1 ? 'pagamento pendente' : 'pagamentos pendentes'} · ciclo {cycle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <div className="text-[12px] text-text-muted mr-2">
                {selected.size} selecionado{selected.size === 1 ? '' : 's'} · <span className="text-text font-semibold">{fmtBRL(selectedTotal)}</span>
              </div>
            )}
            <Btn variant={selected.size > 0 ? 'primary' : 'secondary'} onClick={paySelected} disabled={selected.size === 0}>
              <Send size={13} />Pagar {selected.size > 0 ? `${selected.size} selecionado${selected.size === 1 ? '' : 's'}` : 'selecionados'}
            </Btn>
            <Btn variant="primary" onClick={payAll} disabled={pending.length === 0 || payingAll}>
              {payingAll ? <Spinner size={13} /> : <Zap size={13} />}
              Pagar todos
            </Btn>
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
            <div className="w-12 h-12 rounded-xl bg-success-soft text-success flex items-center justify-center mb-4">
              <CheckCircle2 size={22} />
            </div>
            <div className="text-[14px] font-semibold text-text">Tudo em dia</div>
            <div className="text-[12.5px] text-text-muted mt-1">Não há comissões pendentes neste momento.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold bg-surface-2/40">
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
                          <Avatar name={aff.name} initials={aff.initials} size={30} />
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-text truncate">{aff.name}</div>
                            <div className="text-[11px] text-text-muted truncate">{aff.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-[11.5px] text-text-muted">{aff.paymentMethod}</td>
                      <td className="px-2 py-2.5 text-right text-text">{fmtNum(p.sales)}</td>
                      <td className="px-2 py-2.5 text-right text-[13px] font-semibold text-text">{fmtBRL(p.amount)}</td>
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

      {paid.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="text-[14px] font-semibold text-text">Histórico de pagamentos</div>
            <div className="text-[12px] text-text-muted mt-0.5">{paid.length} pagamento{paid.length === 1 ? '' : 's'} realizados</div>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold border-b border-border bg-surface-2/40">
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
                          <Avatar name={aff.name} initials={aff.initials} size={28} />
                          <div className="text-[12.5px] font-medium text-text truncate">{aff.name}</div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-text">{p.cycle}</td>
                      <td className="px-2 py-2.5 text-right text-text-muted">{fmtNum(p.sales)}</td>
                      <td className="px-2 py-2.5 text-right text-text font-semibold">{fmtBRL(p.amount)}</td>
                      <td className="px-2 py-2.5 text-text-muted">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                      <td className="pl-2 pr-4 py-2.5"><Badge tone="success"><Check size={10} />Pago</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── AddAffiliateModal ────────────────────────────────────── */

function AddAffiliateModal({ open, onClose, onAdd, defaultPercentage }: {
  open: boolean
  onClose: () => void
  onAdd: (data: { name: string; email: string; payment: string; commissionPct: number }) => Promise<void>
  defaultPercentage: number
}) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [pct, setPct]         = useState(defaultPercentage)
  const [useOverride, setUseOverride] = useState(false)
  const [payment, setPayment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (open) { setName(''); setEmail(''); setPct(defaultPercentage); setUseOverride(false); setPayment(''); setLoading(false); setError('') }
  }, [open, defaultPercentage])

  const previewSlug = useMemo(() => name.trim() ? mkSlug(name) : 'meu-afiliado', [name])
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  async function submit() {
    if (!valid) return
    setLoading(true)
    setError('')
    await onAdd({ name: name.trim(), email: email.trim(), payment: payment.trim() || 'Pix · ' + email.trim(), commissionPct: useOverride ? pct : defaultPercentage })
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar afiliado" subtitle="Convide um parceiro para divulgar seus produtos."
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={!valid || loading} onClick={submit}>
            {loading ? <><Spinner size={12} />Adicionando…</> : 'Adicionar afiliado'}
          </Btn>
        </>
      }>
      <div className="space-y-3.5">
        {error && <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</div>}
        {[
          { label: 'Nome do afiliado', type: 'text',  value: name,  onChange: setName,  placeholder: 'Ex.: Ana Lima' },
          { label: 'E-mail de contato', type: 'email', value: email, onChange: setEmail, placeholder: 'ana.lima@email.com' },
        ].map(({ label, type, value, onChange, placeholder }) => (
          <div key={label}>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">{label}</label>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
          </div>
        ))}
        <div>
          <label className="block text-[12.5px] font-medium text-text mb-1.5">Link de divulgação</label>
          <div className="h-10 px-3 bg-surface-2 border border-dashed border-border rounded-lg text-[13px] font-mono text-text-muted flex items-center">
            {BASE_URL}<span className="text-text">{previewSlug}</span>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-3 bg-surface-2/50 border border-border rounded-lg">
          <input id="pct-override" type="checkbox" checked={useOverride} onChange={(e) => setUseOverride(e.target.checked)} className="mt-0.5 accent-primary" />
          <div className="flex-1">
            <label htmlFor="pct-override" className="text-[12.5px] font-medium text-text cursor-pointer">Comissão personalizada</label>
            <div className="text-[11.5px] text-text-muted">
              {useOverride ? 'Define um percentual diferente do padrão.' : `Usar comissão padrão do programa (${defaultPercentage}%).`}
            </div>
            {useOverride && (
              <div className="flex items-center gap-3 mt-2">
                <input type="range" min={5} max={50} step={1} value={pct}
                  onChange={(e) => setPct(parseInt(e.target.value, 10))} className="flex-1" />
                <div className="w-16 h-8 bg-surface border border-border rounded-md flex items-center justify-center text-[13px] font-semibold">{pct}%</div>
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

/* ── EditAffiliateModal ───────────────────────────────────── */

function EditAffiliateModal({ affiliate, open, onClose, onSave, defaultPercentage }: {
  affiliate: Affiliate | null
  open: boolean
  onClose: () => void
  onSave: (id: string, patch: { name: string; email: string; payment: string; commissionPct: number }) => Promise<void>
  defaultPercentage: number
}) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [payment, setPayment] = useState('')
  const [pct, setPct]         = useState(defaultPercentage)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (affiliate && open) {
      setName(affiliate.name)
      setEmail(affiliate.email)
      setPayment(affiliate.paymentMethod)
      setPct(affiliate.commissionPct)
      setLoading(false)
    }
  }, [affiliate, open])

  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

  async function submit() {
    if (!valid || !affiliate) return
    setLoading(true)
    await onSave(affiliate.id, { name: name.trim(), email: email.trim(), payment: payment.trim(), commissionPct: pct })
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar afiliado"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={!valid || loading} onClick={submit}>
            {loading ? <><Spinner size={12} />Salvando…</> : 'Salvar'}
          </Btn>
        </>
      }>
      <div className="space-y-3.5">
        {[
          { label: 'Nome', type: 'text', value: name, onChange: setName },
          { label: 'E-mail', type: 'email', value: email, onChange: setEmail },
          { label: 'Forma de pagamento', type: 'text', value: payment, onChange: setPayment },
        ].map(({ label, type, value, onChange }) => (
          <div key={label}>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">{label}</label>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
          </div>
        ))}
        <div>
          <label className="block text-[12.5px] font-medium text-text mb-1.5">Comissão individual</label>
          <div className="flex items-center gap-3">
            <input type="range" min={5} max={50} step={1} value={pct}
              onChange={(e) => setPct(parseInt(e.target.value, 10))} className="flex-1" />
            <div className="w-16 h-8 bg-surface border border-border rounded-md flex items-center justify-center text-[13px] font-semibold">{pct}%</div>
          </div>
          <div className="text-[11px] text-text-muted mt-1">Padrão do programa: {defaultPercentage}%</div>
        </div>
      </div>
    </Modal>
  )
}

/* ── DeleteConfirmModal ───────────────────────────────────── */

function DeleteConfirmModal({ affiliate, open, onClose, onConfirm }: {
  affiliate: Affiliate | null
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (open) setLoading(false) }, [open])

  async function confirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Apagar afiliado" size="sm"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="danger" disabled={loading} onClick={confirm}>
            {loading ? <><Spinner size={12} />Apagando…</> : 'Apagar'}
          </Btn>
        </>
      }>
      <p className="text-[13px] text-text-muted">
        Apagar <strong className="text-text">{affiliate?.name}</strong> permanentemente?
        O histórico de pagamentos será mantido, mas o afiliado não poderá mais acessar o programa.
      </p>
    </Modal>
  )
}

/* ── ApproveAffiliateModal ────────────────────────────────── */

function ApproveAffiliateModal({ affiliate, open, onClose, onApprove, bots }: {
  affiliate: Affiliate | null
  open: boolean
  onClose: () => void
  onApprove: (id: string, notes: string) => Promise<void>
  bots: RawBot[]
}) {
  const [selectedBots, setSelectedBots] = useState<string[]>([])
  const [products, setProducts] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) { setSelectedBots([]); setProducts(''); setLoading(false) }
  }, [open])

  function toggleBot(id: string) {
    setSelectedBots((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id])
  }

  async function submit() {
    if (!affiliate) return
    setLoading(true)
    const notes = JSON.stringify({
      bots: selectedBots.map((id) => {
        const bot = bots.find((b) => b.id === id)
        return { id, name: bot?.username ? `@${bot.username}` : (bot?.name ?? id) }
      }),
      products: products.trim(),
    })
    await onApprove(affiliate.id, notes)
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Aprovar afiliado"
      subtitle={affiliate ? `Configurar acesso de ${affiliate.name}` : undefined}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={loading} onClick={submit}>
            {loading ? <><Spinner size={12} />Aprovando…</> : <><Check size={13} />Aprovar afiliado</>}
          </Btn>
        </>
      }>
      <div className="space-y-4">
        {affiliate && (
          <div className="flex items-center gap-3 p-3 bg-surface-2/50 rounded-lg border border-border">
            <Avatar name={affiliate.name} initials={affiliate.initials} size={36} />
            <div>
              <div className="text-[13px] font-semibold text-text">{affiliate.name}</div>
              <div className="text-[11.5px] text-text-muted">{affiliate.email}</div>
            </div>
          </div>
        )}

        <div>
          <div className="text-[12.5px] font-semibold text-text mb-1">Bots que pode divulgar</div>
          <div className="text-[11.5px] text-text-muted mb-2.5">Selecione quais bots este afiliado está autorizado a promover.</div>
          {bots.length === 0 ? (
            <div className="text-[12px] text-text-muted py-2">Nenhum bot cadastrado ainda.</div>
          ) : (
            <div className="space-y-1.5">
              {bots.map((bot) => {
                const checked = selectedBots.includes(bot.id)
                return (
                  <label key={bot.id} className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors select-none',
                    checked ? 'border-primary/40 bg-primary-soft/30' : 'border-border bg-surface hover:bg-surface-2'
                  )}>
                    <input type="checkbox" checked={checked} onChange={() => toggleBot(bot.id)}
                      className="w-4 h-4 accent-primary rounded shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-text">
                        {bot.username ? `@${bot.username}` : bot.name}
                      </div>
                      {bot.username && <div className="text-[11px] text-text-muted">{bot.name}</div>}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-[12.5px] font-semibold text-text mb-1">
            Produtos que vai divulgar <span className="text-text-muted font-normal">(opcional)</span>
          </div>
          <textarea
            value={products}
            onChange={(e) => setProducts(e.target.value)}
            placeholder="Ex.: Curso de Marketing Digital, Mentoria Individual"
            rows={3}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
          />
        </div>

        <div className="text-[11.5px] text-text-muted bg-primary-soft/20 border border-primary/15 rounded-lg p-3 leading-relaxed">
          Ao aprovar, o status muda para <strong className="text-primary">Ativo</strong> e o afiliado pode divulgar usando o link de afiliado gerado.
        </div>
      </div>
    </Modal>
  )
}

/* ── Tabs ─────────────────────────────────────────────────── */

function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-border mb-4">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cn('flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
            active === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text')}>
          {t.label}
          {t.count !== undefined && (
            <span className={cn('inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
              active === t.id ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-text-muted')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── AffiliatesClient ─────────────────────────────────────── */

export default function AffiliatesClient({ initialAffiliates, initialPayments, initialConfig, userId, appUrl, bots }: {
  initialAffiliates: RawAffiliate[]
  initialPayments: RawPayment[]
  initialConfig: RawConfig
  userId: string
  appUrl: string
  bots: RawBot[]
}) {
  const { track } = useAnalytics()

  const [affiliates, setAffiliates] = useState<Affiliate[]>(() => initialAffiliates.map(mapAffiliate))
  const [payments,   setPayments]   = useState<Payment[]>(()   => initialPayments.map(mapPayment))
  const [config,     setConfig]     = useState<Config>(initialConfig)
  const [tab,        setTab]        = useState('affiliates')
  const [addOpen,    setAddOpen]    = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [deleteId,   setDeleteId]   = useState<string | null>(null)
  const [approveId,  setApproveId]  = useState<string | null>(null)
  const [toast,      setToast]      = useState('')
  const [toastKind,  setToastKind]  = useState<'success' | 'error'>('success')

  function showToast(msg: string, kind: 'success' | 'error' = 'success') {
    setToast(msg); setToastKind(kind)
    setTimeout(() => setToast(''), 4000)
  }

  // ── KPIs
  const activeCount     = affiliates.filter((a) => a.status === 'active').length
  const pendingApps     = affiliates.filter((a) => a.status === 'pending').length
  const totalSales      = affiliates.reduce((s, a) => s + a.sales, 0)
  const totalComm       = affiliates.reduce((s, a) => s + a.commission, 0)
  const pendingCount    = payments.filter((p) => p.status === 'pending').length
  const pendingTotal    = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const publicPageUrl   = `${appUrl}/afiliar/${userId}`

  // ── Add affiliate
  async function handleAdd(data: { name: string; email: string; payment: string; commissionPct: number }) {
    const slug = mkSlug(data.name)
    const supabase = createClient()
    const { data: row, error } = await supabase
      .from('affiliates')
      .insert({
        user_id: userId,
        name: data.name,
        email: data.email,
        slug,
        status: 'active',
        payment_method: data.payment,
        commission_pct: data.commissionPct,
        clicks: 0,
        sales: 0,
        commission: 0,
        conversion_rate: 0,
      })
      .select('id, name, email, slug, status, clicks, sales, commission, conversion_rate, payment_method, commission_pct, joined_at')
      .single()
    if (error || !row) { showToast('Erro ao adicionar afiliado.', 'error'); return }
    setAffiliates((prev) => [mapAffiliate(row as unknown as RawAffiliate), ...prev])
    track('affiliate_added', { commission_pct: data.commissionPct })
    showToast(`${data.name} adicionado ao programa.`)
  }

  // ── Edit affiliate
  async function handleEdit(id: string, patch: { name: string; email: string; payment: string; commissionPct: number }) {
    const supabase = createClient()
    const { error } = await supabase.from('affiliates').update({
      name: patch.name,
      email: patch.email,
      payment_method: patch.payment,
      commission_pct: patch.commissionPct,
    }).eq('id', id).eq('user_id', userId)
    if (error) { showToast('Erro ao salvar alterações.', 'error'); return }
    setAffiliates((prev) => prev.map((a) => a.id === id
      ? { ...a, name: patch.name, email: patch.email, paymentMethod: patch.payment, commissionPct: patch.commissionPct, initials: mkInitials(patch.name) }
      : a))
    showToast('Afiliado atualizado.')
  }

  // ── Status change (pause / activate / archive)
  async function handleStatusChange(id: string, status: 'active' | 'paused' | 'archived') {
    const supabase = createClient()
    const { error } = await supabase.from('affiliates').update({ status }).eq('id', id).eq('user_id', userId)
    if (error) { showToast('Erro ao atualizar status.', 'error'); return }
    setAffiliates((prev) => prev.map((a) => a.id === id ? { ...a, status } : a))
    track('affiliate_status_changed', { status })
    const label = { active: 'Ativado', paused: 'Pausado', archived: 'Arquivado' }[status]
    showToast(`${label} com sucesso.`)
  }

  // ── Delete affiliate
  async function handleDelete() {
    if (!deleteId) return
    const aff = affiliates.find((a) => a.id === deleteId)
    const supabase = createClient()
    const { error } = await supabase.from('affiliates').delete().eq('id', deleteId).eq('user_id', userId)
    if (error) { showToast('Erro ao apagar afiliado.', 'error'); return }
    setAffiliates((prev) => prev.filter((a) => a.id !== deleteId))
    showToast(`${aff?.name ?? 'Afiliado'} removido do programa.`)
  }

  // ── Approve affiliate
  async function handleApprove(id: string, notes: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('affiliates')
      .update({ status: 'active', notes })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) { showToast('Erro ao aprovar afiliado.', 'error'); return }
    setAffiliates((prev) => prev.map((a) => a.id === id ? { ...a, status: 'active' as const, notes } : a))
    track('affiliate_status_changed', { status: 'active' })
    showToast('Afiliado aprovado com sucesso.')
  }

  // ── Save config
  async function handleSaveConfig(c: Config) {
    const supabase = createClient()
    const cleanBenefits = c.benefits.map((b) => b.trim()).filter(Boolean)
    const { error } = await supabase.from('affiliate_config').upsert({
      user_id:               userId,
      percentage:            c.percentage,
      attribution_rule:      c.attributionRule,
      cookie_window:         c.cookieWindow,
      upsell_commissions:    c.upsellCommissions,
      recurring_commissions: c.recurringCommissions,
      auto_payment:          c.autoPayment,
      min_payout:            c.minPayout,
      active:                c.active,
      program_name:          c.programName.trim() || null,
      program_description:   c.programDescription.trim() || null,
      benefits:              cleanBenefits.length > 0 ? cleanBenefits : null,
    }, { onConflict: 'user_id' })
    if (error) { showToast('Erro ao salvar configuração.', 'error'); throw error }
    setConfig(c)
    track('affiliate_config_saved', { percentage: c.percentage, attribution: c.attributionRule, cookie_window: c.cookieWindow })
  }

  // ── Pay commissions
  async function handlePay(ids: string[]) {
    const today = new Date().toISOString().slice(0, 10)
    const supabase = createClient()
    const { error } = await supabase
      .from('affiliate_payments')
      .update({ status: 'paid', paid_at: today })
      .in('id', ids)
      .eq('user_id', userId)
    if (error) { showToast('Erro ao processar pagamento.', 'error'); return }
    const total = payments.filter((p) => ids.includes(p.id)).reduce((s, p) => s + p.amount, 0)
    setPayments((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, status: 'paid' as const, paidAt: today } : p))
    track('affiliate_paid', { count: ids.length, total })
    showToast(`${ids.length} pagamento${ids.length === 1 ? '' : 's'} de ${fmtBRL(total)} processado${ids.length === 1 ? '' : 's'}.`)
  }

  const editingAffiliate = affiliates.find((a) => a.id === editingId) ?? null
  const deleteAffiliate  = affiliates.find((a) => a.id === deleteId)  ?? null

  const tabsConfig = [
    { id: 'affiliates', label: 'Afiliados',    count: affiliates.length },
    { id: 'program',    label: 'Configuração' },
    { id: 'payments',   label: 'Pagamentos',   count: pendingCount > 0 ? pendingCount : undefined },
  ]

  const [linkCopied, setLinkCopied] = useState(false)
  function handleCopyPublicLink() {
    try { navigator.clipboard?.writeText(publicPageUrl) } catch (_) {}
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <>
      <PageHeader
        title="Afiliados"
        subtitle="Gerencie parceiros, comissões e pagamentos do seu programa de afiliação."
        actions={
          <>
            <div className="flex items-center gap-1">
              <a href={publicPageUrl} target="_blank" rel="noopener noreferrer"
                className="h-9 px-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-surface border border-border text-text hover:bg-surface-2 rounded-l-lg border-r-0 transition-colors">
                <ExternalLink size={14} />Página pública
              </a>
              <button onClick={handleCopyPublicLink} title="Copiar link"
                className="h-9 px-2.5 inline-flex items-center justify-center bg-surface border border-border text-text-muted hover:bg-surface-2 hover:text-text rounded-r-lg transition-colors">
                {linkCopied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              </button>
            </div>
            {pendingApps > 0 && (
              <button onClick={() => setTab('affiliates')}
                className="h-9 px-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-primary-soft text-primary border border-primary/20 rounded-lg hover:bg-primary/15 transition-colors">
                <span className="w-4 h-4 rounded-full bg-primary text-primary-fg text-[10px] font-bold flex items-center justify-center">{pendingApps}</span>
                {pendingApps === 1 ? 'candidatura' : 'candidaturas'}
              </button>
            )}
            <button onClick={() => setAddOpen(true)}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-primary text-primary-fg hover:opacity-90 rounded-lg transition-colors">
              <UserPlus size={14} />Adicionar afiliado
            </button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard
          label="Afiliados ativos" icon={UsersRound} tone="primary"
          value={`${fmtNum(activeCount)} / ${fmtNum(affiliates.length)}`}
          sub={pendingApps > 0 ? `${pendingApps} candidatura${pendingApps === 1 ? '' : 's'} pendente${pendingApps === 1 ? '' : 's'}` : affiliates.length === 0 ? 'Nenhum afiliado ainda' : `${affiliates.length} no programa`}
        />
        <SummaryCard
          label="Vendas atribuídas" icon={ShoppingBag}
          value={fmtNum(totalSales)}
          sub={totalComm > 0 ? fmtBRL(totalComm) + ' em comissões' : 'Nenhuma venda ainda'}
        />
        <SummaryCard
          label="Comissões a pagar" icon={Wallet} tone={pendingTotal > 0 ? 'warning' : undefined}
          value={fmtBRL(pendingTotal)}
          sub={`${pendingCount} pendente${pendingCount === 1 ? '' : 's'}`}
        />
      </div>

      <Tabs tabs={tabsConfig} active={tab} onChange={setTab} />

      {toast && (
        <div className={cn('mb-3 flex items-center gap-2.5 border rounded-lg px-3 py-2',
          toastKind === 'success' ? 'bg-success-soft border-success/30' : 'bg-danger-soft border-danger/30')}>
          <CheckCircle2 size={15} className={toastKind === 'success' ? 'text-success' : 'text-danger'} />
          <div className={cn('text-[12.5px]', toastKind === 'success' ? 'text-success' : 'text-danger')}>{toast}</div>
        </div>
      )}

      {tab === 'affiliates' && (
        <AffiliatesTable
          data={affiliates}
          onAddClick={() => setAddOpen(true)}
          onEdit={(id) => setEditingId(id)}
          onStatusChange={handleStatusChange}
          onDeleteRequest={(id) => setDeleteId(id)}
          onCopyLink={() => track('affiliate_link_copied', {})}
          onApproveRequest={(id) => setApproveId(id)}
        />
      )}
      {tab === 'program' && (
        <ProgramConfigSection config={config} onSave={handleSaveConfig} />
      )}
      {tab === 'payments' && (
        <PaymentsSection affiliates={affiliates} payments={payments} onPay={handlePay} />
      )}

      <AddAffiliateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
        defaultPercentage={config.percentage}
      />
      <EditAffiliateModal
        affiliate={editingAffiliate}
        open={!!editingId}
        onClose={() => setEditingId(null)}
        onSave={handleEdit}
        defaultPercentage={config.percentage}
      />
      <DeleteConfirmModal
        affiliate={deleteAffiliate}
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
      <ApproveAffiliateModal
        affiliate={affiliates.find((a) => a.id === approveId) ?? null}
        open={!!approveId}
        onClose={() => setApproveId(null)}
        onApprove={handleApprove}
        bots={bots}
      />
    </>
  )
}
