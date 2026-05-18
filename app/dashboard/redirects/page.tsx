'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  Link2, Search, Check, X, MousePointerClick, Users, TrendingUp, Download, Plus,
  CheckCircle2, ShieldAlert, ChevronUp, ChevronDown, AlertCircle, Sparkles,
  ChevronRight, AlertTriangle, ExternalLink, Pencil, Pause, Play, Copy,
  ArrowUpRight, ArrowDownRight, ChevronLeft,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BreakdownItem { name: string; color: string; value: number }
interface DailyClick    { day: string; clicks: number }
interface UtmParams     { source: string; medium: string; campaign: string }

interface LinkItem {
  id: string; slug: string; url: string; destination: string; destinationLabel: string
  clicks: number; uniqueClicks: number; createdAt: number
  status: 'active' | 'paused' | 'archived'
  cloaking: boolean; decoyUrl?: string; utm: UtmParams | null; redirectType: number
  daily: DailyClick[]; sources: BreakdownItem[]; devices: BreakdownItem[]
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtPct(n: number, decimals = 1) { return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%' }
function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function fmtDateTime(d: number) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL_R = 'umbra.bot/r/'

const linkStatusMap: Record<string, { label: string; tone: string }> = {
  active:   { label: 'Ativo',     tone: 'success' },
  paused:   { label: 'Pausado',   tone: 'warning' },
  archived: { label: 'Arquivado', tone: 'muted'   },
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

function rSeed(seed: number) {
  let s = seed % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}
function pickR<T>(arr: T[], r: () => number): T { return arr[Math.floor(r() * arr.length)] }

const NOW_R = new Date('2026-05-18T15:30:00').getTime()

const destinations = [
  { d: 'https://checkout.minhaempresa.com.br/mentoria-vip',       label: 'Checkout · Mentoria Premium' },
  { d: 'https://t.me/mentoria_vip_bot?start=lp_black',            label: 'Bot Telegram · Funil Black' },
  { d: 'https://minhaempresa.com.br/lp/lancamento-2025',          label: 'Landing · Lançamento 2025' },
  { d: 'https://t.me/vendas_curso_bot?start=ig',                  label: 'Bot Telegram · Curso 90d' },
  { d: 'https://checkout.minhaempresa.com.br/curso-90',           label: 'Checkout · Curso 90 dias' },
  { d: 'https://aulas.minhaempresa.com.br/free',                  label: 'Aula gratuita · YouTube' },
  { d: 'https://t.me/upsell_pos_bot?start=email',                 label: 'Bot Telegram · Upsell' },
  { d: 'https://minhaempresa.com.br/blog/funil-telegram-vendas',  label: 'Blog · Funil de vendas' },
  { d: 'https://wa.me/5511987654321?text=Quero%20saber%20mais',  label: 'WhatsApp · Atendimento' },
  { d: 'https://meet.minhaempresa.com.br/sessao-strategy',        label: 'Sessão Strategy gratuita' },
  { d: 'https://checkout.minhaempresa.com.br/templates-pro',      label: 'Checkout · Templates Pro' },
  { d: 'https://forms.minhaempresa.com.br/aplicacao-vip',         label: 'Formulário · Aplicação VIP' },
]
const slugsList = ['mentoria-vip','bf-2025','insta-promo','curso90','upsell-vip','aula-gratis','wpp','sessao','templates','aplicacao','youtube-cta','blog-funil']
const sourcesRef: BreakdownItem[] = [
  { name: 'Instagram', color: 'var(--primary)', value: 0 },
  { name: 'Google',    color: 'var(--success)', value: 0 },
  { name: 'YouTube',   color: 'var(--warning)', value: 0 },
  { name: 'TikTok',   color: 'var(--danger)',  value: 0 },
  { name: 'Direto',   color: 'var(--text-subtle)', value: 0 },
  { name: 'WhatsApp', color: 'oklch(0.62 0.14 145)', value: 0 },
]
const devicesRef: BreakdownItem[] = [
  { name: 'Mobile',  color: 'var(--primary)', value: 0 },
  { name: 'Desktop', color: 'var(--success)', value: 0 },
  { name: 'Tablet',  color: 'var(--warning)', value: 0 },
]

function makeDailyClicks(r: () => number, total: number, days = 14): DailyClick[] {
  const arr: DailyClick[] = []
  for (let i = days - 1; i >= 0; i--) {
    const base = total / days
    arr.push({ day: new Date(NOW_R - i * 24 * 3600 * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), clicks: Math.max(0, Math.round(base * (0.6 + r() * 0.8))) })
  }
  return arr
}

function makeBreakdown(r: () => number, total: number, items: BreakdownItem[]): BreakdownItem[] {
  const weights = items.map(() => 0.2 + r() * 1.5)
  const sum = weights.reduce((a, b) => a + b, 0)
  return items.map((it, i) => ({ ...it, value: Math.max(1, Math.round((weights[i] / sum) * total)) })).sort((a, b) => b.value - a.value)
}

function generateLinks(): LinkItem[] {
  const r = rSeed(99)
  return Array.from({ length: 12 }, (_, i) => {
    const dest = destinations[i % destinations.length]
    const slug = slugsList[i] || `link-${i + 1}`
    const clicks = Math.floor(120 + r() * 4800)
    const uniqueClicks = Math.floor(clicks * (0.65 + r() * 0.30))
    const createdAt = NOW_R - Math.floor((1 + r() * 90) * 24 * 3600 * 1000)
    const statusRoll = r()
    const status: LinkItem['status'] = statusRoll < 0.78 ? 'active' : statusRoll < 0.92 ? 'paused' : 'archived'
    const cloaking = r() < 0.18
    const utm: UtmParams | null = r() > 0.4 ? { source: pickR(['instagram','google','youtube','tiktok'], r), medium: pickR(['cpc','social','organic','paid'], r), campaign: pickR(['black-2025','lancamento-mai','sempre-on','upsell'], r) } : null
    return {
      id: 'lnk_' + String(i + 1).padStart(3, '0'),
      slug, url: BASE_URL_R + slug, destination: dest.d, destinationLabel: dest.label,
      clicks, uniqueClicks, createdAt, status, cloaking, utm, redirectType: 302,
      daily: makeDailyClicks(r, clicks), sources: makeBreakdown(r, clicks, sourcesRef), devices: makeBreakdown(r, clicks, devicesRef),
    }
  }).sort((a, b) => b.clicks - a.clicks)
}

const INITIAL_LINKS = generateLinks()

// ─── UI primitives ─────────────────────────────────────────────────────────────

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

type BtnVariant = 'primary' | 'secondary' | 'ghost'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; onClick?: () => void; disabled?: boolean; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = { primary: 'bg-primary text-primary-fg hover:bg-primary/90', secondary: 'bg-surface border border-border text-text hover:bg-surface-2', ghost: 'text-text-muted hover:text-text hover:bg-surface-2' }[variant]
  return <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

function Spinner() { return <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> }

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
            <button key={o} onClick={() => { onChange(o); setOpen(false) }} className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}>
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

// ─── SummaryR ──────────────────────────────────────────────────────────────────

function SummaryR({ label, value, sub, delta, icon: Icon, tone }: {
  label: string; value: string; sub?: string; delta?: number; icon: React.ElementType; tone?: 'primary'
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
        {delta !== undefined && (
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

// ─── MiniSparkline ─────────────────────────────────────────────────────────────

function MiniSparkline({ data, width = 100, height = 28 }: { data: DailyClick[]; width?: number; height?: number }) {
  if (!data || data.length === 0) return null
  const values = data.map(d => d.clicks)
  const max = Math.max(...values, 1), min = Math.min(...values, 0)
  const range = Math.max(1, max - min)
  const step = width / (data.length - 1)
  const pts = data.map((d, i) => [i * step, height - ((d.clicks - min) / range) * (height - 4) - 2])
  const path = `M ${pts[0][0]},${pts[0][1]} L ${pts.slice(1).map(p => `${p[0]},${p[1]}`).join(' L ')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── CopyableShort ─────────────────────────────────────────────────────────────

function CopyableShort({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy(e: React.MouseEvent) {
    e.stopPropagation()
    try { navigator.clipboard?.writeText('https://' + url) } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border text-text font-mono text-[11.5px] max-w-full" title="Copiar link">
      <Link2 size={11} className="text-text-muted shrink-0" />
      <span className="truncate">{url}</span>
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} className="text-text-muted group-hover:text-text" />}
    </button>
  )
}

// ─── BreakdownCard ─────────────────────────────────────────────────────────────

function BreakdownCard({ title, items }: { title: string; items: BreakdownItem[] }) {
  const max = Math.max(...items.map(i => i.value))
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[12.5px] font-semibold text-text mb-3">{title}</div>
      <div className="space-y-2">
        {items.map(it => (
          <div key={it.name}>
            <div className="flex items-center justify-between text-[11.5px] mb-1">
              <span className="inline-flex items-center gap-1.5 text-text"><span className="w-2 h-2 rounded-sm" style={{ background: it.color }} />{it.name}</span>
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

// ─── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className={`text-text truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ─── DetailsCard ───────────────────────────────────────────────────────────────

function DetailsCard({ link, onStatusChange }: { link: LinkItem; onStatusChange: (id: string, status: LinkItem['status']) => void }) {
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
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
        {link.status === 'active'  && <Btn variant="secondary" size="sm" onClick={() => onStatusChange(link.id, 'paused')}><Pause size={13} /> Pausar</Btn>}
        {link.status === 'paused'  && <Btn variant="primary"   size="sm" onClick={() => onStatusChange(link.id, 'active')}><Play  size={13} /> Retomar</Btn>}
        <Btn variant="ghost" size="sm"><ExternalLink size={13} /> Abrir</Btn>
        <Btn variant="ghost" size="sm"><Pencil size={13} /> Editar</Btn>
      </div>
    </div>
  )
}

// ─── LinkStats ─────────────────────────────────────────────────────────────────

function LinkStats({ link, onStatusChange }: { link: LinkItem; onStatusChange: (id: string, status: LinkItem['status']) => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="space-y-4 max-w-[1100px]">
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[12.5px] font-semibold text-text">Cliques por dia</div>
            <div className="text-[10.5px] text-text-muted">Últimos 14 dias</div>
          </div>
          <div className="flex items-center gap-3 text-[11.5px] text-text-muted">
            <span>Total: <span className="text-text font-semibold">{fmtNum(link.clicks)}</span></span>
            <span>Únicos: <span className="text-text font-semibold">{fmtNum(link.uniqueClicks)}</span></span>
            <span>Taxa: <span className="text-text font-semibold">{fmtPct((link.uniqueClicks / link.clicks) * 100)}</span></span>
          </div>
        </div>
        {mounted && (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={link.daily} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} interval={1} tick={{ fill: 'var(--text-muted)' }} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} width={32} tick={{ fill: 'var(--text-muted)' }} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, boxShadow: 'var(--shadow-md)' }}
                formatter={(v) => [fmtNum(typeof v === 'number' ? v : 0) + ' cliques', '']} separator="" />
              <Bar dataKey="clicks" fill="var(--primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <BreakdownCard title="Por origem"     items={link.sources} />
        <BreakdownCard title="Por dispositivo" items={link.devices} />
        <DetailsCard link={link} onStatusChange={onStatusChange} />
      </div>
    </div>
  )
}

// ─── LinkRow ───────────────────────────────────────────────────────────────────

function LinkRow({ link, expanded, onToggle, onStatusChange }: {
  link: LinkItem; expanded: boolean; onToggle: () => void; onStatusChange: (id: string, s: LinkItem['status']) => void
}) {
  const st = linkStatusMap[link.status]
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
            <MiniSparkline data={link.daily.slice(-14)} width={80} height={24} />
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
          {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-2/30 border-t border-border">
          <td colSpan={6} className="px-4 py-5">
            <LinkStats link={link} onStatusChange={onStatusChange} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── CloakingSection ───────────────────────────────────────────────────────────

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
                  Mascarar o destino para burlar a revisão de anúncios <strong className="text-text">viola as políticas de publicidade do Meta (Facebook/Instagram) e do TikTok</strong> e pode resultar em:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside marker:text-danger text-text-muted">
                  <li>Banimento permanente da conta de anúncios</li>
                  <li>Bloqueio da página/perfil comercial</li>
                  <li>Suspensão do pixel de rastreamento</li>
                  <li>Restrições no domínio raiz para futuros anúncios</li>
                </ul>
                <p className="mt-2 text-text-muted">
                  Use por sua conta e risco. A Umbra Bot não se responsabiliza por sanções aplicadas pelas plataformas.
                </p>
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

// ─── CreateLinkModal ───────────────────────────────────────────────────────────

function CreateLinkModal({ open, onClose, onCreate, existing }: {
  open: boolean; onClose: () => void
  onCreate: (opts: { destination: string; slug: string; redirectType: number; utm: UtmParams | null; cloaking: boolean; decoyUrl: string }) => void
  existing: LinkItem[]
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
  const canSubmit = destValid && slugClean.length >= 3 && !slugTaken && cloakingValid

  function submit() {
    if (!canSubmit) {
      if (!destValid) setError('Destino inválido. Use uma URL completa, com https://.')
      else if (!slugClean) setError('Slug inválido. Use apenas letras, números e hífens.')
      else if (slugTaken) setError('Já existe um link com esse slug. Escolha outro.')
      else if (cloaking && !decoyUrl.trim()) setError('Informe o URL alternativo (decoy) para cloaking.')
      else if (cloaking && !acknowledged) setError('Marque a confirmação de ciência sobre cloaking.')
      return
    }
    setError(''); setLoading(true)
    setTimeout(() => {
      onCreate({ destination, slug: slugClean, redirectType, utm: utmEnabled ? utm : null, cloaking, decoyUrl })
      setLoading(false); onClose()
    }, 900)
  }

  return (
    <Modal open={open} onClose={onClose} title="Criar redirecionador" subtitle="Crie um link curto com rastreamento personalizado." size="lg"
      footer={<><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn variant="primary" disabled={loading || !canSubmit} onClick={submit}>{loading ? <><Spinner /> Criando…</> : 'Criar link'}</Btn></>}
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger">
            <AlertCircle size={13} className="mt-0.5" />{error}
          </div>
        )}

        <div>
          <label className="block text-[12.5px] font-medium text-text mb-1.5">URL de destino</label>
          <input type="url" value={destination} onChange={e => setDestination(e.target.value)} autoFocus
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
            <span className="px-3 text-[12px] text-text-muted font-mono">{BASE_URL_R}</span>
            <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="meu-link-curto"
              className="flex-1 h-10 pr-3 bg-transparent text-[13px] font-mono text-text placeholder:text-text-subtle focus:outline-none" />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-text-muted">Pré-visualização: <span className="text-text font-mono">{BASE_URL_R}{slugClean || '…'}</span></span>
            {slugTaken && <span className="text-danger">Já existe</span>}
          </div>
        </div>

        <button onClick={() => setShowAdvanced(s => !s)} className="w-full inline-flex items-center justify-between text-[12.5px] font-medium text-text-muted hover:text-text rounded-md">
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
                    <button key={opt.id} onClick={() => setRedirectType(opt.id)} className={`text-left p-2.5 rounded-lg border-2 transition-colors ${active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2'}`}>
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
                  <p className="text-[11.5px] text-text-muted mt-0.5">Adiciona <code className="font-mono">utm_source/medium/campaign</code> ao destino para rastreamento no GA4 e Looker.</p>
                </div>
                <Switch checked={utmEnabled} onChange={setUtmEnabled} />
              </div>
              {utmEnabled && (
                <div className="p-3 grid grid-cols-3 gap-2">
                  {[{ key: 'source', placeholder: 'instagram' }, { key: 'medium', placeholder: 'cpc' }, { key: 'campaign', placeholder: 'black-2026' }].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-text-subtle mb-1">utm_{f.key}</label>
                      <input type="text" value={utm[f.key as keyof UtmParams]} onChange={e => setUtm(u => ({ ...u, [f.key]: e.target.value }))} placeholder={f.placeholder}
                        className="w-full h-8 px-2 bg-surface-2 border border-border rounded-md text-[12px] font-mono text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <CloakingSection enabled={cloaking} onChange={setCloaking} decoyUrl={decoyUrl} setDecoyUrl={setDecoyUrl} acknowledged={acknowledged} setAcknowledged={setAcknowledged} />
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── RedirectsPage ─────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { search: '', status: 'Todos os status' }

export default function RedirectsPage() {
  const [links, setLinks]     = useState<LinkItem[]>(INITIAL_LINKS)
  const [filters, setF]       = useState(DEFAULT_FILTERS)
  const [expanded, setExp]    = useState<string | null>(null)
  const [page, setPage]       = useState(1)
  const [createOpen, setCreate] = useState(false)
  const [toast, setToast]     = useState('')
  const [loading, setLoading] = useState(true)
  const perPage = 8

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('redirects').select('*').order('created_at', { ascending: false })
        if (!error && data && data.length > 0) {
          const r = rSeed(77)
          setLinks(data.map((row: Record<string, unknown>) => {
            const clicks = Number(row.clicks ?? 0)
            return {
              id: row.id as string,
              slug: row.slug as string,
              url: BASE_URL_R + (row.slug as string),
              destination: row.destination as string,
              destinationLabel: (row.destination_label as string) ?? (row.destination as string),
              clicks, uniqueClicks: Number(row.unique_clicks ?? 0),
              createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
              status: (row.status as LinkItem['status']) ?? 'active',
              cloaking: Boolean(row.cloaking),
              decoyUrl: (row.decoy_url as string) ?? '',
              utm: (row.utm as UtmParams | null) ?? null,
              redirectType: Number(row.redirect_type ?? 302),
              daily: makeDailyClicks(r, clicks),
              sources: makeBreakdown(r, clicks, sourcesRef),
              devices: makeBreakdown(r, clicks, devicesRef),
            }
          }))
        }
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { setPage(1); setExp(null) }, [filters])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t) }, [toast])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return links.filter(l => {
      if (q && !(l.slug.includes(q) || l.destination.toLowerCase().includes(q) || (l.destinationLabel || '').toLowerCase().includes(q))) return false
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
    clicks:       links.reduce((s, l) => s + l.clicks, 0),
    uniqueClicks: links.reduce((s, l) => s + l.uniqueClicks, 0),
    cloaking:     links.filter(l => l.cloaking).length,
  }), [links])

  const uniqueRate = totals.clicks > 0 ? (totals.uniqueClicks / totals.clicks) * 100 : 0

  async function createLink({ destination, slug, redirectType, utm, cloaking, decoyUrl }: { destination: string; slug: string; redirectType: number; utm: UtmParams | null; cloaking: boolean; decoyUrl: string }) {
    const r = rSeed(Date.now() % 99999)
    const newLink: LinkItem = {
      id: 'lnk_' + Date.now(), slug, url: BASE_URL_R + slug,
      destination, destinationLabel: destination,
      clicks: 0, uniqueClicks: 0, createdAt: Date.now(),
      status: 'active', cloaking, decoyUrl, utm, redirectType,
      daily: makeDailyClicks(r, 0), sources: makeBreakdown(r, 0, sourcesRef), devices: makeBreakdown(r, 0, devicesRef),
    }
    setLinks(arr => [newLink, ...arr])
    setToast(`Link ${BASE_URL_R}${slug} criado com sucesso.`)
    try {
      const supabase = createClient()
      await supabase.from('redirects').insert({ slug, destination, destination_label: destination, clicks: 0, unique_clicks: 0, status: 'active', cloaking, decoy_url: decoyUrl, utm, redirect_type: redirectType })
    } catch (_) {}
  }

  async function changeStatus(id: string, status: LinkItem['status']) {
    setLinks(arr => arr.map(l => l.id === id ? { ...l, status } : l))
    try { const supabase = createClient(); await supabase.from('redirects').update({ status }).eq('id', id) } catch (_) {}
  }

  const hasFilters = filters.search || filters.status !== 'Todos os status'

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <span className="inline-block w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Redirecionadores"
        subtitle="Links curtos rastreáveis para campanhas, bots e anúncios."
        actions={
          <>
            <Btn variant="secondary"><Download size={14} /> Exportar</Btn>
            <Btn variant="primary" onClick={() => setCreate(true)}><Plus size={14} /> Criar link</Btn>
          </>
        }
      />

      {toast && (
        <div className="mb-3 flex items-center gap-2.5 bg-success-soft border border-success/30 rounded-lg px-3 py-2">
          <CheckCircle2 size={15} className="text-success" />
          <div className="text-[12.5px] text-success">{toast}</div>
        </div>
      )}

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryR label="Links ativos"       value={`${totals.active} / ${totals.total}`} sub="conectados"         icon={Link2}           tone="primary" />
        <SummaryR label="Cliques no período" value={fmtNum(totals.clicks)}                delta={18.4}             icon={MousePointerClick} />
        <SummaryR label="Cliques únicos"     value={fmtNum(totals.uniqueClicks)}          sub={fmtPct(uniqueRate)} icon={Users} />
        <SummaryR label="Top link"           value={links[0] ? fmtNum(links[0].clicks) : '—'} sub={links[0]?.slug || ''} icon={TrendingUp} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" value={filters.search} onChange={e => setF(f => ({ ...f, search: e.target.value }))} placeholder="Buscar por slug ou destino…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
        <Dropdown label="Status" value={filters.status} options={['Todos os status', 'Ativos', 'Pausados', 'Arquivados']} onChange={v => setF(f => ({ ...f, status: v }))} />
        {hasFilters && (
          <button onClick={() => setF(DEFAULT_FILTERS)} className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2">
            <X size={13} /> Limpar
          </button>
        )}
        <div className="flex-1" />
        <div className="text-[11.5px] text-text-muted">{filtered.length} {filtered.length === 1 ? 'link' : 'links'}</div>
      </div>

      <div className="bg-surface border border-border rounded-xl">
        {filtered.length === 0 ? (
          <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4"><Link2 size={20} /></div>
            <div className="text-[14px] font-semibold text-text">Nenhum link encontrado</div>
            <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">Crie seu primeiro redirecionador ou limpe os filtros.</div>
            <Btn variant="primary" size="sm" onClick={() => setCreate(true)} className="mt-4"><Plus size={13} /> Criar link</Btn>
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
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(l => (
                  <LinkRow key={l.id} link={l} expanded={expanded === l.id}
                    onToggle={() => setExp(id => id === l.id ? null : l.id)}
                    onStatusChange={changeStatus} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11.5px] text-text-muted">
              Mostrando <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, filtered.length)}</span> de <span className="text-text font-medium">{filtered.length}</span> links
            </div>
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      <CreateLinkModal open={createOpen} onClose={() => setCreate(false)} onCreate={createLink} existing={links} />
    </DashboardLayout>
  )
}
