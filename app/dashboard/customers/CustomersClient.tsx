'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import { exportCSV } from '@/lib/csv'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Search, CheckCircle, X, UserSearch, ChevronRight, ChevronLeft,
  ShoppingBag, Mail, Phone, Bot, Clock, Plus, Activity, MessageCircle,
  PackageX, ShoppingCart, Undo2, Upload, UserPlus, Download,
  ChevronDown, Compass, Tag, Calendar, Loader2, AlertCircle,
  CheckCircle2, Wifi, WifiOff, GitBranch,
  ArrowUp, ArrowDown, ChevronsUpDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ── Public types (exported for page.tsx) ─────────────────── */

export interface RawContact {
  id: string
  name: string
  username: string | null
  email: string | null
  phone: string | null
  origin: string | null
  bot: string | null
  bot_id: string | null
  purchases: number
  total_spent: number
  avg_ticket: number
  tags: string[]
  first_contact: string
  last_contact: string
  first_purchase: string | null
  last_purchase: string | null
}

export interface ContactBotOption {
  id: string
  name: string
  username: string | null
}

/* ── Internal types ───────────────────────────────────────── */

interface Customer {
  id: string
  name: string
  username: string
  email: string
  phone: string
  origin: string
  bot: string
  status: 'buyer' | 'lead'
  purchases: number
  totalSpent: number
  avgTicket: number
  tags: string[]
  firstContact: number
  lastContact: number
  firstPurchase?: number
  lastPurchase?: number
}

interface TimelineEvent {
  id: string
  type: string
  title: string
  desc: string
  amount: number | null
  dt: number
}

interface CustFilters {
  search: string
  status: string
  origin: string
  tag: string
  period: string
}

/* ── mapRaw ───────────────────────────────────────────────── */

function buildAvatar(name: string): string {
  const parts = (name || 'U').trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

function mapRaw(row: RawContact): Customer {
  return {
    id: row.id,
    name: row.name || 'Sem nome',
    username: row.username ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    origin: row.origin ?? '',
    bot: row.bot ?? '',
    status: Number(row.purchases ?? 0) > 0 ? 'buyer' : 'lead',
    purchases: Number(row.purchases ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
    avgTicket: Number(row.avg_ticket ?? 0),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    firstContact: row.first_contact ? new Date(row.first_contact).getTime() : Date.now(),
    lastContact: row.last_contact ? new Date(row.last_contact).getTime() : Date.now(),
    firstPurchase: row.first_purchase ? new Date(row.first_purchase).getTime() : undefined,
    lastPurchase: row.last_purchase ? new Date(row.last_purchase).getTime() : undefined,
  }
}

/* ── Formatters ───────────────────────────────────────────── */

const TZ = 'America/Sao_Paulo'
const fmtNum = (v: number) => v.toLocaleString('pt-BR')
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
const fmtDate = (dt: number | string) =>
  new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
const fmtDateTime = (dt: number | string) =>
  new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })

function relTime(dt: number): string {
  const diff = Date.now() - dt
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

function getPeriodCutoff(period: string): number | null {
  const map: Record<string, number> = {
    '7d': 7, '30d': 30, '90d': 90,
  }
  const days = map[period]
  return days ? Date.now() - days * 86_400_000 : null
}

/* ── localStorage helper ──────────────────────────────────── */

const LS_PREFIX = 'umbra_cust_'
const LS = {
  get: (k: string) => { try { return typeof window !== 'undefined' ? localStorage.getItem(LS_PREFIX + k) : null } catch { return null } },
  set: (k: string, v: string) => { try { if (typeof window !== 'undefined') localStorage.setItem(LS_PREFIX + k, v) } catch {} },
  del: (k: string) => { try { if (typeof window !== 'undefined') localStorage.removeItem(LS_PREFIX + k) } catch {} },
}

/* ── Constants ────────────────────────────────────────────── */

const PAGE_SIZE = 25
const CONTACTS_SELECT = 'id, name, username, email, phone, origin, bot, bot_id, purchases, total_spent, avg_ticket, tags, first_contact, last_contact, first_purchase, last_purchase'

const statusOptions = ['Todos os status', 'Comprou', 'Não comprou']
const periodOptions = [
  { value: 'all', label: 'Sempre' },
  { value: '7d',  label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
]

const defaultFilters: CustFilters = {
  search: '', status: 'Todos os status', origin: 'Todas as origens',
  tag: 'Todas as tags', period: 'all',
}

/* ── UI Atoms ─────────────────────────────────────────────── */

const AVATAR_COLORS: [string, string][] = [
  ['var(--primary)', '#fff'],
  ['var(--success)', '#fff'],
  ['var(--warning)', '#fff'],
  ['var(--danger)', '#fff'],
]

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const ini = buildAvatar(name)
  const seed = name.charCodeAt(0) + name.length
  const [bg, fg] = AVATAR_COLORS[seed % AVATAR_COLORS.length]
  return (
    <span className="inline-flex items-center justify-center rounded-md font-semibold shrink-0"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.40 }}>
      {ini}
    </span>
  )
}

const toneClasses: Record<string, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger',
  primary: 'bg-primary-soft text-primary',
  muted:   'bg-surface-2 text-text-muted',
  info:    'bg-primary-soft text-primary',
}

function Badge({ tone = 'muted', children }: { tone?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium', toneClasses[tone] ?? toneClasses.muted)}>
      {children}
    </span>
  )
}

function Btn({ variant = 'secondary', size = 'md', icon: Ico, children, onClick, disabled, className, type = 'button' }: {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  icon?: LucideIcon
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cn(
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

function Dropdown({ icon: Ico, label, value, options, onChange, width }: {
  icon?: LucideIcon; label: string; value: string; options: string[]
  onChange: (v: string) => void; width?: number
}) {
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

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium text-text-muted mb-1">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      disabled={disabled}
      className="w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-60" />
  )
}

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30 cursor-pointer accent-primary" />
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages = useMemo(() => {
    if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const around = [page - 1, page, page + 1].filter(p => p >= 1 && p <= totalPages)
    return [...new Set([1, ...around, totalPages])].sort((a, b) => a - b)
  }, [page, totalPages])

  return (
    <div className="flex items-center gap-0.5">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed">
        <ChevronLeft size={14} />
      </button>
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && pages[i - 1] !== p - 1 && <span className="text-text-subtle px-1 text-[11px]">…</span>}
          <button onClick={() => onChange(p)} className={cn(
            'min-w-[32px] h-8 px-2 text-[12px] font-medium rounded-md tnum',
            p === page ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-surface-2 hover:text-text',
          )}>{p}</button>
        </React.Fragment>
      ))}
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

/* ── FilterBar ────────────────────────────────────────────── */

function FilterBar({ filters, setFilters, hasFilters, onClear, originOptions, tagOptions, onFilterChange }: {
  filters: CustFilters
  setFilters: React.Dispatch<React.SetStateAction<CustFilters>>
  hasFilters: boolean
  onClear: () => void
  originOptions: string[]
  tagOptions: string[]
  onFilterChange: (patch: Partial<CustFilters>) => void
}) {
  const [searchInput, setSearchInput] = useState(filters.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(v: string) {
    setSearchInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onFilterChange({ search: v }), 300)
  }

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  const periodLabel = periodOptions.find(p => p.value === filters.period)?.label ?? 'Sempre'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input type="text" value={searchInput} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, usuário ou e-mail…"
          className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
      </div>
      <Dropdown icon={CheckCircle} label="Status" value={filters.status}
        options={statusOptions}
        onChange={(v) => onFilterChange({ status: v })} />
      <Dropdown icon={Compass} label="Origem" value={filters.origin}
        options={['Todas as origens', ...originOptions]}
        onChange={(v) => onFilterChange({ origin: v })}
        width={200} />
      <Dropdown icon={Tag} label="Tag" value={filters.tag}
        options={['Todas as tags', ...tagOptions]}
        onChange={(v) => onFilterChange({ tag: v })} />
      <Dropdown icon={Calendar} label="Período" value={periodLabel}
        options={periodOptions.map(p => p.label)}
        onChange={(label) => {
          const p = periodOptions.find(o => o.label === label)?.value ?? 'all'
          onFilterChange({ period: p })
        }} />
      {hasFilters && (
        <button onClick={onClear}
          className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2">
          <X size={13} />
          Limpar
        </button>
      )}
    </div>
  )
}

/* ── BulkActionsBar + AddTagPopover ───────────────────────── */

function AddTagPopover({ open, onClose, onAdd, tagOptions }: {
  open: boolean; onClose: () => void; onAdd: (t: string) => void; tagOptions: string[]
}) {
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
    <div ref={ref} className="absolute right-0 top-full mt-1.5 w-[240px] bg-surface border border-border rounded-xl p-1.5 z-50"
      style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle px-2 pt-1 pb-1.5">Tags</div>
      {tagOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1 pb-1.5">
          {tagOptions.map((t) => (
            <button key={t} onClick={() => { onAdd(t); onClose() }}
              className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text hover:border-primary hover:text-primary">
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="h-px bg-border my-1" />
      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); onClose(); setInput('') } }}
        className="flex items-center gap-1 p-1">
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nova tag…"
          className="flex-1 h-7 px-2 bg-surface-2 border border-border rounded-md text-[12px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button type="submit"
          className="h-7 px-2 text-[11.5px] font-medium bg-primary text-primary-fg rounded-md hover:opacity-90">Criar</button>
      </form>
    </div>
  )
}

function BulkActionsBar({ count, onAddTag, onExport, onClear, toast }: {
  count: number; onAddTag: () => void; onExport: () => void; onClear: () => void; toast: string
}) {
  return (
    <div className="mb-3 bg-primary-soft border border-primary/30 rounded-xl px-3.5 py-2 flex items-center gap-3">
      <div className="text-[12.5px] font-medium text-primary tnum">
        {count} {count === 1 ? 'cliente selecionado' : 'clientes selecionados'}
      </div>
      <div className="flex-1" />
      {toast && (
        <span className="text-[11.5px] text-text-muted flex items-center gap-1 mr-2">
          <CheckCircle2 size={11} className="text-success" />
          {toast}
        </span>
      )}
      <Btn size="sm" icon={Tag} onClick={onAddTag}>Adicionar tag</Btn>
      <Btn size="sm" icon={Download} onClick={onExport}>Exportar</Btn>
      <button onClick={onClear}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
        title="Cancelar seleção">
        <X size={14} />
      </button>
    </div>
  )
}

/* ── CustomerRow ──────────────────────────────────────────── */

const statusMap = {
  buyer: { label: 'Comprou',     tone: 'success' },
  lead:  { label: 'Não comprou', tone: 'muted'   },
}

function CustomerRow({ c, selected, onToggleSelect, onOpen }: {
  c: Customer; selected: boolean; onToggleSelect: () => void; onOpen: () => void
}) {
  const s = statusMap[c.status]
  return (
    <tr onClick={onOpen}
      className={cn('border-t border-border cursor-pointer transition-colors',
        selected ? 'bg-primary-soft/40' : 'hover:bg-surface-2/60')}>
      <td className="pl-4 pr-2 py-2.5 w-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onToggleSelect} />
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={c.name} size={32} />
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-text truncate">{c.name}</div>
            <div className="text-[11px] text-text-muted tnum truncate">{c.username || c.email || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5 text-[12px] text-text-muted whitespace-nowrap">
        {c.origin || <span className="text-text-subtle">—</span>}
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <Badge tone={s.tone}>
          {c.status === 'buyer' && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
          {s.label}
        </Badge>
      </td>
      <td className="px-2 py-2.5 text-right text-[12.5px] tnum text-text whitespace-nowrap">
        {c.purchases || <span className="text-text-subtle">—</span>}
      </td>
      <td className="px-2 py-2.5 text-right text-[12.5px] tnum font-semibold text-text whitespace-nowrap">
        {c.totalSpent > 0 ? fmtBRL(c.totalSpent) : <span className="text-text-subtle font-normal">—</span>}
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <div className="text-[11.5px] text-text-muted tnum">{relTime(c.lastContact)}</div>
      </td>
      <td className="pl-2 pr-4 py-2.5 w-10">
        <ChevronRight size={14} className="text-text-muted" />
      </td>
    </tr>
  )
}

/* ── NoDataState ──────────────────────────────────────────── */

function NoDataState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
        <UserSearch size={22} />
      </div>
      <div className="text-[15px] font-semibold text-text">Nenhum cliente ainda</div>
      <div className="text-[12.5px] text-text-muted mt-1 max-w-xs mb-4">
        Os contatos aparecerão aqui conforme os bots receberem mensagens ou você adicionar manualmente.
      </div>
      <Btn variant="primary" icon={UserPlus} onClick={onAdd}>Adicionar cliente</Btn>
    </div>
  )
}

function EmptyFilter() {
  return (
    <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-3">
        <UserSearch size={18} />
      </div>
      <div className="text-[13px] font-medium text-text">Nenhum cliente encontrado</div>
      <div className="text-[12px] text-text-muted mt-1">Ajuste os filtros para ver mais resultados.</div>
    </div>
  )
}

/* ── CustomersTable — sort types ──────────────────────────── */

type SortField = 'name' | 'origin' | 'status' | 'purchases' | 'totalSpent' | 'lastContact'
type SortDir   = 'asc' | 'desc'

const SORT_LS_KEY = 'sort'

function sortCustomers(data: Customer[], field: SortField, dir: SortDir): Customer[] {
  return [...data].sort((a, b) => {
    let cmp = 0
    if (field === 'name')        cmp = a.name.localeCompare(b.name, 'pt-BR')
    else if (field === 'origin') cmp = (a.origin || '').localeCompare(b.origin || '', 'pt-BR')
    else if (field === 'status') cmp = a.status.localeCompare(b.status)
    else if (field === 'purchases')  cmp = a.purchases  - b.purchases
    else if (field === 'totalSpent') cmp = a.totalSpent - b.totalSpent
    else if (field === 'lastContact') cmp = a.lastContact - b.lastContact
    return dir === 'asc' ? cmp : -cmp
  })
}

function SortIcon({ field, active, dir }: { field: SortField; active: SortField; dir: SortDir }) {
  if (field !== active) return <ChevronsUpDown size={11} className="opacity-30 ml-0.5" />
  return dir === 'asc'
    ? <ArrowUp size={11} className="text-primary ml-0.5" />
    : <ArrowDown size={11} className="text-primary ml-0.5" />
}

/* ── CustomersTable ───────────────────────────────────────── */

function CustomersTable({ data, selected, setSelected, onOpenCustomer, totalLoaded, totalCount, hasMore, loadingMore, onLoadMore, onAdd }: {
  data: Customer[]
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  onOpenCustomer: (id: string) => void
  totalLoaded: number
  totalCount: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onAdd: () => void
}) {
  const [page, setPage]         = useState(1)
  const [sortField, setSortField] = useState<SortField>(() => (LS.get(SORT_LS_KEY) as SortField) ?? 'lastContact')
  const [sortDir,   setSortDir]   = useState<SortDir>(() => (LS.get(SORT_LS_KEY + '_dir') as SortDir) ?? 'desc')

  const perPage    = 10
  const sortedData = useMemo(() => sortCustomers(data, sortField, sortDir), [data, sortField, sortDir])
  const totalPages = Math.max(1, Math.ceil(sortedData.length / perPage))
  const safePage   = Math.min(page, totalPages)
  const start      = (safePage - 1) * perPage
  const pageItems  = sortedData.slice(start, start + perPage)

  useEffect(() => { setPage(1) }, [data.length, sortField, sortDir])

  function toggleSort(field: SortField) {
    const nextDir: SortDir = sortField === field && sortDir === 'desc' ? 'asc' : 'desc'
    setSortField(field)
    setSortDir(nextDir)
    LS.set(SORT_LS_KEY, field)
    LS.set(SORT_LS_KEY + '_dir', nextDir)
  }

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

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <EmptyFilter />
      </div>
    )
  }

  function SortTh({ field, children, align = 'left' }: { field: SortField; children: React.ReactNode; align?: 'left' | 'right' }) {
    const active = sortField === field
    return (
      <th className={cn('font-semibold px-2 py-2.5', align === 'right' ? 'text-right' : 'text-left')}>
        <button
          onClick={() => toggleSort(field)}
          className={cn(
            'inline-flex items-center gap-0.5 rounded transition-colors hover:text-text',
            active ? 'text-primary' : 'text-text-subtle',
          )}
        >
          {children}
          <SortIcon field={field} active={sortField} dir={sortDir} />
        </button>
      </th>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {hasMore && (
        <div className="px-5 py-2.5 border-b border-border bg-surface-2/40 flex items-center gap-3 text-[12px] text-text-muted">
          <span className="tnum">{fmtNum(totalLoaded)} de {fmtNum(totalCount)} carregados</span>
          <button onClick={onLoadMore} disabled={loadingMore}
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:opacity-80 disabled:opacity-60">
            {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
            {loadingMore ? 'Carregando…' : 'Carregar mais →'}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] border-collapse min-w-[880px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider bg-surface-2/40 select-none">
              <th className="pl-4 pr-2 py-2.5 w-10">
                <Checkbox checked={allOnPageSelected} indeterminate={someOnPageSelected && !allOnPageSelected} onChange={togglePage} />
              </th>
              <SortTh field="name">Cliente</SortTh>
              <SortTh field="origin">Origem</SortTh>
              <SortTh field="status">Status</SortTh>
              <SortTh field="purchases" align="right">Compras</SortTh>
              <SortTh field="totalSpent" align="right">Total gasto</SortTh>
              <SortTh field="lastContact">Último contato</SortTh>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c) => (
              <CustomerRow key={c.id} c={c} selected={selected.has(c.id)}
                onToggleSelect={() => toggleOne(c.id)} onOpen={() => onOpenCustomer(c.id)} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11.5px] text-text-muted tnum">
          Mostrando{' '}
          <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, sortedData.length)}</span>{' '}
          de <span className="text-text font-medium">{fmtNum(sortedData.length)}</span>
          {selected.size > 0 && <> · <span className="text-primary">{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span></>}
        </div>
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  )
}

/* ── Timeline in ProfilePanel ─────────────────────────────── */

const timelineMeta: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  sale:         { icon: ShoppingBag,   tone: 'success', label: 'Venda'                },
  payment:      { icon: CheckCircle2,  tone: 'success', label: 'Pagamento'            },
  lead:         { icon: MessageCircle, tone: 'info',    label: 'Conversa iniciada'    },
  refund:       { icon: Undo2,         tone: 'danger',  label: 'Reembolso'            },
  cancellation: { icon: PackageX,      tone: 'warning', label: 'Cancelamento'         },
  disconnect:   { icon: WifiOff,       tone: 'danger',  label: 'Bot desconectado'     },
  reconnect:    { icon: Wifi,          tone: 'success', label: 'Bot reconectado'      },
  newBot:       { icon: Bot,           tone: 'info',    label: 'Novo bot'             },
  flowPublished:{ icon: GitBranch,     tone: 'info',    label: 'Fluxo publicado'      },
  cart:         { icon: ShoppingCart,  tone: 'info',    label: 'Adicionou ao carrinho'},
  abandon:      { icon: PackageX,      tone: 'warning', label: 'Carrinho abandonado'  },
}
const defaultMeta = { icon: Activity, tone: 'muted', label: 'Evento' }

function TimelineItem({ event }: { event: TimelineEvent }) {
  const meta = timelineMeta[event.type] ?? defaultMeta
  const Ico = meta.icon
  const tones = toneClasses[meta.tone] ?? toneClasses.muted
  return (
    <div className="relative pl-10 py-2">
      <div className={cn('absolute left-0 top-2 w-7 h-7 rounded-md flex items-center justify-center', tones)}
        style={{ boxShadow: '0 0 0 4px var(--surface)' }}>
        <Ico size={13} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">{meta.label}</div>
          <div className="text-[12.5px] text-text font-medium mt-0.5 leading-snug">{event.title}</div>
          {event.desc && event.desc !== event.title && (
            <div className="text-[11.5px] text-text-muted mt-0.5">{event.desc}</div>
          )}
          {event.amount != null && event.amount > 0 && (
            <div className="text-[11.5px] text-success tnum mt-0.5">{fmtBRL(event.amount)}</div>
          )}
        </div>
        <time className="text-[10.5px] text-text-muted tnum shrink-0" title={fmtDateTime(event.dt)}>
          {relTime(event.dt)}
        </time>
      </div>
    </div>
  )
}

/* ── ProfilePanel ─────────────────────────────────────────── */

function ProfilePanel({ customer, open, onClose, onUpdate }: {
  customer: Customer | null
  open: boolean
  onClose: () => void
  onUpdate: (id: string, patch: { tags: string[] }) => void
}) {
  const [tab, setTab] = useState<'timeline' | 'purchases'>('timeline')
  const [addingTag, setAddingTag] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => {
    if (open) { setTab('timeline'); setTimeline([]) }
  }, [open, customer?.id])

  // Load timeline lazily
  useEffect(() => {
    if (!open || !customer?.id) return
    setTimelineLoading(true)
    const supabase = createClient()
    supabase
      .from('activity_events')
      .select('id, type, title, description, amount, created_at')
      .eq('contact_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setTimeline(
          (data ?? []).map((r) => ({
            id: String(r.id),
            type: String(r.type),
            title: String(r.title ?? ''),
            desc: String(r.description ?? ''),
            amount: r.amount != null ? Number(r.amount) : null,
            dt: new Date(String(r.created_at)).getTime(),
          }))
        )
        setTimelineLoading(false)
      })
  }, [open, customer?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!customer) return null

  const purchaseEvents = timeline.filter(e => e.type === 'sale' || e.type === 'payment')
  const items = tab === 'timeline' ? timeline : purchaseEvents

  return (
    <>
      <div className={cn('fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose} />
      <aside className={cn('fixed right-0 inset-y-0 z-50 w-full md:w-[480px] bg-surface border-l border-border flex flex-col transition-transform duration-200', open ? 'translate-x-0' : 'translate-x-full')}
        style={{ boxShadow: 'var(--shadow-xl)' }}
        role="dialog" aria-modal="true">

        {/* Header */}
        <header className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3 mb-4">
            <Avatar name={customer.name} size={48} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold text-text leading-tight truncate">{customer.name}</h2>
              <div className="text-[12px] text-text-muted tnum truncate">{customer.username || customer.email || '—'}</div>
              <div className="mt-1">
                <Badge tone={statusMap[customer.status].tone}>
                  {customer.status === 'buyer' && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                  {statusMap[customer.status].label}
                </Badge>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text shrink-0"
              title="Fechar">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
            {customer.email && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail size={11} className="text-text-subtle shrink-0" />
                <span className="text-text truncate">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Phone size={11} className="text-text-subtle shrink-0" />
                <span className="text-text tnum truncate">{customer.phone}</span>
              </div>
            )}
            {customer.origin && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Compass size={11} className="text-text-subtle shrink-0" />
                <span className="text-text truncate">{customer.origin}</span>
              </div>
            )}
            {customer.bot && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Bot size={11} className="text-text-subtle shrink-0" />
                <span className="text-text tnum truncate">{customer.bot}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar size={11} className="text-text-subtle shrink-0" />
              <span className="text-text-muted shrink-0">Primeiro contato:</span>
              <span className="text-text">{fmtDate(customer.firstContact)}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock size={11} className="text-text-subtle shrink-0" />
              <span className="text-text-muted shrink-0">Último:</span>
              <span className="text-text">{relTime(customer.lastContact)}</span>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Tags */}
          <section className="px-5 py-4 border-b border-border">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2.5">Tags</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {customer.tags.length === 0 && !addingTag && (
                <span className="text-[12px] text-text-muted">Nenhuma tag.</span>
              )}
              {customer.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md bg-primary-soft text-primary text-[11.5px] font-medium border border-primary/20">
                  {t}
                  <button onClick={() => onUpdate(customer.id, { tags: customer.tags.filter(x => x !== t) })}
                    className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-sm hover:bg-primary/20" title="Remover tag">
                    <X size={10} />
                  </button>
                </span>
              ))}
              {addingTag ? (
                <form onSubmit={(e) => {
                  e.preventDefault()
                  if (tagInput.trim() && !customer.tags.includes(tagInput.trim())) {
                    onUpdate(customer.id, { tags: [...customer.tags, tagInput.trim()] })
                    setTagInput(''); setAddingTag(false)
                  }
                }} className="inline-flex items-center gap-1">
                  <input autoFocus value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onBlur={() => { if (!tagInput.trim()) setAddingTag(false) }}
                    placeholder="Nova tag"
                    className="h-7 px-2 bg-surface-2 border border-primary/40 rounded-md text-[11.5px] text-text focus:outline-none w-28" />
                  <button type="submit"
                    className="h-7 px-2 text-[11px] font-medium bg-primary text-primary-fg rounded-md hover:opacity-90">OK</button>
                </form>
              ) : (
                <button onClick={() => setAddingTag(true)}
                  className="h-7 px-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-text-muted bg-surface border border-dashed border-border rounded-md hover:bg-surface-2 hover:text-text">
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
              {[
                { label: 'Total gasto',     value: fmtBRL(customer.totalSpent), emphasize: true },
                { label: 'Ticket médio',    value: customer.purchases > 0 ? fmtBRL(customer.avgTicket) : '—' },
                { label: 'Primeira compra', value: customer.firstPurchase ? fmtDate(customer.firstPurchase) : '—' },
                { label: 'Última compra',   value: customer.lastPurchase  ? fmtDate(customer.lastPurchase)  : '—' },
              ].map(({ label, value, emphasize }) => (
                <div key={label} className={cn('p-3 rounded-lg border', emphasize ? 'bg-success-soft border-success/20' : 'bg-surface-2/50 border-border')}>
                  <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{label}</div>
                  <div className={cn('text-[15px] font-semibold tnum tracking-tight mt-1', emphasize ? 'text-success' : 'text-text')}>{value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section className="px-5 py-4">
            <div className="flex items-center gap-0.5 border-b border-border -mx-1 mb-3">
              {([
                { id: 'timeline', label: 'Linha do tempo', Ico: Activity, count: timeline.length },
                { id: 'purchases', label: 'Compras', Ico: ShoppingBag, count: purchaseEvents.length },
              ] as const).map(({ id, label, Ico, count }) => (
                <button key={id} onClick={() => setTab(id as 'timeline' | 'purchases')}
                  className={cn('inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-t-md -mb-px border-b-2 transition-colors',
                    tab === id ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text')}>
                  <Ico size={14} />
                  {label}
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md min-w-[20px] text-center tnum',
                    tab === id ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted')}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
            {timelineLoading ? (
              <div className="flex items-center justify-center py-8 text-text-muted">
                <Loader2 size={18} className="animate-spin mr-2" /> Carregando…
              </div>
            ) : items.length === 0 ? (
              <div className="text-[12px] text-text-muted py-4 text-center">
                {tab === 'purchases' ? 'Nenhuma compra registrada.' : 'Nenhum evento registrado.'}
              </div>
            ) : (
              <div className="relative pb-2">
                <div className="absolute left-[14px] top-2 bottom-2 w-px bg-border" />
                {items.map((e) => <TimelineItem key={e.id} event={e} />)}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-border bg-surface-2/40 flex items-center justify-between gap-2">
          <div className="text-[11px] text-text-subtle tnum">
            Desde {fmtDate(customer.firstContact)}
          </div>
          <div className="flex gap-2">
            {customer.email && (
              <Btn size="sm" icon={Mail} onClick={() => window.location.href = `mailto:${customer.email}`}>
                E-mail
              </Btn>
            )}
            <Btn variant="primary" size="sm" icon={MessageCircle}>Mensagem</Btn>
          </div>
        </footer>
      </aside>
    </>
  )
}

/* ── AddCustomerModal ─────────────────────────────────────── */

interface AddCustomerForm {
  name: string; username: string; email: string; phone: string; origin: string; botId: string
}

function AddCustomerModal({ open, onClose, bots, originOptions, onSuccess }: {
  open: boolean
  onClose: () => void
  bots: ContactBotOption[]
  originOptions: string[]
  onSuccess: (raw: RawContact) => void
}) {
  const emptyForm: AddCustomerForm = { name: '', username: '', email: '', phone: '', origin: '', botId: '' }
  const [form, setForm] = useState<AddCustomerForm>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setForm(emptyForm); setError('') }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function patch(p: Partial<AddCustomerForm>) { setForm(f => ({ ...f, ...p }) ) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Sessão expirada. Faça login novamente.'); return }

      const row = {
        user_id:     user.id,
        name:        form.name.trim(),
        username:    form.username.trim() || null,
        email:       form.email.trim() || null,
        phone:       form.phone.trim() || null,
        origin:      form.origin.trim() || null,
        bot_id:      form.botId || null,
        purchases:   0,
        total_spent: 0,
        avg_ticket:  0,
        tags:        [] as string[],
        status:      'new',
      }
      const { data, error: err } = await supabase.from('contacts').insert(row).select(
        'id, name, username, email, phone, origin, bot, bot_id, purchases, total_spent, avg_ticket, tags, first_contact, last_contact, first_purchase, last_purchase'
      ).single()
      if (err) { setError(err.message); return }
      onSuccess(data as unknown as RawContact)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-2xl w-full max-w-md"
          style={{ boxShadow: 'var(--shadow-xl)' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
            <h2 className="text-[16px] font-semibold text-text">Adicionar cliente</h2>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2">
              <X size={15} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <Field label="Nome" required>
              <Input value={form.name} onChange={v => patch({ name: v })} placeholder="João Silva" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username (Telegram)">
                <Input value={form.username} onChange={v => patch({ username: v })} placeholder="@joao" />
              </Field>
              <Field label="Telefone">
                <Input value={form.phone} onChange={v => patch({ phone: v })} placeholder="+55 11 99999-0000" />
              </Field>
            </div>
            <Field label="E-mail">
              <Input value={form.email} onChange={v => patch({ email: v })} placeholder="joao@email.com" type="email" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Origem">
                <div className="relative">
                  <input list="origin-opts" value={form.origin} onChange={e => patch({ origin: e.target.value })}
                    placeholder="Ex: Instagram Ads"
                    className="w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <datalist id="origin-opts">
                    {originOptions.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>
              </Field>
              <Field label="Bot">
                <select value={form.botId} onChange={e => patch({ botId: e.target.value })}
                  className="w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none">
                  <option value="">Nenhum</option>
                  {bots.map(b => <option key={b.id} value={b.id}>{b.username ? `@${b.username}` : b.name}</option>)}
                </select>
              </Field>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-[12px] text-danger bg-danger-soft px-3 py-2 rounded-lg">
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Btn onClick={onClose} className="flex-1">Cancelar</Btn>
              <Btn variant="primary" type="submit" disabled={loading} icon={loading ? Loader2 : UserPlus} className="flex-1">
                {loading ? 'Salvando…' : 'Adicionar'}
              </Btn>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ── ImportCSVModal ───────────────────────────────────────── */

function parseCSVRows(text: string): string[][] {
  return text.trim().split(/\r?\n/).map(line => {
    const cells: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    cells.push(cur.trim())
    return cells
  })
}

function ImportCSVModal({ open, onClose, bots, onSuccess }: {
  open: boolean; onClose: () => void; bots: ContactBotOption[]; onSuccess: (count: number) => void
}) {
  const [preview, setPreview] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [allRows, setAllRows] = useState<string[][]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setPreview([]); setHeaders([]); setAllRows([]); setResult(null); setError('') }
  }, [open])

  function handleFile(file: File | null) {
    if (!file) return
    if (!file.name.endsWith('.csv')) { setError('Selecione um arquivo .csv'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSVRows(text)
      if (rows.length < 2) { setError('Arquivo vazio ou sem dados.'); return }
      setHeaders(rows[0])
      setAllRows(rows.slice(1).filter(r => r.some(c => c.trim())))
      setPreview(rows.slice(1, 4))
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (!allRows.length) return
    setImporting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sessão expirada.'); setImporting(false); return }

    const nameIdx   = headers.findIndex(h => h.toLowerCase().includes('nome'))
    const userIdx   = headers.findIndex(h => h.toLowerCase().includes('username') || h.toLowerCase().includes('usuário'))
    const emailIdx  = headers.findIndex(h => h.toLowerCase().includes('e-mail') || h.toLowerCase().includes('email'))
    const phoneIdx  = headers.findIndex(h => h.toLowerCase().includes('telefone') || h.toLowerCase().includes('phone'))
    const originIdx = headers.findIndex(h => h.toLowerCase().includes('origem'))
    const tagsIdx   = headers.findIndex(h => h.toLowerCase().includes('tag'))

    const valid = allRows.filter(r => nameIdx >= 0 && r[nameIdx]?.trim())
    const rows = valid.map(r => ({
      user_id:     user.id,
      name:        r[nameIdx]?.trim() ?? '',
      username:    userIdx >= 0 ? (r[userIdx]?.trim() || null) : null,
      email:       emailIdx >= 0 ? (r[emailIdx]?.trim() || null) : null,
      phone:       phoneIdx >= 0 ? (r[phoneIdx]?.trim() || null) : null,
      origin:      originIdx >= 0 ? (r[originIdx]?.trim() || null) : null,
      tags:        tagsIdx >= 0 ? r[tagsIdx]?.split(';').map(t => t.trim()).filter(Boolean) : [],
      purchases:   0,
      total_spent: 0,
      avg_ticket:  0,
      status:      'new',
    }))

    let imported = 0, errors = 0
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: err } = await supabase.from('contacts').insert(rows.slice(i, i + BATCH))
      if (err) errors += Math.min(BATCH, rows.length - i)
      else imported += Math.min(BATCH, rows.length - i)
    }
    setResult({ imported, errors })
    setImporting(false)
    if (imported > 0) onSuccess(imported)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-2xl w-full max-w-lg"
          style={{ boxShadow: 'var(--shadow-xl)' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
            <div>
              <h2 className="text-[16px] font-semibold text-text">Importar clientes via CSV</h2>
              <p className="text-[12px] text-text-muted mt-0.5">
                Colunas: <span className="font-medium text-text">Nome*</span>, Username, E-mail, Telefone, Origem, Tags (separar por ;)
              </p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2">
              <X size={15} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            {!result ? (
              <>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => handleFile(e.target.files?.[0] ?? null)} />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-text-muted hover:border-primary hover:text-primary transition-colors">
                  <Upload size={20} />
                  <span className="text-[12.5px]">
                    {allRows.length > 0 ? `${allRows.length} linha${allRows.length === 1 ? '' : 's'} detectada${allRows.length === 1 ? '' : 's'}` : 'Clique para selecionar o arquivo .csv'}
                  </span>
                </button>

                {preview.length > 0 && (
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2">
                      Pré-visualização (primeiras {preview.length} linhas)
                    </div>
                    <div className="overflow-x-auto border border-border rounded-lg">
                      <table className="w-full text-[11px]">
                        <thead className="bg-surface-2/60">
                          <tr>
                            {headers.map((h, i) => (
                              <th key={i} className="px-2 py-1.5 text-left font-semibold text-text-subtle whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, i) => (
                            <tr key={i} className="border-t border-border">
                              {row.map((cell, j) => (
                                <td key={j} className="px-2 py-1.5 text-text-muted truncate max-w-[120px]">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-[12px] text-danger bg-danger-soft px-3 py-2 rounded-lg">
                    <AlertCircle size={13} /> {error}
                  </div>
                )}
                <div className="flex gap-2">
                  <Btn onClick={onClose} className="flex-1">Cancelar</Btn>
                  <Btn variant="primary" disabled={!allRows.length || importing} onClick={handleImport}
                    icon={importing ? Loader2 : Upload} className="flex-1">
                    {importing ? 'Importando…' : `Importar ${allRows.length} contato${allRows.length === 1 ? '' : 's'}`}
                  </Btn>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3',
                  result.errors === 0 ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
                  <CheckCircle2 size={24} />
                </div>
                <div className="text-[15px] font-semibold text-text mb-1">
                  {result.imported} cliente{result.imported === 1 ? '' : 's'} importado{result.imported === 1 ? '' : 's'}
                </div>
                {result.errors > 0 && (
                  <div className="text-[12px] text-warning">{result.errors} linha{result.errors === 1 ? '' : 's'} com erro foram ignoradas.</div>
                )}
                <Btn variant="primary" onClick={onClose} className="mt-4">Fechar</Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Main CustomersClient ─────────────────────────────────── */

export default function CustomersClient({
  initialContacts, bots, totalCount: totalCountProp, buyersCount: buyersCountProp,
  leadsCount: leadsCountProp, originOptions, hasMore: hasMoreProp,
}: {
  initialContacts: RawContact[]
  bots: ContactBotOption[]
  totalCount: number
  buyersCount: number
  leadsCount: number
  originOptions: string[]
  hasMore: boolean
}) {
  const { track } = useAnalytics()

  // ── State
  const [customers, setCustomers] = useState<Customer[]>(() => initialContacts.map(mapRaw))
  const [totalCount, setTotalCount] = useState(totalCountProp)
  const [buyersCount, setBuyersCount] = useState(buyersCountProp)
  const [leadsCount, setLeadsCount] = useState(leadsCountProp)
  const [dbOffset, setDbOffset] = useState(initialContacts.length)
  const [hasMore, setHasMore] = useState(hasMoreProp)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null)
  const [addTagOpen, setAddTagOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)

  // ── Filters (persisted in localStorage)
  const [filters, setFilters] = useState<CustFilters>(() => ({
    search: LS.get('search')   ?? '',
    status: LS.get('status')   ?? 'Todos os status',
    origin: LS.get('origin')   ?? 'Todas as origens',
    tag:    LS.get('tag')      ?? 'Todas as tags',
    period: LS.get('period')   ?? 'all',
  }))

  function handleFilterChange(patch: Partial<CustFilters>) {
    setFilters(f => {
      const next = { ...f, ...patch }
      if ('search' in patch) LS.set('search', patch.search ?? '')
      if ('status' in patch) LS.set('status', patch.status ?? defaultFilters.status)
      if ('origin' in patch) LS.set('origin', patch.origin ?? defaultFilters.origin)
      if ('tag'    in patch) LS.set('tag',    patch.tag    ?? defaultFilters.tag)
      if ('period' in patch) LS.set('period', patch.period ?? 'all')
      track('customer_filter_changed', {
        status: next.status,
        origin_filtered: next.origin !== 'Todas as origens',
        tag_filtered: next.tag !== 'Todas as tags',
        period: next.period,
      })
      return next
    })
  }

  function handleClear() {
    setFilters(defaultFilters)
    LS.del('search'); LS.del('status'); LS.del('origin'); LS.del('tag'); LS.del('period')
  }

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(defaultFilters)

  // ── Derived option lists from loaded contacts
  const allOriginOptions = useMemo(() => {
    const fromContacts = customers.map(c => c.origin).filter(Boolean)
    return [...new Set([...originOptions, ...fromContacts])].sort()
  }, [customers, originOptions])

  const allTagOptions = useMemo(() => {
    return [...new Set(customers.flatMap(c => c.tags))].sort()
  }, [customers])

  // ── Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' },
        (payload) => {
          const raw = payload.new as unknown as RawContact
          setCustomers(prev => [mapRaw(raw), ...prev])
          setTotalCount(n => n + 1)
          setLeadsCount(n => n + 1)
          setDbOffset(o => o + 1)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts' },
        (payload) => {
          const raw = payload.new as unknown as RawContact
          setCustomers(prev => prev.map(c => c.id === raw.id ? mapRaw(raw) : c))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Load more
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select(CONTACTS_SELECT)
      .order('last_contact', { ascending: false })
      .range(dbOffset, dbOffset + PAGE_SIZE - 1)
    if (data && data.length > 0) {
      setCustomers(prev => [...prev, ...(data as unknown as RawContact[]).map(mapRaw)])
      setDbOffset(o => o + data.length)
      setHasMore(data.length >= PAGE_SIZE)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }, [dbOffset])

  // ── Filter
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const cutoff = getPeriodCutoff(filters.period)
    return customers.filter((c) => {
      if (q && !(
        c.name.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      )) return false
      if (filters.status === 'Comprou'     && c.status !== 'buyer') return false
      if (filters.status === 'Não comprou' && c.status !== 'lead')  return false
      if (filters.origin !== 'Todas as origens' && c.origin !== filters.origin) return false
      if (filters.tag    !== 'Todas as tags'    && !c.tags.includes(filters.tag)) return false
      if (cutoff && c.lastContact < cutoff) return false
      return true
    })
  }, [customers, filters])

  // ── Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Update single customer tags
  async function updateCustomer(id: string, patch: { tags: string[] }) {
    setCustomers(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))
    const supabase = createClient()
    const { error } = await supabase.from('contacts').update({ tags: patch.tags }).eq('id', id)
    if (error) setToast('Erro ao salvar tag.')
  }

  // ── Bulk add tag via RPC
  async function bulkAddTag(tag: string) {
    const ids = Array.from(selected)
    setCustomers(cs => cs.map(c => {
      if (!selected.has(c.id) || c.tags.includes(tag)) return c
      return { ...c, tags: [...c.tags, tag] }
    }))
    setToast(`Tag "${tag}" adicionada a ${ids.length} cliente${ids.length === 1 ? '' : 's'}.`)
    const supabase = createClient()
    await supabase.rpc('contacts_bulk_add_tag', { p_ids: ids, p_tag: tag })
    track('customer_tag_added', { tag, bulk: true, count: ids.length })
  }

  // ── Export CSV
  function bulkExport() {
    const targets = selected.size > 0 ? customers.filter(c => selected.has(c.id)) : filtered
    const today = new Date().toISOString().slice(0, 10)
    exportCSV(`clientes_${today}.csv`,
      ['ID', 'Nome', 'Username', 'E-mail', 'Telefone', 'Status', 'Origem', 'Bot', 'Compras', 'Total gasto (R$)', 'Ticket médio (R$)', 'Primeiro contato', 'Último contato', 'Tags'],
      targets.map(c => [
        c.id, c.name, c.username, c.email, c.phone,
        c.status === 'buyer' ? 'Comprador' : 'Lead',
        c.origin, c.bot, c.purchases, c.totalSpent, c.avgTicket,
        fmtDate(c.firstContact), fmtDate(c.lastContact),
        c.tags.join('; '),
      ]),
    )
    track('csv_exported', { section: 'clientes', rows: targets.length })
    if (selected.size > 0) setToast(`${targets.length} cliente${targets.length === 1 ? '' : 's'} exportado${targets.length === 1 ? '' : 's'}.`)
  }

  const openCustomer = customers.find(c => c.id === openCustomerId) ?? null

  // ── Derived counts from loaded list (for subtitle)
  const displayTotal  = totalCount
  const displayBuyers = buyersCount
  const displayLeads  = leadsCount

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${fmtNum(displayTotal)} contatos · ${fmtNum(displayBuyers)} compradores · ${fmtNum(displayLeads)} leads`}
        actions={
          <>
            <Btn icon={Download} onClick={bulkExport}>Exportar CSV</Btn>
            <Btn icon={Upload} onClick={() => setImportModalOpen(true)}>Importar CSV</Btn>
            <Btn variant="primary" icon={UserPlus} onClick={() => setAddModalOpen(true)}>Adicionar cliente</Btn>
          </>
        }
      />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        hasFilters={hasFilters}
        onClear={handleClear}
        originOptions={allOriginOptions}
        tagOptions={allTagOptions}
        onFilterChange={handleFilterChange}
      />

      {selected.size > 0 && (
        <div className="relative mb-3">
          <BulkActionsBar
            count={selected.size}
            onAddTag={() => setAddTagOpen(o => !o)}
            onExport={bulkExport}
            onClear={() => setSelected(new Set())}
            toast={toast}
          />
          <AddTagPopover
            open={addTagOpen}
            onClose={() => setAddTagOpen(false)}
            onAdd={bulkAddTag}
            tagOptions={allTagOptions}
          />
        </div>
      )}

      {customers.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <NoDataState onAdd={() => setAddModalOpen(true)} />
        </div>
      ) : (
        <CustomersTable
          data={filtered}
          selected={selected}
          setSelected={setSelected}
          onOpenCustomer={(id) => {
            setOpenCustomerId(id)
            const c = customers.find(x => x.id === id)
            if (c) track('customer_profile_opened', { status: c.status })
          }}
          totalLoaded={customers.length}
          totalCount={totalCount}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          onAdd={() => setAddModalOpen(true)}
        />
      )}

      <ProfilePanel
        customer={openCustomer}
        open={!!openCustomerId}
        onClose={() => setOpenCustomerId(null)}
        onUpdate={updateCustomer}
      />

      <AddCustomerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        bots={bots}
        originOptions={allOriginOptions}
        onSuccess={(raw) => {
          setCustomers(prev => [mapRaw(raw), ...prev])
          setTotalCount(n => n + 1)
          setLeadsCount(n => n + 1)
          setDbOffset(o => o + 1)
          track('customer_added', {})
        }}
      />

      <ImportCSVModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        bots={bots}
        onSuccess={(count) => {
          setTotalCount(n => n + count)
          setLeadsCount(n => n + count)
          track('customer_imported', { rows: count })
        }}
      />
    </>
  )
}
