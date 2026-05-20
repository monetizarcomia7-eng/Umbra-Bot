'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot, Search, X, ArrowUpRight, Plus, BookOpen,
  ChevronLeft, ExternalLink, Pause, Play, Settings, MessageSquare, GitBranch,
  Eye, EyeOff, Copy, Check, AlertCircle, ChevronDown, ChevronRight,
  ShieldCheck, Webhook, Trash2, Save, Users, ShoppingBag, Target,
  CircleDollarSign, Info, ArrowLeft, CheckCircle2, Loader2, TriangleAlert,
  Camera, ArrowUp, ArrowDown, Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useDashboard } from '@/providers/DashboardProvider'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  validateBotTokenAction,
  saveBotAction,
  registerWebhookAction,
  getBotTokenAction,
  updateBotAction,
  deleteBotAction,
  getBotTelegramProfileAction,
  saveBotTelegramProfileAction,
  setBotPhotoAction,
} from '@/app/actions/bots'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RawBotRow {
  id: string
  name: string
  username: string | null
  status: string
  leads: number | null
  sales: number | null
  conversion: number | string | null
  revenue: number | string | null
  active_flow_id: string | null
  color: string | null
  telegram_id: string | null
  webhook_url: string | null
  last_sync: string | null
  added_at: string | null
  description: string | null
  welcome_message: string | null
  fallback_message: string | null
}

interface BotData {
  id: string
  name: string
  username: string
  status: 'online' | 'offline' | 'banned' | 'paused'
  leads: number
  sales: number
  conversion: number
  revenue: number
  activeFlowId: string | null
  color: string
  telegramId: string | null
  webhookUrl: string
  welcomeMessage: string
  fallbackMessage: string
  description: string
  lastSync: number | null
  addedAt: number
}

export interface FlowData {
  id: string
  name: string
  description: string | null
  status: string
}

const VALID_STATUSES = ['online', 'offline', 'banned', 'paused'] as const

function mapRaw(r: RawBotRow): BotData {
  return {
    id:             r.id,
    name:           r.name,
    username:       r.username ?? '',
    status:         (VALID_STATUSES.includes(r.status as typeof VALID_STATUSES[number]) ? r.status : 'offline') as BotData['status'],
    leads:          Number(r.leads ?? 0),
    sales:          Number(r.sales ?? 0),
    conversion:     Number(r.conversion ?? 0),
    revenue:        Number(r.revenue ?? 0),
    activeFlowId:   r.active_flow_id ?? null,
    color:          r.color ?? 'var(--primary)',
    telegramId:     r.telegram_id ?? null,
    webhookUrl:     r.webhook_url ?? '',
    welcomeMessage: r.welcome_message ?? '',
    fallbackMessage:r.fallback_message ?? '',
    description:    r.description ?? '',
    lastSync:       r.last_sync ? new Date(r.last_sync).getTime() : null,
    addedAt:        r.added_at ? new Date(r.added_at).getTime() : Date.now(),
  }
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRLdec(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }
function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function fmtDateTime(d: number) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  online:  { label: 'Online',  tone: 'success', dot: 'bg-[color:var(--success)]', pulse: true  },
  offline: { label: 'Offline', tone: 'warning', dot: 'bg-[color:var(--warning)]', pulse: false },
  banned:  { label: 'Banido',  tone: 'danger',  dot: 'bg-[color:var(--danger)]',  pulse: false },
  paused:  { label: 'Pausado', tone: 'muted',   dot: 'bg-text-subtle',            pulse: false },
} as const

const MESSAGE_VARS = ['nome', 'bot', 'produto', 'valor', 'data']

const DEFAULT_COMMANDS = [
  { command: 'start',   description: 'Iniciar o bot 🚀' },
  { command: 'suporte', description: 'Falar com suporte 💬' },
  { command: 'status',  description: 'Ver status do pedido 📊' },
]

// ─── UI Primitives ─────────────────────────────────────────────────────────────

function Card({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl">
      {title && (
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[14px] font-semibold text-text">{title}</div>
          {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '', type = 'button' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; onClick?: () => void
  disabled?: boolean; className?: string; type?: 'button' | 'submit'
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger hover:bg-danger/20',
  }[variant]
  return <button type={type} className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}
function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>{children}</span>
}

function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <span className="truncate max-w-[160px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
          {options.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}>
              {o === value && <Check size={12} />}
              <span className={o !== value ? 'pl-5' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title?: string | null; subtitle?: string | null
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface border border-border rounded-2xl shadow-xl w-full ${w} max-h-[90vh] flex flex-col`}>
        {title !== null && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
            <div>
              {title && <div className="text-[15px] font-semibold text-text">{title}</div>}
              {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
            </div>
            <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text shrink-0">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; Icon: React.ElementType }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-0.5 border-b border-border">
      {tabs.map(t => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none border-b-2 -mb-px ${
            active === t.id ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text hover:border-border'
          }`}>
          <t.Icon size={14} />{t.label}
        </button>
      ))}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function doCopy() {
    try { navigator.clipboard?.writeText(text) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button type="button" onClick={doCopy} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text" title="Copiar">
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  )
}

function ReadOnlyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{label}</div>
      <div className={`text-[12.5px] text-text mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function BotAvatar({ bot, size = 48 }: { bot: BotData; size?: number }) {
  const st = STATUS_CONFIG[bot.status]
  const dotSize = Math.round(size * 0.28)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-xl flex items-center justify-center text-white" style={{ background: bot.color }}>
        <Bot size={Math.round(size * 0.45)} />
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-surface ${st.dot}`} style={{ width: dotSize, height: dotSize }}>
        {st.pulse && <span className={`absolute inset-0 rounded-full ${st.dot} animate-ping opacity-50`} />}
      </span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[14px] font-semibold text-text leading-none tracking-tight truncate">{value}</div>
      <div className="text-[10.5px] text-text-muted mt-1 leading-tight">{label}</div>
    </div>
  )
}

function SummaryChip({ dot, label, count, pulse }: { dot: string; label: string; count: number; pulse?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 h-8 px-2.5 bg-surface border border-border rounded-lg text-[12px]">
      <span className={`relative w-2 h-2 rounded-full ${dot}`}>
        {pulse && count > 0 && <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-60`} />}
      </span>
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text">{count}</span>
    </div>
  )
}

// ─── TokenReveal ───────────────────────────────────────────────────────────────

function TokenReveal({ botId }: { botId: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function toggle() {
    if (token) { setToken(null); return }
    setLoading(true); setErr('')
    try {
      setToken(await getBotTokenAction(botId))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao revelar token.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="relative">
        <input type="text" value={token ?? '•'.repeat(42)} readOnly
          className="w-full h-10 pl-3 pr-20 bg-surface-2 border border-border rounded-lg text-[12px] font-mono text-text-muted" />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <button type="button" onClick={toggle} disabled={loading}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : token ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {token && <CopyButton text={token} />}
        </div>
      </div>
      {err && <p className="mt-1 text-[11px] text-danger flex items-center gap-1"><AlertCircle size={11} />{err}</p>}
    </div>
  )
}

// ─── RegisterWebhookButton ─────────────────────────────────────────────────────

function RegisterWebhookButton({
  botId, onSuccess, size = 'sm',
}: { botId: string; onSuccess: (url: string) => void; size?: 'sm' | 'md' }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handle() {
    setLoading(true); setErr('')
    try {
      const { webhookUrl } = await registerWebhookAction(botId)
      onSuccess(webhookUrl)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao registrar webhook.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Btn variant="primary" size={size} onClick={handle} disabled={loading}>
        {loading ? <><Loader2 size={13} className="animate-spin" /> Registrando…</> : <><Webhook size={13} /> Registrar webhook</>}
      </Btn>
      {err && <p className="mt-1.5 text-[11px] text-danger flex items-center gap-1"><AlertCircle size={11} />{err}</p>}
    </div>
  )
}

// ─── BotCard ───────────────────────────────────────────────────────────────────

function BotCard({ bot, flows, onOpen, onOpenTab }: {
  bot: BotData; flows: FlowData[]; onOpen: () => void; onOpenTab: (tab: string) => void
}) {
  const st = STATUS_CONFIG[bot.status]
  const flow = flows.find(f => f.id === bot.activeFlowId)
  const hasActivity = bot.leads > 0 || bot.sales > 0
  const telegramUrl = bot.username ? `https://t.me/${bot.username}` : null

  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group relative bg-surface border border-border rounded-xl p-5 text-left hover:border-border-strong transition-colors w-full cursor-pointer">

      {/* Header */}
      <div className="flex items-start gap-3.5">
        <BotAvatar bot={bot} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={st.tone}>{st.label}</Badge>
            {bot.username && <span className="text-[10.5px] text-text-subtle">@{bot.username}</span>}
          </div>
          <h3 className="text-[14px] font-semibold text-text leading-snug mt-1.5 truncate">{bot.name}</h3>
        </div>

        {/* Quick actions — visible on hover (#1 + #6) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={e => e.stopPropagation()}>
          {telegramUrl && (
            <>
              <div title="Copiar link t.me"><CopyButton text={telegramUrl} /></div>
              <a href={telegramUrl} target="_blank" rel="noreferrer" title="Abrir no Telegram"
                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text">
                <ExternalLink size={13} />
              </a>
            </>
          )}
          {bot.status === 'offline' && (
            <button type="button" title="Reconectar" onClick={onOpen}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-warning hover:bg-surface-3 hover:text-text">
              <Webhook size={13} />
            </button>
          )}
          <button type="button" title="Configurar" onClick={onOpen}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text">
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Stats 2×2 grid (#4 revenue added) */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-border">
        <Stat label="Leads"     value={fmtNum(bot.leads)} />
        <Stat label="Vendas"    value={fmtNum(bot.sales)} />
        <Stat label="Conversão" value={bot.conversion > 0 ? fmtPct(bot.conversion) : '—'} />
        <Stat label="Receita"   value={bot.revenue > 0 ? fmtBRLdec(bot.revenue) : '—'} />
      </div>

      {/* CTA when no activity (#2) */}
      {!hasActivity && (
        <p className="mt-2 text-[11px] text-text-subtle leading-snug">
          Compartilhe o link do bot para capturar seus primeiros leads.
        </p>
      )}

      {/* Flow footer — clickable (#3) */}
      <div role="button" tabIndex={-1}
        onClick={e => { e.stopPropagation(); onOpenTab('flow') }}
        className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-[11.5px] hover:text-text transition-colors">
        <GitBranch size={12} className="text-text-subtle shrink-0" />
        {flow ? (
          <>
            <span className="text-text-subtle">Fluxo:</span>
            <span className="text-text font-medium truncate">{flow.name}</span>
          </>
        ) : (
          <span className="text-primary font-medium">+ Vincular fluxo</span>
        )}
        <ArrowUpRight size={11} className="ml-auto text-text-subtle group-hover:text-primary transition-colors shrink-0" />
      </div>
    </div>
  )
}

// ─── BotsList ──────────────────────────────────────────────────────────────────

const SORT_OPTIONS = ['Maior receita', 'Mais leads', 'Mais vendas', 'Alfabético', 'Status'] as const
type SortOption = typeof SORT_OPTIONS[number]

function sortBots(bots: BotData[], by: SortOption): BotData[] {
  return [...bots].sort((a, b) => {
    if (by === 'Maior receita') return b.revenue  - a.revenue
    if (by === 'Mais leads')   return b.leads    - a.leads
    if (by === 'Mais vendas')  return b.sales    - a.sales
    if (by === 'Alfabético')   return a.name.localeCompare(b.name, 'pt-BR')
    if (by === 'Status') {
      const order: Record<string, number> = { online: 0, offline: 1, paused: 2, banned: 3 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    }
    return 0
  })
}

function BotsList({ bots, flows, onOpen, onOpenTab, onAddClick }: {
  bots: BotData[]; flows: FlowData[]
  onOpen: (id: string) => void
  onOpenTab: (id: string, tab: string) => void
  onAddClick: () => void
}) {
  const router = useRouter()
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('Todos os status')
  const [sortBy, setSortBy]   = useState<SortOption>('Maior receita')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bots.filter(b => {
      if (q && !(b.name.toLowerCase().includes(q) || b.username.toLowerCase().includes(q))) return false
      if (statusF === 'Online'   && b.status !== 'online')  return false
      if (statusF === 'Offline'  && b.status !== 'offline') return false
      if (statusF === 'Banidos'  && b.status !== 'banned')  return false
      if (statusF === 'Pausados' && b.status !== 'paused')  return false
      return true
    })
  }, [bots, search, statusF])

  const sorted = useMemo(() => sortBots(filtered, sortBy), [filtered, sortBy])

  const totals = useMemo(() => ({
    online:       bots.filter(b => b.status === 'online').length,
    offline:      bots.filter(b => b.status === 'offline').length,
    banned:       bots.filter(b => b.status === 'banned').length,
    totalLeads:   bots.reduce((s, b) => s + b.leads,   0),
    totalSales:   bots.reduce((s, b) => s + b.sales,   0),
    totalRevenue: bots.reduce((s, b) => s + b.revenue, 0),
  }), [bots])

  const hasFilters = search.trim() !== '' || statusF !== 'Todos os status'

  return (
    <>
      <PageHeader
        title="Gerenciar bots"
        subtitle={`${bots.length} ${bots.length === 1 ? 'bot conectado' : 'bots conectados'} · ${fmtNum(totals.totalLeads)} leads · ${fmtBRLdec(totals.totalRevenue)} em receita`}
        actions={
          <>
            <Btn variant="secondary" onClick={() => router.push('/dashboard/docs')}><BookOpen size={14} /> Documentação</Btn>
            <Btn variant="primary" onClick={onAddClick}><Plus size={14} /> Conectar novo bot</Btn>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SummaryChip dot="bg-[color:var(--success)]" label="Online"  count={totals.online}  pulse />
        <SummaryChip dot="bg-[color:var(--warning)]" label="Offline" count={totals.offline} />
        <SummaryChip dot="bg-[color:var(--danger)]"  label="Banidos" count={totals.banned}  />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bot por nome ou @username…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
        <Dropdown label="Status" value={statusF} options={['Todos os status', 'Online', 'Offline', 'Banidos', 'Pausados']} onChange={setStatusF} />
        <Dropdown label="Ordenar" value={sortBy} options={[...SORT_OPTIONS]} onChange={v => setSortBy(v as SortOption)} />
        {hasFilters && (
          <button type="button" onClick={() => { setSearch(''); setStatusF('Todos os status') }}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2">
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {bots.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-xl py-14 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4"><Bot size={20} /></div>
          <div className="text-[14px] font-semibold text-text">Nenhum bot conectado</div>
          <div className="text-[12.5px] text-text-muted mt-1 max-w-sm">Conecte seu primeiro bot do Telegram para começar a receber leads e vendas.</div>
          <Btn variant="primary" onClick={onAddClick} className="mt-4"><Plus size={14} /> Conectar novo bot</Btn>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-xl py-10 px-6 flex flex-col items-center justify-center text-center">
          <div className="text-[14px] font-semibold text-text">Nenhum bot encontrado</div>
          <div className="text-[12.5px] text-text-muted mt-1">Ajuste os filtros ou limpe a busca.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map(b => (
            <BotCard key={b.id} bot={b} flows={flows}
              onOpen={() => onOpen(b.id)}
              onOpenTab={tab => onOpenTab(b.id, tab)}
            />
          ))}
          <button type="button" onClick={onAddClick} className="group min-h-[200px] bg-surface-2/30 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-primary hover:bg-primary-soft/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3 group-hover:border-primary group-hover:text-primary transition-colors"><Plus size={20} /></div>
            <div className="text-[13px] font-semibold text-text">Conectar novo bot</div>
            <div className="text-[11.5px] text-text-muted mt-1 max-w-[200px] leading-snug">Cole o token do BotFather para começar.</div>
          </button>
        </div>
      )}
    </>
  )
}

// ─── AddBotModal ───────────────────────────────────────────────────────────────

function AddBotModal({ open, onClose, flows, onAdded }: {
  open: boolean; onClose: () => void; flows: FlowData[]
  onAdded: (bot: BotData) => void
}) {
  const [step, setStep]         = useState<'token' | 'confirm' | 'success'>('token')
  const [token, setToken]       = useState('')
  const [error, setError]       = useState('')
  const [validating, setValid]  = useState(false)
  const [adding, setAdding]     = useState(false)
  const [showHelp, setHelp]     = useState(false)
  const [linkFlow, setLinkFlow] = useState('Nenhum')
  const [editedName, setName]   = useState('')
  const [foundBot, setFound]    = useState<{ username: string; firstName: string; telegramId: string } | null>(null)
  // Stable webhook preview — computed once per confirm step
  const webhookPreviewRef = useRef('')

  useEffect(() => {
    if (open) {
      setStep('token'); setToken(''); setError(''); setValid(false)
      setAdding(false); setHelp(false); setLinkFlow('Nenhum'); setName(''); setFound(null)
    }
  }, [open])

  const tokenShape = /^\d{8,12}:[A-Za-z0-9_-]{30,}$/.test(token.trim())

  async function validate() {
    setError(''); setValid(true)
    try {
      const info = await validateBotTokenAction(token.trim())
      setFound(info)
      setName(info.firstName)
      webhookPreviewRef.current = `APP_URL/api/telegram/webhook?bot_id=<uuid>`
      setStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao validar token.')
    } finally {
      setValid(false)
    }
  }

  async function addBot() {
    if (!foundBot) return
    setAdding(true); setError('')
    try {
      const flowId = linkFlow === 'Nenhum' ? null : (flows.find(f => f.name === linkFlow)?.id ?? null)

      // 1. Salva com token criptografado no servidor
      const { id } = await saveBotAction({
        name:          editedName.trim(),
        token:         token.trim(),
        username:      foundBot.username,
        telegramId:    foundBot.telegramId,
        activeFlowId:  flowId,
      })

      // 2. Registra webhook (best effort — pode falhar; bot fica offline até reconectar)
      let webhookUrl = ''
      let status: BotData['status'] = 'offline'
      try {
        const result = await registerWebhookAction(id)
        webhookUrl = result.webhookUrl
        status     = 'online'
      } catch (_) {
        // Bot salvo mas offline; usuário pode registrar via aba Geral
      }

      const newBot: BotData = {
        id,
        name:           editedName.trim(),
        username:       foundBot.username,
        status,
        leads: 0, sales: 0, conversion: 0, revenue: 0,
        activeFlowId:   flowId,
        color:          'var(--primary)',
        telegramId:     foundBot.telegramId,
        webhookUrl,
        welcomeMessage: 'Olá {nome}! Bem-vindo. Em que posso te ajudar?',
        fallbackMessage:'Não entendi sua mensagem. Digite /menu para ver as opções.',
        description:    '',
        lastSync:       Date.now(),
        addedAt:        Date.now(),
      }
      onAdded(newBot)
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao conectar bot.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={step === 'success' ? null : 'Conectar novo bot'}
      subtitle={step === 'token' ? 'Cole o token gerado pelo BotFather no Telegram.' : null}
      footer={
        step === 'token' ? (
          <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" disabled={!tokenShape || validating} onClick={validate}>
              {validating ? <><Loader2 size={13} className="animate-spin" /> Validando…</> : 'Validar token'}
            </Btn></>
        ) : step === 'confirm' ? (
          <><Btn variant="secondary" onClick={() => setStep('token')}><ArrowLeft size={14} /> Voltar</Btn>
            <Btn variant="primary" onClick={addBot} disabled={adding || !editedName.trim()}>
              {adding ? <><Loader2 size={13} className="animate-spin" /> Conectando…</> : 'Adicionar bot'}
            </Btn></>
        ) : (
          <Btn variant="primary" onClick={onClose}>Concluir</Btn>
        )
      }
    >
      {step === 'token' && (
        <div className="space-y-3.5">
          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Token do bot</label>
            <input type="text" value={token} onChange={e => setToken(e.target.value)}
              placeholder="7234567890:ABCdefGHIjklMNOpqrSTU..." autoFocus
              className={`w-full h-11 px-3 bg-surface border rounded-lg text-[12.5px] font-mono text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 ${error ? 'border-danger focus:ring-danger/25' : 'border-border focus:ring-primary/30 focus:border-primary/50'}`}
            />
            {error && <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-danger"><AlertCircle size={12} />{error}</p>}
          </div>

          <button type="button" onClick={() => setHelp(s => !s)} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1">
            {showHelp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Como obter o token do BotFather?
          </button>

          {showHelp && (
            <div className="bg-surface-2/50 border border-border rounded-lg p-3.5 text-[12px] text-text-muted leading-relaxed">
              <ol className="space-y-2 list-decimal list-inside marker:text-text-subtle">
                <li>Abra o <strong className="text-text">@BotFather</strong> no Telegram.</li>
                <li>Envie <code className="bg-surface-3 px-1 rounded font-mono text-[11px]">/newbot</code> e siga as instruções.</li>
                <li>Copie o token completo (ex: <code className="bg-surface-3 px-1 rounded font-mono text-[11px]">12345:ABCDEF...</code>) e cole acima.</li>
                <li>O Umbra Bot configura o webhook automaticamente.</li>
              </ol>
            </div>
          )}

          <div className="flex items-start gap-2 bg-surface-2/40 border border-border rounded-lg p-3 text-[11.5px] text-text-muted">
            <ShieldCheck size={14} className="text-success mt-0.5 shrink-0" />
            <span>Seu token é armazenado criptografado com AES-256-GCM. Pode ser revogado a qualquer momento pelo BotFather.</span>
          </div>
        </div>
      )}

      {step === 'confirm' && foundBot && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-success-soft border border-success/30 rounded-lg">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0"><Bot size={20} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-success flex items-center gap-1">
                <Check size={11} /> Bot encontrado
              </div>
              <div className="text-[13.5px] font-semibold text-text mt-0.5">{foundBot.firstName}</div>
              <div className="text-[11.5px] text-text-muted">
                {foundBot.username ? `@${foundBot.username}` : 'Sem @username'} · ID {foundBot.telegramId}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome no Umbra Bot</label>
            <input type="text" value={editedName} onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
            <p className="text-[11px] text-text-muted mt-1">Usado apenas internamente — não altera o nome no Telegram.</p>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Vincular a um fluxo (opcional)</label>
            {flows.length > 0 ? (
              <Dropdown label="Fluxo" value={linkFlow} options={['Nenhum', ...flows.map(f => f.name)]} onChange={setLinkFlow} />
            ) : (
              <p className="text-[12px] text-text-muted">Nenhum fluxo criado ainda. Você pode vincular depois em Fluxos de venda.</p>
            )}
          </div>

          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-text">
              <Webhook size={13} className="text-success" /> Webhook configurado automaticamente
            </div>
            <p className="text-[11px] text-text-muted mt-1 font-mono">APP_URL/api/telegram/webhook?bot_id=&lt;uuid&gt;</p>
          </div>

          {error && <p className="flex items-center gap-1.5 text-[12px] text-danger"><AlertCircle size={13} />{error}</p>}
        </div>
      )}

      {step === 'success' && foundBot && (
        <div className="text-center py-6">
          <div className="relative w-14 h-14 mx-auto rounded-full bg-success-soft text-success flex items-center justify-center mb-4">
            <Check size={26} />
            <span className="absolute inset-0 rounded-full border border-success/40 animate-ping opacity-50" />
          </div>
          <h3 className="text-[16px] font-semibold text-text">Bot conectado!</h3>
          <p className="text-[12.5px] text-text-muted mt-1.5">
            <span className="text-text font-medium">{foundBot.username ? `@${foundBot.username}` : foundBot.firstName}</span> está pronto para receber mensagens.
          </p>
        </div>
      )}
    </Modal>
  )
}

// ─── TelegramProfileModal ─────────────────────────────────────────────────────

function TelegramProfileModal({ bot, open, onClose }: {
  bot: BotData; open: boolean; onClose: () => void
}) {
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [name,         setName]         = useState('')
  const [desc,         setDesc]         = useState('')
  const [short,        setShort]        = useState('')
  const [cmds,         setCmds]         = useState<Array<{ command: string; description: string }>>([])
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [newPhoto,     setNewPhoto]     = useState<File | null>(null)
  const [preview,      setPreview]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Revoga URL de objeto ao substituir ou desmontar
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  // Carrega perfil do Telegram ao abrir
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true); setError('')
    setNewPhoto(null); setPreview(null)

    getBotTelegramProfileAction(bot.id)
      .then(p => {
        if (cancelled) return
        setName(p.name)
        setDesc(p.description)
        setShort(p.shortDescription)
        setCmds(p.commands.length > 0 ? p.commands : DEFAULT_COMMANDS)
        setPhotoDataUrl(p.photoDataUrl)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar perfil.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [open, bot.id])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG ou GIF.'); return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 10MB.'); return
    }
    setError('')
    setNewPhoto(file)
    setPreview(URL.createObjectURL(file))
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  async function save() {
    setSaving(true); setError('')
    let photoErr = ''
    try {
      if (newPhoto) {
        const rp = await setBotPhotoAction(bot.id, newPhoto)
        if (!rp.ok) photoErr = rp.error ?? 'Erro ao atualizar foto.'
      }
      const r = await saveBotTelegramProfileAction(bot.id, {
        name:             name.trim(),
        description:      desc,
        shortDescription: short,
        commands:         cmds.filter(c => c.command.trim() && c.description.trim()),
      })
      if (!r.ok) {
        setError(r.error ?? 'Erro ao salvar no Telegram.')
      } else if (photoErr) {
        setError('Texto salvo! Foto não atualizada: ' + photoErr)
      } else {
        onClose()
      }
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function moveCmd(idx: number, dir: -1 | 1) {
    const next   = [...cmds]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setCmds(next)
  }

  function updateCmd(idx: number, field: 'command' | 'description', value: string) {
    setCmds(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  function removeCmd(idx: number) {
    setCmds(prev => prev.filter((_, i) => i !== idx))
  }

  const displayPhoto = preview ?? photoDataUrl

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar perfil no Telegram"
      subtitle="Alterações são aplicadas diretamente pelo Bot API do Telegram."
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || loading}>
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Salvando…</>
              : <><Save size={13} /> Salvar alterações</>}
          </Btn>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2.5 text-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Carregando perfil do Telegram…</span>
        </div>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-soft border border-danger/20 rounded-lg text-[12.5px] text-danger">
              <AlertCircle size={14} className="shrink-0" />{error}
            </div>
          )}

          {/* Foto de perfil */}
          <div>
            <div className="text-[12.5px] font-medium text-text mb-2">Foto de perfil</div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface-2 border-2 border-dashed border-border hover:border-primary transition-colors group shrink-0"
              >
                {displayPhoto ? (
                  <img src={displayPhoto} alt="Foto do bot" className="w-full h-full object-cover" />
                ) : (
                  <Bot size={28} className="absolute inset-0 m-auto text-text-muted" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={18} className="text-white" />
                </div>
              </button>
              <div className="text-[11.5px] text-text-muted leading-relaxed">
                <div className="font-medium text-text text-[12.5px] mb-1">Alterar foto de perfil</div>
                Clique na imagem para selecionar. JPG, PNG ou GIF — máximo 10MB.
                {newPhoto && <div className="text-success mt-1 text-[11px]">Nova foto: {newPhoto.name}</div>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={onFileChange} />
          </div>

          {/* @Username (somente leitura) */}
          {bot.username && (
            <div>
              <div className="text-[12.5px] font-medium text-text mb-1.5">@Username</div>
              <div className="h-10 px-3 bg-surface-2 border border-border rounded-lg text-[12.5px] font-mono text-text-muted flex items-center">
                @{bot.username}
              </div>
              <p className="text-[11px] text-text-muted mt-1">O @username só pode ser alterado pelo BotFather.</p>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome do bot</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={64}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          {/* Descrição */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-medium text-text">Descrição</label>
              <span className="text-[11px] text-text-muted">{desc.length}/512</span>
            </div>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value.slice(0, 512))}
              rows={3}
              placeholder="Descreva o que este bot faz…"
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
            />
          </div>

          {/* Descrição curta */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-medium text-text">Descrição curta</label>
              <span className="text-[11px] text-text-muted">{short.length}/120</span>
            </div>
            <textarea
              value={short}
              onChange={e => setShort(e.target.value.slice(0, 120))}
              rows={2}
              placeholder="Frase exibida na tela de início de conversa…"
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
            />
          </div>

          {/* Comandos */}
          <div>
            <div className="text-[12.5px] font-medium text-text mb-2">Comandos</div>
            <div className="space-y-2">
              {cmds.map((cmd, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button type="button" onClick={() => moveCmd(idx, -1)} disabled={idx === 0}
                      className="w-6 h-5 flex items-center justify-center rounded text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-25 disabled:pointer-events-none">
                      <ArrowUp size={11} />
                    </button>
                    <button type="button" onClick={() => moveCmd(idx, 1)} disabled={idx === cmds.length - 1}
                      className="w-6 h-5 flex items-center justify-center rounded text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-25 disabled:pointer-events-none">
                      <ArrowDown size={11} />
                    </button>
                  </div>
                  <span className="text-text-muted text-[13px] font-mono shrink-0">/</span>
                  <input
                    type="text"
                    value={cmd.command}
                    onChange={e => updateCmd(idx, 'command', e.target.value.replace(/[^a-z0-9_]/g, '').toLowerCase())}
                    placeholder="comando"
                    className="w-28 h-9 px-2 bg-surface border border-border rounded-lg text-[12.5px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 shrink-0"
                  />
                  <input
                    type="text"
                    value={cmd.description}
                    onChange={e => updateCmd(idx, 'description', e.target.value)}
                    placeholder="Descrição do comando…"
                    maxLength={256}
                    className="flex-1 h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 min-w-0"
                  />
                  <button type="button" onClick={() => removeCmd(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-danger-soft hover:text-danger shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => setCmds(prev => [...prev, { command: '', description: '' }])}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline">
              <Plus size={13} /> Adicionar comando
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── TextareaWithVars ─────────────────────────────────────────────────────────

function TextareaWithVars({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  function insertVar(v: string) {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart ?? value.length
    const end   = ta.selectionEnd   ?? value.length
    const insert = `{${v}}`
    onChange(value.substring(0, start) + insert + value.substring(end))
    requestAnimationFrame(() => { ta.focus(); const pos = start + insert.length; ta.setSelectionRange(pos, pos) })
  }
  return (
    <>
      <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed" />
      <div className="mt-2 flex flex-wrap gap-1 items-center text-[11px]">
        <span className="text-text-muted">Inserir variável:</span>
        {MESSAGE_VARS.map(v => (
          <button key={v} type="button" onClick={() => insertVar(v)}
            className="px-1.5 h-5 bg-surface-2 border border-border rounded font-mono text-[10.5px] text-text-muted hover:text-text hover:bg-surface-3">{`{${v}}`}</button>
        ))}
      </div>
    </>
  )
}

// ─── ChatBubble ────────────────────────────────────────────────────────────────

function ChatBubble({ text, incoming, placeholder }: { text: string; incoming?: boolean; placeholder?: boolean }) {
  return (
    <div className={`flex ${incoming ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[260px] text-[12px] leading-snug px-3 py-2 rounded-2xl whitespace-pre-wrap ${incoming ? 'bg-primary text-primary-fg rounded-br-sm' : 'bg-surface-2 text-text rounded-bl-sm'} ${placeholder ? 'opacity-50 italic' : ''}`}>
        {text}
      </div>
    </div>
  )
}

// ─── GeneralTab ────────────────────────────────────────────────────────────────

function GeneralTab({ bot, onUpdate, onStateUpdate, onDelete }: {
  bot: BotData
  onUpdate: (p: Partial<BotData>) => Promise<void>
  onStateUpdate: (p: Partial<BotData>) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [name, setName]             = useState(bot.name)
  const [description, setDesc]      = useState(bot.description)
  const [saving, setSaving]         = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [tgProfileOpen, setTgProfileOpen] = useState(false)
  const dirty = name !== bot.name || description !== bot.description

  async function save() {
    setSaving(true)
    await onUpdate({ name, description })
    setSaving(false)
  }

  return (
    <>
      <TelegramProfileModal bot={bot} open={tgProfileOpen} onClose={() => setTgProfileOpen(false)} />
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="space-y-4">
        <Card title="Informações básicas" subtitle="Dados internos do bot no Umbra Bot">
          <div className="space-y-3.5 mt-1">
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Descrição (interno)</label>
              <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="Curta descrição do propósito deste bot…"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px] pt-2 border-t border-border">
              {bot.username && <ReadOnlyRow label="@Username"           value={`@${bot.username}`} mono />}
              {bot.telegramId && <ReadOnlyRow label="Telegram ID"       value={bot.telegramId} mono />}
              <ReadOnlyRow label="Adicionado em"       value={fmtDate(bot.addedAt)} />
              {bot.lastSync && <ReadOnlyRow label="Última sincronização" value={fmtDateTime(bot.lastSync)} />}
            </div>
            {dirty && (
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Btn variant="ghost" size="sm" onClick={() => { setName(bot.name); setDesc(bot.description) }}>Descartar</Btn>
                <Btn variant="primary" size="sm" onClick={save} disabled={saving}>
                  {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : <><Save size={13} /> Salvar alterações</>}
                </Btn>
              </div>
            )}
          </div>
        </Card>

        <Card title="Perfil no Telegram" subtitle="Foto, nome, descrição e comandos visíveis para os usuários">
          <div className="flex items-center justify-between mt-1 gap-4">
            <p className="text-[12px] text-text-muted leading-relaxed">
              Personalize a aparência do bot diretamente pelo painel — sem precisar abrir o BotFather.
            </p>
            <Btn variant="secondary" size="sm" onClick={() => setTgProfileOpen(true)} className="shrink-0">
              <Pencil size={13} /> Editar perfil
            </Btn>
          </div>
        </Card>

        <Card title="Token & Webhook" subtitle="Credenciais técnicas do bot">
          <div className="space-y-3.5 mt-1">
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Token do BotFather</label>
              <TokenReveal botId={bot.id} />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Webhook URL</label>
              {bot.webhookUrl ? (
                <>
                  <div className="relative">
                    <input type="text" value={bot.webhookUrl} readOnly
                      className="w-full h-10 pl-3 pr-12 bg-surface-2 border border-border rounded-lg text-[12px] font-mono text-text-muted" />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2"><CopyButton text={bot.webhookUrl} /></div>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">Atualizado automaticamente quando você reconecta o bot.</p>
                  <div className="mt-2">
                    <RegisterWebhookButton botId={bot.id} onSuccess={url => onStateUpdate({ webhookUrl: url, status: 'online' })} />
                  </div>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 bg-warning-soft border border-warning/20 rounded-lg flex items-start gap-2.5">
                    <TriangleAlert size={14} className="text-warning shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[12.5px] font-medium text-text">Webhook não configurado</div>
                      <div className="text-[11.5px] text-text-muted mt-0.5">O bot não receberá mensagens até que o webhook seja registrado.</div>
                    </div>
                  </div>
                  <RegisterWebhookButton botId={bot.id} onSuccess={url => onStateUpdate({ webhookUrl: url, status: 'online' })} />
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="bg-surface border-2 border-danger/30 rounded-xl p-5">
          <div className="text-[14px] font-semibold text-danger">Zona de perigo</div>
          <div className="text-[12px] text-text-muted mt-1 max-w-md">Remover o bot desconecta o webhook e arquiva todas as mensagens em fila. Esta ação não pode ser desfeita.</div>
          <div className="mt-4">
            {confirmDel ? (
              <div className="flex items-center gap-2">
                <Btn variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Btn>
                <Btn variant="danger" size="sm" onClick={() => onDelete(bot.id)}><Trash2 size={13} /> Sim, remover bot</Btn>
              </div>
            ) : (
              <Btn variant="secondary" size="sm" onClick={() => setConfirmDel(true)}><Trash2 size={13} /> Remover este bot</Btn>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Card title="Status" subtitle="Controle a operação do bot">
          <div className="space-y-3 mt-1">
            <div className={`p-3 rounded-lg border ${
              bot.status === 'online'  ? 'bg-success-soft border-success/20' :
              bot.status === 'banned'  ? 'bg-danger-soft border-danger/20'   : 'bg-surface-2 border-border'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`relative w-2 h-2 rounded-full ${STATUS_CONFIG[bot.status].dot}`}>
                  {STATUS_CONFIG[bot.status].pulse && <span className={`absolute inset-0 rounded-full ${STATUS_CONFIG[bot.status].dot} animate-ping opacity-60`} />}
                </span>
                <span className="text-[13px] font-semibold text-text">{STATUS_CONFIG[bot.status].label}</span>
              </div>
              <div className="text-[11.5px] text-text-muted mt-1.5">
                {bot.status === 'online'  && 'Recebendo e respondendo mensagens normalmente.'}
                {bot.status === 'offline' && 'Sem conexão com o Telegram. Registre o webhook para retomar.'}
                {bot.status === 'banned'  && 'Bot banido pelo Telegram. Substitua para retomar a operação.'}
                {bot.status === 'paused'  && 'Pausado manualmente. Mensagens em fila não estão sendo entregues.'}
              </div>
            </div>
            {bot.lastSync && (
              <p className="text-[11.5px] text-text-muted">Última sincronização: <span className="text-text">{fmtDateTime(bot.lastSync)}</span></p>
            )}
          </div>
        </Card>
      </div>
    </div>
    </>
  )
}

// ─── MessagesTab ───────────────────────────────────────────────────────────────

function MessagesTab({ bot, onUpdate }: { bot: BotData; onUpdate: (p: Partial<BotData>) => Promise<void> }) {
  const [welcome,  setWelcome]  = useState(bot.welcomeMessage)
  const [fallback, setFallback] = useState(bot.fallbackMessage)
  const [saving, setSaving]     = useState(false)
  const dirty = welcome !== bot.welcomeMessage || fallback !== bot.fallbackMessage

  async function save() {
    setSaving(true)
    await onUpdate({ welcomeMessage: welcome, fallbackMessage: fallback })
    setSaving(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="space-y-4">
        <Card title="Mensagem de boas-vindas" subtitle="Enviada automaticamente quando um usuário inicia conversa pela primeira vez.">
          <TextareaWithVars value={welcome} onChange={setWelcome} rows={5} placeholder="Olá {nome}! Bem-vindo…" />
        </Card>
        <Card title="Mensagem fallback" subtitle="Resposta automática quando o bot não entende a mensagem do usuário.">
          <TextareaWithVars value={fallback} onChange={setFallback} rows={4} placeholder="Não entendi sua mensagem…" />
        </Card>
        {dirty && (
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => { setWelcome(bot.welcomeMessage); setFallback(bot.fallbackMessage) }}>Descartar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : <><Save size={13} /> Salvar alterações</>}
            </Btn>
          </div>
        )}
      </div>

      <div>
        <Card title="Pré-visualização" subtitle="Como aparece no Telegram">
          <div className="mt-2 space-y-2.5">
            <ChatBubble
              text={welcome.replace(/\{nome\}/g, 'João').replace(/\{bot\}/g, bot.name) || 'Mensagem de boas-vindas aparece aqui…'}
              placeholder={!welcome}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-border space-y-2.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Quando não entende</div>
            <ChatBubble incoming text="?? quanto custa" />
            <ChatBubble text={fallback.replace(/\{nome\}/g, 'João') || 'Mensagem de fallback aparece aqui…'} placeholder={!fallback} />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── FlowTab ───────────────────────────────────────────────────────────────────

function FlowTab({ bot, flows, onUpdate }: { bot: BotData; flows: FlowData[]; onUpdate: (p: Partial<BotData>) => Promise<void> }) {
  const current = flows.find(f => f.id === bot.activeFlowId)
  const others  = flows.filter(f => f.id !== bot.activeFlowId)

  return (
    <div className="space-y-4">
      <Card title="Fluxo ativo" subtitle="Fluxo de mensagens executado quando o usuário interage com o bot">
        {current ? (
          <div className="mt-2 flex items-start gap-4 p-4 bg-primary-soft/40 border border-primary/20 rounded-lg">
            <div className="w-11 h-11 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
              <GitBranch size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-text">{current.name}</div>
              {current.description && <div className="text-[12px] text-text-muted mt-0.5 leading-relaxed">{current.description}</div>}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1"><Users size={11} /> {fmtNum(bot.leads)} leads</span>
                <span className="inline-flex items-center gap-1"><ShoppingBag size={11} /> {fmtNum(bot.sales)} vendas</span>
                <span className="inline-flex items-center gap-1"><Target size={11} /> conv. {fmtPct(bot.conversion)}</span>
                <span className="inline-flex items-center gap-1"><CircleDollarSign size={11} /> {fmtBRLdec(bot.revenue)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Btn variant="ghost" size="sm" onClick={() => onUpdate({ activeFlowId: null })}><X size={13} /> Desvincular</Btn>
            </div>
          </div>
        ) : (
          <div className="mt-2 p-4 bg-surface-2/40 border border-dashed border-border rounded-lg flex items-center gap-3 text-[12.5px] text-text-muted">
            <Info size={14} /> Nenhum fluxo vinculado. Selecione um abaixo para começar.
          </div>
        )}
      </Card>

      <Card title="Outros fluxos disponíveis" subtitle="Clique para vincular ao bot">
        {others.length === 0 && !current ? (
          <div className="py-6 text-center text-[12.5px] text-text-muted">
            Nenhum fluxo criado ainda. Crie fluxos em <strong className="text-text">Fluxos de venda</strong>.
          </div>
        ) : others.length === 0 ? (
          <div className="py-4 text-[12.5px] text-text-muted text-center">Todos os fluxos já estão vinculados a este bot.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {others.map(f => (
              <button key={f.id} type="button" onClick={() => onUpdate({ activeFlowId: f.id })}
                className="text-left p-3 bg-surface border border-border rounded-lg hover:border-primary hover:bg-primary-soft/20 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-surface-2 text-text-muted group-hover:bg-primary-soft group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                    <GitBranch size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-text truncate">{f.name}</div>
                    {f.description && <div className="text-[11px] text-text-muted truncate">{f.description}</div>}
                  </div>
                  <ArrowUpRight size={12} className="text-text-subtle group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── BotConfig ─────────────────────────────────────────────────────────────────

function BotConfig({ bot, flows, onBack, onUpdate, onStateUpdate, onDelete, defaultTab = 'geral' }: {
  bot: BotData; flows: FlowData[]; onBack: () => void
  onUpdate: (p: Partial<BotData>) => Promise<void>
  onStateUpdate: (p: Partial<BotData>) => void
  onDelete: (id: string) => Promise<void>
  defaultTab?: string
}) {
  const [tab, setTab] = useState(defaultTab)
  const TABS = [
    { id: 'geral',    label: 'Geral',            Icon: Settings      },
    { id: 'messages', label: 'Mensagens padrão', Icon: MessageSquare  },
    { id: 'flow',     label: 'Fluxo vinculado',  Icon: GitBranch      },
  ]

  const st = STATUS_CONFIG[bot.status]

  return (
    <>
      <div className="-mt-1 mb-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text mb-4 px-1">
          <ChevronLeft size={14} /> Voltar para todos os bots
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <BotAvatar bot={bot} size={56} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight text-text leading-tight">{bot.name}</h1>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className="text-[12.5px] text-text-muted mt-0.5">
                {bot.username ? `@${bot.username} · ` : ''}{bot.telegramId ? `ID ${bot.telegramId} · ` : ''}Adicionado {fmtDate(bot.addedAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {bot.username && (
              <a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer">
                <Btn variant="secondary"><ExternalLink size={13} /> Ver no Telegram</Btn>
              </a>
            )}
            {bot.status === 'online'  && <Btn variant="secondary" onClick={() => onUpdate({ status: 'paused' })}><Pause size={13} /> Pausar</Btn>}
            {bot.status === 'paused'  && <Btn variant="primary"   onClick={() => onUpdate({ status: 'online' })}><Play  size={13} /> Retomar</Btn>}
            {bot.status === 'offline' && <RegisterWebhookButton botId={bot.id} size="md" onSuccess={url => onStateUpdate({ webhookUrl: url, status: 'online' })} />}
          </div>
        </div>
      </div>

      <div className="mb-5"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>

      {tab === 'geral'    && <GeneralTab  bot={bot} onUpdate={onUpdate} onStateUpdate={onStateUpdate} onDelete={onDelete} />}
      {tab === 'messages' && <MessagesTab bot={bot} onUpdate={onUpdate} />}
      {tab === 'flow'     && <FlowTab     bot={bot} flows={flows} onUpdate={onUpdate} />}
    </>
  )
}

// ─── BotsClient ────────────────────────────────────────────────────────────────

export default function BotsClient({ initialBots, flows, userId }: {
  initialBots: RawBotRow[]
  flows: FlowData[]
  userId: string
}) {
  const [bots, setBots]       = useState<BotData[]>(() => initialBots.map(mapRaw))
  const [selectedId, setSelected] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('geral')
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const { refreshBotsCount }  = useDashboard()

  // Supabase Realtime — sincroniza status dos bots (ex: cron detecta disconnect)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('bots-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bots', filter: `user_id=eq.${userId}` },
        (payload) => {
          setBots(prev => prev.map(b =>
            b.id === (payload.new as RawBotRow).id ? { ...b, ...mapRaw(payload.new as RawBotRow) } : b
          ))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const selected = bots.find(b => b.id === selectedId)

  function openBot(id: string, tab = 'geral') {
    setSelectedTab(tab)
    setSelected(id)
  }

  // Atualiza estado local SEM chamar o banco (para pós-server-action external)
  function setBotState(id: string, patch: Partial<BotData>) {
    setBots(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
  }

  // Atualiza local + banco com rollback em caso de erro
  async function updateBot(patch: Partial<BotData>) {
    if (!selectedId) return
    const snapshot = bots.slice()
    setBotState(selectedId, patch) // optimistic
    try {
      const dbPatch: Parameters<typeof updateBotAction>[1] = {}
      if (patch.name             !== undefined) dbPatch.name             = patch.name
      if (patch.description      !== undefined) dbPatch.description      = patch.description
      if (patch.status           !== undefined) dbPatch.status           = patch.status as typeof dbPatch.status
      if (patch.welcomeMessage   !== undefined) dbPatch.welcome_message  = patch.welcomeMessage
      if (patch.fallbackMessage  !== undefined) dbPatch.fallback_message = patch.fallbackMessage
      if (patch.activeFlowId     !== undefined) dbPatch.active_flow_id   = patch.activeFlowId

      if (Object.keys(dbPatch).length > 0) {
        await updateBotAction(selectedId, dbPatch)
      }
      setToast({ msg: 'Alterações salvas.', type: 'success' })
    } catch (e) {
      setBots(snapshot) // rollback
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao salvar.', type: 'error' })
    }
  }

  async function deleteBot(id: string) {
    const snapshot = bots.slice()
    setBots(arr => arr.filter(b => b.id !== id))
    setSelected(null)
    try {
      await deleteBotAction(id)
      refreshBotsCount()
      setToast({ msg: 'Bot removido.', type: 'success' })
    } catch (e) {
      setBots(snapshot)
      setSelected(id)
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao remover bot.', type: 'error' })
    }
  }

  function handleBotAdded(bot: BotData) {
    setBots(arr => [bot, ...arr])
    refreshBotsCount()
    setToast({ msg: `Bot ${bot.username ? `@${bot.username}` : bot.name} conectado com sucesso.`, type: 'success' })
  }

  return (
    <>
      {toast && (
        <div className={`mb-3 flex items-center gap-2.5 border rounded-lg px-3.5 py-2 ${
          toast.type === 'error'
            ? 'bg-danger-soft border-danger/30'
            : 'bg-surface border-border'
        }`} style={{ boxShadow: 'var(--shadow-md)' }}>
          {toast.type === 'error'
            ? <TriangleAlert size={15} className="text-danger" />
            : <CheckCircle2  size={15} className="text-success" />}
          <div className="text-[12.5px] text-text">{toast.msg}</div>
        </div>
      )}

      {selected ? (
        <BotConfig
          bot={selected}
          flows={flows}
          defaultTab={selectedTab}
          onBack={() => setSelected(null)}
          onUpdate={updateBot}
          onStateUpdate={(patch) => setBotState(selected.id, patch)}
          onDelete={deleteBot}
        />
      ) : (
        <BotsList
          bots={bots}
          flows={flows}
          onOpen={id => openBot(id)}
          onOpenTab={openBot}
          onAddClick={() => setAddOpen(true)}
        />
      )}

      <AddBotModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        flows={flows}
        onAdded={handleBotAdded}
      />
    </>
  )
}
