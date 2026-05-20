'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  Link2, Search, Check, X, MousePointerClick, Users, TrendingUp, Download, Plus,
  CheckCircle2, ShieldAlert, ChevronUp, ChevronDown, AlertCircle, Sparkles,
  ChevronRight, AlertTriangle, ExternalLink, Pencil, Pause, Play, Copy, Trash2,
  ArrowUpRight, ArrowDownRight, ChevronLeft, Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UtmParams { source: string; medium: string; campaign: string }

export interface RawRedirect {
  id: string
  slug: string
  destination: string
  destination_label: string
  clicks: number
  unique_clicks: number
  status: 'active' | 'paused' | 'archived'
  cloaking: boolean
  decoy_url: string | null
  utm: UtmParams | null
  redirect_type: string
  created_at: string
}

interface LinkItem {
  id: string; slug: string; url: string
  destination: string; destinationLabel: string
  clicks: number; uniqueClicks: number; createdAt: number
  status: 'active' | 'paused' | 'archived'
  cloaking: boolean; decoyUrl: string
  utm: UtmParams | null; redirectType: string
}

interface DailyClick { day: string; clicks: number }
interface BreakdownItem { name: string; value: number; color: string }

interface LinkAnalytics {
  period_clicks: number
  period_unique: number
  by_day: DailyClick[] | null
  by_source: { name: string; value: number }[] | null
  by_device: { name: string; value: number }[] | null
}

interface CreateOpts {
  destination: string; slug: string; redirectType: number
  utm: UtmParams | null; cloaking: boolean; decoyUrl: string
}

interface RedirectsClientProps {
  initialRedirects: RawRedirect[]
  userId: string
  appUrl: string
  currClicks: number
  clicksDelta: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtPct(n: number, d = 1) { return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%' }
function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function fmtDateTime(d: number) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

function shortUrl(fullUrl: string): string {
  return fullUrl.replace(/^https?:\/\//, '')
}

function mapRaw(row: RawRedirect, appUrl: string): LinkItem {
  return {
    id: row.id, slug: row.slug,
    url: `${appUrl}/r/${row.slug}`,
    destination: row.destination,
    destinationLabel: row.destination_label || row.destination,
    clicks: row.clicks, uniqueClicks: row.unique_clicks,
    createdAt: new Date(row.created_at).getTime(),
    status: row.status, cloaking: row.cloaking,
    decoyUrl: row.decoy_url ?? '',
    utm: row.utm, redirectType: row.redirect_type,
  }
}

const SOURCE_COLORS: Record<string, string> = {
  Instagram: 'oklch(0.62 0.24 25)',
  Google:    'var(--success)',
  YouTube:   'var(--danger)',
  TikTok:    'oklch(0.3 0 0)',
  WhatsApp:  'oklch(0.62 0.14 145)',
  Facebook:  'oklch(0.5 0.2 260)',
  'Twitter/X': 'oklch(0.35 0 0)',
  Direto:    'var(--text-subtle)',
  Outros:    'var(--text-muted)',
}

const DEVICE_COLORS: Record<string, string> = {
  Mobile:  'var(--primary)',
  Desktop: 'var(--success)',
  Tablet:  'var(--warning)',
  Outros:  'var(--text-muted)',
}

function addColors(items: { name: string; value: number }[], map: Record<string, string>): BreakdownItem[] {
  return items.map(it => ({ ...it, color: map[it.name] ?? 'var(--text-muted)' }))
}

// ─── Primitivas de UI ─────────────────────────────────────────────────────────

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

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '', type = 'button' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'
  onClick?: () => void; disabled?: boolean; className?: string; type?: 'button' | 'submit'
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger text-white hover:bg-danger/90',
  }[variant]
  return <button type={type} className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-surface-3 border border-border'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2">
        <span className="truncate max-w-[140px]">{value || label}</span><ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[170px]">
          {options.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}>
              {o === value && <Check size={12} />}<span className={o !== value ? 'pl-5' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40"><ChevronLeft size={13} /></button>
      {pages.map(p => (
        <button key={p} onClick={() => onChange(p)} className={`w-7 h-7 flex items-center justify-center rounded-md text-[12px] font-medium ${p === page ? 'bg-primary text-primary-fg' : 'text-text-muted hover:bg-surface-2'}`}>{p}</button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 disabled:opacity-40"><ChevronRight size={13} /></button>
    </div>
  )
}

function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface border border-border rounded-2xl shadow-xl w-full ${w} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            {title && <div className="text-[15px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 shrink-0"><X size={14} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, delta, icon: Icon, tone }: {
  label: string; value: string; sub?: string; delta?: number | null; icon: React.ElementType; tone?: 'primary'
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted'}`}><Icon size={14} /></div>
      </div>
      <div className="text-[24px] font-semibold tracking-tight text-text leading-none">{value}</div>
      <div className="flex items-center gap-2 mt-2.5">
        {delta !== null && delta !== undefined && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium text-[11px] ${positive ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {fmtPct(Math.abs(delta))}
          </span>
        )}
        {sub && <span className="text-[11.5px] text-text-muted">{sub}</span>}
      </div>
    </div>
  )
}

function MiniSparkline({ data, width = 100, height = 28 }: { data: DailyClick[]; width?: number; height?: number }) {
  if (!data || data.length === 0) return <div style={{ width, height }} className="bg-surface-2 rounded" />
  const values = data.map(d => d.clicks)
  const max = Math.max(...values, 1), min = Math.min(...values, 0)
  const range = Math.max(1, max - min)
  const step = width / Math.max(data.length - 1, 1)
  const pts = data.map((d, i) => [i * step, height - ((d.clicks - min) / range) * (height - 4) - 2])
  const path = `M ${pts[0][0]},${pts[0][1]} L ${pts.slice(1).map(p => `${p[0]},${p[1]}`).join(' L ')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyableShort({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy(e: React.MouseEvent) {
    e.stopPropagation()
    try { navigator.clipboard?.writeText(url) } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-text font-mono text-[11.5px] max-w-full" title="Copiar link">
      <Link2 size={11} className="text-text-muted shrink-0" />
      <span className="truncate">{shortUrl(url)}</span>
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} className="text-text-muted group-hover:text-text" />}
    </button>
  )
}

function BreakdownCard({ title, items }: { title: string; items: BreakdownItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="text-[12.5px] font-semibold text-text mb-3">{title}</div>
        <p className="text-[11.5px] text-text-muted">Sem dados ainda.</p>
      </div>
    )
  }
  const total = items.reduce((s, i) => s + i.value, 0)
  const max = Math.max(...items.map(i => i.value))
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[12.5px] font-semibold text-text mb-3">{title}</div>
      <div className="space-y-2">
        {items.map(it => (
          <div key={it.name}>
            <div className="flex items-center justify-between text-[11.5px] mb-1">
              <span className="inline-flex items-center gap-1.5 text-text">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: it.color }} />{it.name}
              </span>
              <span className="text-text-muted">{fmtNum(it.value)} <span className="text-text-subtle">· {fmtPct((it.value / total) * 100, 0)}</span></span>
            </div>
            <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className={`text-text truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ─── DetailsCard ──────────────────────────────────────────────────────────────

function DetailsCard({ link, onStatusChange, onEdit, onDelete }: {
  link: LinkItem
  onStatusChange: (id: string, s: LinkItem['status']) => void
  onEdit: (link: LinkItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[12.5px] font-semibold text-text mb-3">Detalhes & ações</div>
      <div className="space-y-2 text-[11.5px]">
        <InfoRow label="Tipo de redirect" value={`HTTP ${link.redirectType}`} mono />
        <InfoRow label="Criado em" value={fmtDateTime(link.createdAt)} />
        {link.utm && (
          <>
            <InfoRow label="utm_source"   value={link.utm.source}   mono />
            <InfoRow label="utm_medium"   value={link.utm.medium}   mono />
            <InfoRow label="utm_campaign" value={link.utm.campaign} mono />
          </>
        )}
        {link.cloaking && (
          <div className="mt-2 p-2 bg-danger-soft border border-danger/30 rounded text-[10.5px] text-danger leading-snug">
            <ShieldAlert size={10} className="inline-block -mt-px mr-1" />
            <strong>Cloaking ativo.</strong> Este link mostra outro destino para revisores. Risco de banimento de conta de ads.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border">
        {link.status === 'active' && (
          <Btn variant="secondary" size="sm" onClick={() => onStatusChange(link.id, 'paused')}><Pause size={13} /> Pausar</Btn>
        )}
        {link.status === 'paused' && (
          <Btn variant="primary" size="sm" onClick={() => onStatusChange(link.id, 'active')}><Play size={13} /> Retomar</Btn>
        )}
        <Btn variant="ghost" size="sm" onClick={() => window.open(link.destination, '_blank')}><ExternalLink size={13} /> Abrir</Btn>
        <Btn variant="ghost" size="sm" onClick={() => onEdit(link)}><Pencil size={13} /> Editar</Btn>
        <Btn variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => onDelete(link.id)}><Trash2 size={13} /> Apagar</Btn>
      </div>
    </div>
  )
}

// ─── LinkStats ────────────────────────────────────────────────────────────────

function LinkStats({ link, analytics, loading, onStatusChange, onEdit, onDelete }: {
  link: LinkItem
  analytics: LinkAnalytics | undefined
  loading: boolean
  onStatusChange: (id: string, s: LinkItem['status']) => void
  onEdit: (link: LinkItem) => void
  onDelete: (id: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const byDay    = analytics?.by_day    ?? []
  const bySource = addColors(analytics?.by_source ?? [], SOURCE_COLORS)
  const byDevice = addColors(analytics?.by_device ?? [], DEVICE_COLORS)
  const periodClicks = analytics?.period_clicks ?? 0
  const periodUnique = analytics?.period_unique ?? 0
  const rate = periodClicks > 0 ? (periodUnique / periodClicks) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-text-muted text-[12.5px]">
        <Loader2 size={16} className="animate-spin" /> Carregando analytics…
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1100px]">
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[12.5px] font-semibold text-text">Cliques por dia</div>
            <div className="text-[10.5px] text-text-muted">Últimos 14 dias</div>
          </div>
          <div className="flex items-center gap-3 text-[11.5px] text-text-muted">
            <span>Total: <span className="text-text font-semibold">{fmtNum(periodClicks)}</span></span>
            <span>Únicos: <span className="text-text font-semibold">{fmtNum(periodUnique)}</span></span>
            <span>Taxa: <span className="text-text font-semibold">{fmtPct(rate)}</span></span>
          </div>
        </div>
        {byDay.length === 0 ? (
          <div className="py-8 text-center text-[12.5px] text-text-muted">Nenhum clique nos últimos 14 dias.</div>
        ) : mounted ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} interval={1} tick={{ fill: 'var(--text-muted)' }} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} width={32} tick={{ fill: 'var(--text-muted)' }} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, boxShadow: 'var(--shadow-md)' }}
                formatter={(v) => [fmtNum(typeof v === 'number' ? v : 0) + ' cliques', '']} separator="" />
              <Bar dataKey="clicks" fill="var(--primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <BreakdownCard title="Por origem"      items={bySource} />
        <BreakdownCard title="Por dispositivo" items={byDevice} />
        <DetailsCard link={link} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  )
}

// ─── LinkRow ──────────────────────────────────────────────────────────────────

const statusMap: Record<string, { label: string; tone: string }> = {
  active:   { label: 'Ativo',     tone: 'success' },
  paused:   { label: 'Pausado',   tone: 'warning' },
  archived: { label: 'Arquivado', tone: 'muted'   },
}

function LinkRow({ link, expanded, analytics, analyticsLoading, onToggle, onStatusChange, onEdit, onDelete }: {
  link: LinkItem; expanded: boolean
  analytics: LinkAnalytics | undefined; analyticsLoading: boolean
  onToggle: () => void
  onStatusChange: (id: string, s: LinkItem['status']) => void
  onEdit: (link: LinkItem) => void
  onDelete: (id: string) => void
}) {
  const st = statusMap[link.status]
  const sparkData: DailyClick[] = analytics?.by_day ?? []

  return (
    <>
      <tr onClick={onToggle} className={`border-t border-border cursor-pointer transition-colors ${expanded ? 'bg-surface-2/40' : 'hover:bg-surface-2/60'}`}>
        <td className="pl-4 pr-2 py-3" onClick={e => e.stopPropagation()}><CopyableShort url={link.url} /></td>
        <td className="px-2 py-3 max-w-[280px]">
          <div className="text-[12.5px] text-text truncate font-medium">{link.destinationLabel}</div>
          <div className="text-[10.5px] text-text-muted truncate font-mono">{link.destination}</div>
        </td>
        <td className="px-2 py-3 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-3">
            {sparkData.length > 0
              ? <MiniSparkline data={sparkData} width={80} height={24} />
              : <div className="w-20 h-6 bg-surface-2 rounded" />
            }
            <div>
              <div className="text-[13px] font-semibold text-text leading-none">{fmtNum(link.clicks)}</div>
              <div className="text-[10px] text-text-muted mt-0.5">{fmtNum(link.uniqueClicks)} únicos</div>
            </div>
          </div>
        </td>
        <td className="px-2 py-3 text-text-muted text-[11.5px] whitespace-nowrap">{fmtDate(link.createdAt)}</td>
        <td className="px-2 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Badge tone={st.tone}>
              {link.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />}
              {st.label}
            </Badge>
            {link.cloaking && <Badge tone="danger"><ShieldAlert size={10} /> Cloaking</Badge>}
            {link.utm && <Badge tone="primary">UTM</Badge>}
          </div>
        </td>
        <td className="pl-2 pr-4 py-3 text-right">
          {analyticsLoading && expanded
            ? <Loader2 size={14} className="text-text-muted animate-spin" />
            : expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-2/30 border-t border-border">
          <td colSpan={6} className="px-4 py-5">
            <LinkStats
              link={link}
              analytics={analytics}
              loading={analyticsLoading}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── CloakingSection ──────────────────────────────────────────────────────────

function CloakingSection({ enabled, onChange, decoyUrl, setDecoyUrl, acknowledged, setAcknowledged }: {
  enabled: boolean; onChange: (v: boolean) => void
  decoyUrl: string; setDecoyUrl: (v: string) => void
  acknowledged: boolean; setAcknowledged: (v: boolean) => void
}) {
  return (
    <div className={`rounded-lg border-2 transition-colors ${enabled ? 'border-danger/40 bg-danger-soft/40' : 'border-border bg-surface'}`}>
      <div className="p-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className={enabled ? 'text-danger' : 'text-text-muted'} />
            <span className="text-[12.5px] font-semibold text-text">Cloaking (mascarar destino)</span>
            {enabled && <Badge tone="danger">Alto risco</Badge>}
          </div>
          <p className="text-[11.5px] text-text-muted mt-1 leading-snug max-w-md">
            Mostra um URL &ldquo;limpo&rdquo; para os revisores das plataformas de anúncio e redireciona usuários reais para o destino verdadeiro.
          </p>
        </div>
        <Switch checked={enabled} onChange={onChange} />
      </div>

      {enabled && (
        <div className="px-3.5 pb-3.5">
          <div className="bg-surface border-2 border-danger/40 rounded-lg p-3.5 mb-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-md bg-danger text-white flex items-center justify-center shrink-0"><AlertTriangle size={14} /></div>
              <div className="text-[12px] text-text leading-relaxed">
                <div className="font-semibold text-danger mb-1.5">Atenção: viola políticas de Meta e TikTok</div>
                <p className="text-text-muted">
                  Mascarar o destino para burlar a revisão de anúncios <strong className="text-text">viola as políticas de publicidade do Meta e do TikTok</strong> e pode resultar em banimento de conta de ads e bloqueio de pixel.
                </p>
                <p className="mt-2 text-text-muted">Use por sua conta e risco. A Umbra Bot não se responsabiliza por sanções aplicadas pelas plataformas.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-text mb-1.5">URL alternativo (decoy)</label>
            <input type="text" value={decoyUrl} onChange={e => setDecoyUrl(e.target.value)}
              placeholder="https://blog.minhaempresa.com.br/conteudo-aprovado"
              className="w-full h-9 px-3 bg-surface border border-border rounded-md text-[12px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-danger/25 focus:border-danger/50" />
            <p className="text-[10.5px] text-text-muted mt-1">Página mostrada para revisores, bots e crawlers do Meta/TikTok.</p>
          </div>

          <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
            <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-0.5 accent-danger" />
            <span className="text-[11.5px] text-text leading-snug">
              <strong>Estou ciente</strong> de que essa configuração viola as políticas das plataformas de anúncios e <strong>assumo total responsabilidade</strong> por qualquer sanção aplicada à minha conta.
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

// ─── Campos do formulário de link ─────────────────────────────────────────────

function LinkFormFields({
  destination, setDestination,
  slug, setSlug,
  showAdvanced, setShowAdvanced,
  redirectType, setRedirectType,
  utmEnabled, setUtmEnabled,
  utm, setUtm,
  cloaking, setCloaking,
  decoyUrl, setDecoyUrl,
  acknowledged, setAcknowledged,
  slugPrefix,
  slugTaken, destValid, slugClean,
  autoSlug,
  editMode,
}: {
  destination: string; setDestination: (v: string) => void
  slug: string; setSlug: (v: string) => void
  showAdvanced: boolean; setShowAdvanced: (v: boolean) => void
  redirectType: number; setRedirectType: (v: number) => void
  utmEnabled: boolean; setUtmEnabled: (v: boolean) => void
  utm: UtmParams; setUtm: (v: UtmParams) => void
  cloaking: boolean; setCloaking: (v: boolean) => void
  decoyUrl: string; setDecoyUrl: (v: string) => void
  acknowledged: boolean; setAcknowledged: (v: boolean) => void
  slugPrefix: string
  slugTaken: boolean; destValid: boolean; slugClean: string
  autoSlug: () => void
  editMode?: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[12.5px] font-medium text-text mb-1.5">URL de destino</label>
        <input type="url" value={destination} onChange={e => setDestination(e.target.value)} autoFocus={!editMode}
          placeholder="https://checkout.minhaempresa.com.br/produto"
          className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[12.5px] font-medium text-text">Slug</label>
          <button onClick={autoSlug} type="button" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
            <Sparkles size={11} /> Gerar automaticamente
          </button>
        </div>
        <div className={`flex items-center bg-surface border rounded-lg overflow-hidden ${slugTaken ? 'border-danger focus-within:ring-2 focus-within:ring-danger/25' : 'border-border focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50'}`}>
          <span className="px-3 text-[12px] text-text-muted font-mono">{slugPrefix}</span>
          <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="meu-link-curto"
            className="flex-1 h-10 pr-3 bg-transparent text-[13px] font-mono text-text placeholder:text-text-subtle focus:outline-none" />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-text-muted">Pré-visualização: <span className="text-text font-mono">{slugPrefix}{slugClean || '…'}</span></span>
          {slugTaken && <span className="text-danger">Já existe</span>}
        </div>
      </div>

      <button onClick={() => setShowAdvanced(!showAdvanced)} type="button"
        className="w-full inline-flex items-center justify-between text-[12.5px] font-medium text-text-muted hover:text-text rounded-md">
        <span className="inline-flex items-center gap-1.5">
          {showAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Opções avançadas (rastreamento, cloaking)
        </span>
        <span className="text-text-subtle text-[11px]">{showAdvanced ? 'Ocultar' : 'Mostrar'}</span>
      </button>

      {showAdvanced && (
        <div className="space-y-3.5 pt-1">
          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Tipo de redirecionamento</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 302, label: '302 — Temporário', desc: 'Recomendado. Permite mudar o destino depois.' },
                { id: 301, label: '301 — Permanente', desc: 'Indexado por buscadores. Mudanças não propagam.' },
              ].map(opt => {
                const active = redirectType === opt.id
                return (
                  <button key={opt.id} type="button" onClick={() => setRedirectType(opt.id)}
                    className={`text-left p-2.5 rounded-lg border-2 transition-colors ${active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary' : 'border-border-strong'}`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </span>
                      <div className="text-[12px] font-medium text-text">{opt.label}</div>
                    </div>
                    <div className="text-[10.5px] text-text-muted ml-5 leading-snug">{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface">
            <div className="p-3 flex items-start justify-between gap-3 border-b border-border">
              <div>
                <div className="text-[12.5px] font-semibold text-text">Parâmetros UTM</div>
                <p className="text-[11.5px] text-text-muted mt-0.5">Adiciona <code className="font-mono">utm_source/medium/campaign</code> ao destino para rastreamento no GA4.</p>
              </div>
              <Switch checked={utmEnabled} onChange={setUtmEnabled} />
            </div>
            {utmEnabled && (
              <div className="p-3 grid grid-cols-3 gap-2">
                {[{ key: 'source', placeholder: 'instagram' }, { key: 'medium', placeholder: 'cpc' }, { key: 'campaign', placeholder: 'black-2026' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-text-subtle mb-1">utm_{f.key}</label>
                    <input type="text" value={utm[f.key as keyof UtmParams]}
                      onChange={e => setUtm({ ...utm, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full h-8 px-2 bg-surface-2 border border-border rounded-md text-[12px] font-mono text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <CloakingSection
            enabled={cloaking} onChange={setCloaking}
            decoyUrl={decoyUrl} setDecoyUrl={setDecoyUrl}
            acknowledged={acknowledged} setAcknowledged={setAcknowledged}
          />
        </div>
      )}
    </div>
  )
}

// ─── CreateLinkModal ──────────────────────────────────────────────────────────

function CreateLinkModal({ open, onClose, onCreate, existing, slugPrefix }: {
  open: boolean; onClose: () => void
  onCreate: (opts: CreateOpts) => Promise<void>
  existing: LinkItem[]; slugPrefix: string
}) {
  const [destination, setDestination] = useState('')
  const [slug, setSlug]               = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [redirectType, setRedirectType] = useState(302)
  const [utmEnabled, setUtmEnabled]   = useState(false)
  const [utm, setUtm]                 = useState<UtmParams>({ source: '', medium: '', campaign: '' })
  const [cloaking, setCloaking]       = useState(false)
  const [decoyUrl, setDecoyUrl]       = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (open) {
      setDestination(''); setSlug(''); setShowAdvanced(false); setRedirectType(302)
      setUtmEnabled(false); setUtm({ source: '', medium: '', campaign: '' })
      setCloaking(false); setDecoyUrl(''); setAcknowledged(false); setLoading(false); setError('')
    }
  }, [open])

  function autoSlug() {
    try {
      const u = new URL(destination)
      const dom = u.hostname.replace('www.', '').split('.')[0].slice(0, 12)
      setSlug(`${dom}-${Math.random().toString(36).slice(2, 5)}`)
    } catch { setSlug('link-' + Math.random().toString(36).slice(2, 6)) }
  }

  const slugClean = slug.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  const destValid = (() => { try { new URL(destination); return true } catch { return false } })()
  const slugTaken = slugClean.length > 0 && existing.some(l => l.slug === slugClean)
  const cloakingValid = !cloaking || (acknowledged && decoyUrl.trim().length > 0)
  const canSubmit = destValid && slugClean.length >= 2 && !slugTaken && cloakingValid

  async function submit() {
    if (!canSubmit) {
      if (!destValid) { setError('Destino inválido. Use uma URL completa com https://.'); return }
      if (!slugClean) { setError('Slug inválido. Use apenas letras, números e hífens.'); return }
      if (slugTaken)  { setError('Já existe um link com esse slug. Escolha outro.'); return }
      if (cloaking && !decoyUrl.trim()) { setError('Informe o URL alternativo (decoy) para cloaking.'); return }
      if (cloaking && !acknowledged)   { setError('Marque a confirmação de ciência sobre cloaking.'); return }
      return
    }
    setError(''); setLoading(true)
    await onCreate({ destination, slug: slugClean, redirectType, utm: utmEnabled ? utm : null, cloaking, decoyUrl })
    setLoading(false); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Criar redirecionador" subtitle="Crie um link curto com rastreamento personalizado." size="lg"
      footer={
        <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={loading || !canSubmit} onClick={submit}>
          {loading ? <><Loader2 size={13} className="animate-spin" /> Criando…</> : 'Criar link'}
        </Btn></>
      }>
      {error && (
        <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger mb-4">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
        </div>
      )}
      <LinkFormFields
        destination={destination} setDestination={setDestination}
        slug={slug} setSlug={setSlug}
        showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
        redirectType={redirectType} setRedirectType={setRedirectType}
        utmEnabled={utmEnabled} setUtmEnabled={setUtmEnabled}
        utm={utm} setUtm={setUtm}
        cloaking={cloaking} setCloaking={setCloaking}
        decoyUrl={decoyUrl} setDecoyUrl={setDecoyUrl}
        acknowledged={acknowledged} setAcknowledged={setAcknowledged}
        slugPrefix={slugPrefix}
        slugTaken={slugTaken} destValid={destValid} slugClean={slugClean}
        autoSlug={autoSlug}
      />
    </Modal>
  )
}

// ─── EditLinkModal ────────────────────────────────────────────────────────────

function EditLinkModal({ open, onClose, link, onSave, existing, slugPrefix }: {
  open: boolean; onClose: () => void
  link: LinkItem | null
  onSave: (id: string, patch: Partial<RawRedirect>) => Promise<void>
  existing: LinkItem[]; slugPrefix: string
}) {
  const [destination, setDestination] = useState('')
  const [slug, setSlug]               = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [redirectType, setRedirectType] = useState(302)
  const [utmEnabled, setUtmEnabled]   = useState(false)
  const [utm, setUtm]                 = useState<UtmParams>({ source: '', medium: '', campaign: '' })
  const [cloaking, setCloaking]       = useState(false)
  const [decoyUrl, setDecoyUrl]       = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (open && link) {
      setDestination(link.destination); setSlug(link.slug)
      setShowAdvanced(!!(link.utm || link.cloaking)); setRedirectType(Number(link.redirectType) || 302)
      setUtmEnabled(!!link.utm); setUtm(link.utm ?? { source: '', medium: '', campaign: '' })
      setCloaking(link.cloaking); setDecoyUrl(link.decoyUrl); setAcknowledged(link.cloaking)
      setLoading(false); setError('')
    }
  }, [open, link])

  if (!link) return null
  const safeLink = link

  function autoSlug() {
    try {
      const u = new URL(destination)
      const dom = u.hostname.replace('www.', '').split('.')[0].slice(0, 12)
      setSlug(`${dom}-${Math.random().toString(36).slice(2, 5)}`)
    } catch { setSlug('link-' + Math.random().toString(36).slice(2, 6)) }
  }

  const slugClean = slug.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  const destValid = (() => { try { new URL(destination); return true } catch { return false } })()
  const slugTaken = slugClean.length > 0 && slugClean !== link.slug && existing.some(l => l.slug === slugClean)
  const cloakingValid = !cloaking || (acknowledged && decoyUrl.trim().length > 0)
  const canSubmit = destValid && slugClean.length >= 2 && !slugTaken && cloakingValid

  async function submit() {
    if (!canSubmit) {
      if (!destValid) { setError('Destino inválido. Use uma URL completa com https://.'); return }
      if (slugTaken)  { setError('Já existe um link com esse slug. Escolha outro.'); return }
      return
    }
    setError(''); setLoading(true)
    await onSave(safeLink.id, {
      destination, destination_label: destination,
      slug: slugClean, redirect_type: String(redirectType),
      cloaking, decoy_url: decoyUrl || null,
      utm: utmEnabled ? utm : null,
    })
    setLoading(false); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar redirecionador" subtitle={`umbra.bot/r/${link.slug}`} size="lg"
      footer={
        <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={loading || !canSubmit} onClick={submit}>
          {loading ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : 'Salvar alterações'}
        </Btn></>
      }>
      {error && (
        <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger mb-4">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
        </div>
      )}
      <LinkFormFields
        destination={destination} setDestination={setDestination}
        slug={slug} setSlug={setSlug}
        showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
        redirectType={redirectType} setRedirectType={setRedirectType}
        utmEnabled={utmEnabled} setUtmEnabled={setUtmEnabled}
        utm={utm} setUtm={setUtm}
        cloaking={cloaking} setCloaking={setCloaking}
        decoyUrl={decoyUrl} setDecoyUrl={setDecoyUrl}
        acknowledged={acknowledged} setAcknowledged={setAcknowledged}
        slugPrefix={slugPrefix}
        slugTaken={slugTaken} destValid={destValid} slugClean={slugClean}
        autoSlug={autoSlug} editMode
      />
    </Modal>
  )
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────

function DeleteConfirmModal({ open, onClose, onConfirm, deleting, slug }: {
  open: boolean; onClose: () => void; onConfirm: () => void; deleting: boolean; slug: string
}) {
  return (
    <Modal open={open} onClose={onClose} title="Apagar redirecionador" size="sm"
      footer={
        <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="danger" disabled={deleting} onClick={onConfirm}>
          {deleting ? <><Loader2 size={13} className="animate-spin" /> Apagando…</> : 'Apagar'}
        </Btn></>
      }>
      <p className="text-[13px] text-text leading-relaxed">
        Tem certeza que deseja apagar o link <span className="font-mono text-primary">r/{slug}</span>? Esta ação não pode ser desfeita. Os históricos de cliques também serão removidos.
      </p>
    </Modal>
  )
}

// ─── RedirectsClient ──────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { search: '', status: 'Todos os status' }

export function RedirectsClient({ initialRedirects, userId, appUrl, currClicks, clicksDelta }: RedirectsClientProps) {
  const { track } = useAnalytics()

  const [links, setLinks]             = useState<LinkItem[]>(() => initialRedirects.map(r => mapRaw(r, appUrl)))
  const [filters, setFilters]         = useState(DEFAULT_FILTERS)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [page, setPage]               = useState(1)
  const [createOpen, setCreateOpen]   = useState(false)
  const [editLink, setEditLink]       = useState<LinkItem | null>(null)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Analytics lazy-loaded por link
  const [analytics, setAnalytics]     = useState<Record<string, LinkAnalytics>>({})
  const [analyticsLoading, setAnalyticsLoading] = useState<string | null>(null)

  const perPage    = 8
  const slugPrefix = `${shortUrl(appUrl)}/r/`

  // Toast auto-close
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
  }

  // ── Filtros e paginação ────────────────────────────────────────────────────

  useEffect(() => { setPage(1); setExpanded(null) }, [filters])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return links.filter(l => {
      if (q && !(l.slug.includes(q) || l.destination.toLowerCase().includes(q) || l.destinationLabel.toLowerCase().includes(q))) return false
      if (filters.status === 'Ativos'     && l.status !== 'active')   return false
      if (filters.status === 'Pausados'   && l.status !== 'paused')   return false
      if (filters.status === 'Arquivados' && l.status !== 'archived') return false
      return true
    })
  }, [links, filters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage   = Math.min(page, totalPages)
  const start      = (safePage - 1) * perPage
  const pageItems  = filtered.slice(start, start + perPage)

  const totals = useMemo(() => ({
    active:       links.filter(l => l.status === 'active').length,
    total:        links.length,
    totalClicks:  links.reduce((s, l) => s + l.clicks, 0),
    uniqueClicks: links.reduce((s, l) => s + l.uniqueClicks, 0),
    cloaking:     links.filter(l => l.cloaking).length,
  }), [links])

  const uniqueRate = totals.totalClicks > 0 ? (totals.uniqueClicks / totals.totalClicks) * 100 : 0
  const topLink = [...links].sort((a, b) => b.clicks - a.clicks)[0]

  // ── Analytics lazy load ────────────────────────────────────────────────────

  const loadAnalytics = useCallback(async (id: string) => {
    if (analytics[id] || analyticsLoading === id) return
    setAnalyticsLoading(id)
    try {
      const supabase = createClient()
      const { data } = await supabase.rpc('redirect_analytics', { p_redirect_id: id, p_days: 14 })
      if (data) setAnalytics(prev => ({ ...prev, [id]: data as LinkAnalytics }))
    } catch (_) {}
    setAnalyticsLoading(null)
  }, [analytics, analyticsLoading])

  function handleToggle(id: string) {
    const opening = expanded !== id
    setExpanded(opening ? id : null)
    if (opening) loadAnalytics(id)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function createLink(opts: CreateOpts) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('redirects')
      .insert({
        user_id:           userId,
        slug:              opts.slug,
        destination:       opts.destination,
        destination_label: opts.destination,
        redirect_type:     String(opts.redirectType),
        cloaking:          opts.cloaking,
        decoy_url:         opts.decoyUrl || null,
        utm:               opts.utm ?? null,
      })
      .select()
      .single()

    if (error || !data) {
      showToast(error?.message ?? 'Erro ao criar link.', 'error')
      return
    }
    setLinks(arr => [mapRaw(data as RawRedirect, appUrl), ...arr])
    showToast(`Link criado: ${slugPrefix}${opts.slug}`)
    track('redirect_created', { slug: opts.slug, cloaking: opts.cloaking, utm_enabled: !!opts.utm, redirect_type: String(opts.redirectType) })
  }

  async function saveLink(id: string, patch: Partial<RawRedirect>) {
    const prev = links.find(l => l.id === id)
    if (!prev) return
    // Optimistic update
    setLinks(arr => arr.map(l => l.id === id ? { ...l, ...mapRaw({ ...l, ...patch } as unknown as RawRedirect, appUrl) } : l))
    // Invalidate cached analytics se slug mudou (URL nova)
    if (patch.slug && patch.slug !== prev.slug) {
      setAnalytics(a => { const n = { ...a }; delete n[id]; return n })
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('redirects')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      setLinks(arr => arr.map(l => l.id === id ? prev : l))
      showToast('Erro ao salvar alterações.', 'error')
    } else {
      showToast('Link atualizado.')
      track('redirect_updated', { slug: patch.slug ?? prev.slug })
    }
  }

  async function changeStatus(id: string, status: LinkItem['status']) {
    const prev = links.find(l => l.id === id)
    if (!prev) return
    setLinks(arr => arr.map(l => l.id === id ? { ...l, status } : l))

    const supabase = createClient()
    const { error } = await supabase
      .from('redirects')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      setLinks(arr => arr.map(l => l.id === id ? prev : l))
      showToast('Erro ao atualizar status.', 'error')
    } else {
      track('redirect_status_changed', { status })
    }
  }

  async function deleteLink() {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('redirects')
      .delete()
      .eq('id', deleteId)
      .eq('user_id', userId)

    setDeleting(false)
    if (error) {
      showToast('Erro ao apagar link.', 'error')
      return
    }
    setLinks(arr => arr.filter(l => l.id !== deleteId))
    if (expanded === deleteId) setExpanded(null)
    setAnalytics(a => { const n = { ...a }; delete n[deleteId]; return n })
    setDeleteId(null)
    showToast('Link apagado.')
    track('redirect_deleted', {})
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────

  function handleExport() {
    const rows = [
      ['Link curto', 'Destino', 'Rótulo', 'Cliques', 'Cliques únicos', 'Status', 'Tipo', 'Criado em'],
      ...filtered.map(l => [
        `${appUrl}/r/${l.slug}`,
        l.destination,
        l.destinationLabel,
        l.clicks,
        l.uniqueClicks,
        l.status,
        l.redirectType,
        fmtDate(l.createdAt),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `redirecionadores_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    track('csv_exported', { section: 'redirects', rows: filtered.length })
  }

  const hasFilters = filters.search || filters.status !== 'Todos os status'
  const deleteSlug = links.find(l => l.id === deleteId)?.slug ?? ''

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <PageHeader
        title="Redirecionadores"
        subtitle="Links curtos rastreáveis para campanhas, bots e anúncios."
        actions={
          <>
            <button onClick={handleExport} disabled={filtered.length === 0}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-surface border border-border rounded-lg text-text hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              <Download size={14} /> Exportar
            </button>
            <button onClick={() => setCreateOpen(true)}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-primary text-primary-fg hover:bg-primary/90 rounded-lg transition-colors">
              <Plus size={14} /> Criar link
            </button>
          </>
        }
      />

      {/* Toast */}
      {toast && (
        <div className={`mb-3 flex items-center gap-2.5 border rounded-lg px-3 py-2 ${toast.type === 'error' ? 'bg-danger-soft border-danger/30' : 'bg-success-soft border-success/30'}`}>
          {toast.type === 'error'
            ? <AlertCircle size={15} className="text-danger shrink-0" />
            : <CheckCircle2 size={15} className="text-success shrink-0" />}
          <div className={`text-[12.5px] ${toast.type === 'error' ? 'text-danger' : 'text-success'}`}>{toast.msg}</div>
          <button onClick={() => setToast(null)} className="ml-auto text-text-muted hover:text-text"><X size={13} /></button>
        </div>
      )}

      {/* Aviso de cloaking */}
      {totals.cloaking > 0 && (
        <div className="mb-4 flex items-start gap-2.5 bg-danger-soft border-2 border-danger/40 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-md bg-danger text-white flex items-center justify-center shrink-0"><ShieldAlert size={15} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-danger">
              {totals.cloaking} {totals.cloaking === 1 ? 'link com cloaking ativo' : 'links com cloaking ativo'}
            </div>
            <div className="text-[11.5px] text-text-muted leading-relaxed mt-0.5 max-w-2xl">
              Cloaking <strong className="text-text">viola as políticas do Meta e do TikTok</strong>. Há risco real de banimento da sua conta de anúncios, do perfil comercial e do pixel de rastreamento. Use sob sua inteira responsabilidade.
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Links ativos"       value={`${totals.active} / ${totals.total}`} sub="conectados"            icon={Link2}            tone="primary" />
        <SummaryCard label="Cliques (30 dias)"  value={fmtNum(currClicks)}                   delta={clicksDelta}         icon={MousePointerClick} />
        <SummaryCard label="Cliques únicos"     value={fmtNum(totals.uniqueClicks)}          sub={fmtPct(uniqueRate)}    icon={Users} />
        <SummaryCard label="Top link"           value={topLink ? fmtNum(topLink.clicks) : '—'} sub={topLink?.slug || ''} icon={TrendingUp} />
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Buscar por slug ou destino…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
        <Dropdown label="Status" value={filters.status}
          options={['Todos os status', 'Ativos', 'Pausados', 'Arquivados']}
          onChange={v => setFilters(f => ({ ...f, status: v }))} />
        {hasFilters && (
          <button onClick={() => setFilters(DEFAULT_FILTERS)}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2">
            <X size={13} /> Limpar
          </button>
        )}
        <div className="flex-1" />
        <div className="text-[11.5px] text-text-muted">{filtered.length} {filtered.length === 1 ? 'link' : 'links'}</div>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl">
        {filtered.length === 0 ? (
          <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4"><Link2 size={20} /></div>
            <div className="text-[14px] font-semibold text-text">
              {links.length === 0 ? 'Nenhum link criado ainda' : 'Nenhum link encontrado'}
            </div>
            <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">
              {links.length === 0
                ? 'Crie seu primeiro redirecionador para rastrear cliques de campanhas.'
                : 'Tente ajustar os filtros ou limpar a busca.'}
            </div>
            {links.length === 0 && (
              <button onClick={() => setCreateOpen(true)}
                className="mt-4 h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-primary text-primary-fg hover:bg-primary/90 rounded-lg transition-colors">
                <Plus size={13} /> Criar link
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse min-w-[900px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
                  <th className="text-left font-semibold pl-4 pr-2 py-2.5">Link curto</th>
                  <th className="text-left font-semibold px-2 py-2.5">Destino</th>
                  <th className="text-right font-semibold px-2 py-2.5">Cliques</th>
                  <th className="text-left font-semibold px-2 py-2.5">Criado em</th>
                  <th className="text-left font-semibold px-2 py-2.5">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map(l => (
                  <LinkRow
                    key={l.id} link={l}
                    expanded={expanded === l.id}
                    analytics={analytics[l.id]}
                    analyticsLoading={analyticsLoading === l.id}
                    onToggle={() => handleToggle(l.id)}
                    onStatusChange={changeStatus}
                    onEdit={link => setEditLink(link)}
                    onDelete={id => setDeleteId(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > perPage && (
          <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11.5px] text-text-muted">
              Mostrando <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, filtered.length)}</span> de <span className="text-text font-medium">{filtered.length}</span> links
            </div>
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Modais */}
      <CreateLinkModal
        open={createOpen} onClose={() => setCreateOpen(false)}
        onCreate={createLink} existing={links} slugPrefix={slugPrefix}
      />
      <EditLinkModal
        open={!!editLink} onClose={() => setEditLink(null)}
        link={editLink} onSave={saveLink} existing={links} slugPrefix={slugPrefix}
      />
      <DeleteConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={deleteLink} deleting={deleting} slug={deleteSlug}
      />
    </DashboardLayout>
  )
}
