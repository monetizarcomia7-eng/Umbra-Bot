'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  CreditCard, Ban, WifiOff, Gauge, Clock, TrendingUp, ShieldAlert, ShieldCheck,
  AlertTriangle, AlertCircle, Info, CheckCircle2, RotateCcw, MoreHorizontal,
  Bell, X, FilterX, CheckCheck, Play, BarChart3, Plug, TrendingDown,
  Inbox, XCircle, CircleDollarSign, Users, Globe, Sparkles, Calendar, Check,
  Bot, ChevronDown, Trash2, UserPlus, ArrowRight,
  type LucideIcon,
} from 'lucide-react'

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface RawAlert {
  id: string
  type: string
  severity: string
  title: string
  description: string
  context: { icon: string; label: string }[] | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  resolved_by_id: string | null
  source: string | null
  action_taken: string | null
  viewed_at: string | null
  created_at: string
  user_id: string
}

// ─── Tipos internos ────────────────────────────────────────────────────────────

type AlertType =
  | 'gateway_fail' | 'bot_banned' | 'bot_offline' | 'send_quota'
  | 'webhook_fail' | 'payment_pending' | 'limit_warning' | 'ssl_expiring' | 'sale'
  | 'webhookFailed' | 'team_invite'
type Severity = 'critical' | 'warning' | 'info'

interface CtxChip { icon: string; label: string }

interface Alert {
  id: string
  type: AlertType
  severity: Severity
  title: string
  desc: string
  dt: number
  resolved: boolean
  resolvedAt?: number
  resolvedBy?: string
  context: CtxChip[]
}

// ─── Config maps ───────────────────────────────────────────────────────────────

const ALERT_TYPES: Record<AlertType, {
  icon: LucideIcon
  categoryLabel: string
  actionLabel: string
  actionIcon: LucideIcon
  actionUrl: string
}> = {
  gateway_fail:    { icon: CreditCard,       categoryLabel: 'Gateway',    actionLabel: 'Ver gateways',     actionIcon: RotateCcw,   actionUrl: '/dashboard/gateways'      },
  bot_banned:      { icon: Ban,              categoryLabel: 'Bot',         actionLabel: 'Gerenciar bots',   actionIcon: Bot,         actionUrl: '/dashboard/bots'          },
  bot_offline:     { icon: WifiOff,          categoryLabel: 'Bot',         actionLabel: 'Gerenciar bots',   actionIcon: RotateCcw,   actionUrl: '/dashboard/bots'          },
  send_quota:      { icon: Gauge,            categoryLabel: 'Plano',       actionLabel: 'Ver plano',        actionIcon: TrendingUp,  actionUrl: '/dashboard/notifications' },
  webhook_fail:    { icon: AlertCircle,      categoryLabel: 'Integração',  actionLabel: 'Ver webhooks',     actionIcon: Play,        actionUrl: '/dashboard/webhooks'      },
  payment_pending: { icon: Clock,            categoryLabel: 'Pagamento',   actionLabel: 'Ver financeiro',   actionIcon: Globe,       actionUrl: '/dashboard/finance'       },
  limit_warning:   { icon: TrendingUp,       categoryLabel: 'Plano',       actionLabel: 'Ver plano',        actionIcon: BarChart3,   actionUrl: '/dashboard/notifications' },
  ssl_expiring:    { icon: ShieldAlert,      categoryLabel: 'Domínio',     actionLabel: 'Ver integrações',  actionIcon: ShieldCheck, actionUrl: '/dashboard/redirects'     },
  sale:            { icon: CircleDollarSign, categoryLabel: 'Venda',        actionLabel: 'Ver financeiro',   actionIcon: TrendingUp,  actionUrl: '/dashboard/finance'       },
  webhookFailed:   { icon: AlertCircle,      categoryLabel: 'Integração',   actionLabel: 'Ver webhooks',     actionIcon: Play,        actionUrl: '/dashboard/webhooks'      },
  team_invite:     { icon: UserPlus,         categoryLabel: 'Equipe',       actionLabel: 'Ver convite',      actionIcon: ArrowRight,  actionUrl: '/dashboard/profile'       },
}

const SEVERITY_CONFIG: Record<Severity, { label: string; tone: string; bg: string; text: string; severityIcon: LucideIcon }> = {
  critical: { label: 'Crítico',     tone: 'danger',  bg: 'bg-danger-soft',  text: 'text-danger',  severityIcon: AlertTriangle },
  warning:  { label: 'Atenção',     tone: 'warning', bg: 'bg-warning-soft', text: 'text-warning', severityIcon: AlertCircle   },
  info:     { label: 'Informativo', tone: 'primary', bg: 'bg-primary-soft', text: 'text-primary', severityIcon: Info          },
}

const CHIP_ICONS: Record<string, LucideIcon> = {
  plug: Plug, 'trending-down': TrendingDown, inbox: Inbox, webhook: AlertCircle,
  'x-circle': XCircle, 'circle-dollar-sign': CircleDollarSign, users: Users,
  globe: Globe, sparkles: Sparkles, calendar: Calendar, bot: Bot, clock: Clock,
  'check-circle-2': CheckCircle2, gauge: Gauge, 'shield-check': ShieldCheck,
  'credit-card': CreditCard, ban: Ban,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mapRaw(row: RawAlert): Alert {
  const knownTypes = Object.keys(ALERT_TYPES) as AlertType[]
  const knownSevs: Severity[] = ['critical', 'warning', 'info']
  return {
    id:         row.id,
    type:       knownTypes.includes(row.type as AlertType) ? (row.type as AlertType) : 'gateway_fail',
    severity:   knownSevs.includes(row.severity as Severity) ? (row.severity as Severity) : 'warning',
    title:      row.title ?? '',
    desc:       row.description ?? '',
    dt:         row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    resolved:   row.resolved,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
    resolvedBy: row.resolved_by ?? undefined,
    context:    Array.isArray(row.context) ? row.context : [],
  }
}

function relTime(dt: number, now: number) {
  const diff = Math.max(0, now - dt)
  const s = Math.floor(diff / 1000)
  if (s < 30) return 'agora'
  if (s < 60) return `há ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d} d`
  return new Date(dt).toLocaleDateString('pt-BR')
}

function fmtDateTime(dt: number) {
  return new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── UI primitivos ─────────────────────────────────────────────────────────────

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}

function Badge({ children, tone = 'muted', icon: Icon }: {
  children: React.ReactNode; tone?: string; icon?: LucideIcon
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>
      {Icon && <Icon size={10} />}{children}
    </span>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'
  onClick?: () => void; disabled?: boolean; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v    = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
  }[variant]
  return (
    <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function DropdownSelect({ label, value, options, onChange, width = 200 }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2 focus-ring"
      >
        <span className="truncate max-w-[140px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1"
          style={{ minWidth: width }}
        >
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

// ─── Context Chip ──────────────────────────────────────────────────────────────

function ContextChip({ icon, label }: CtxChip) {
  const Icon = CHIP_ICONS[icon]
  return (
    <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-surface-2 border border-border text-[10.5px] font-medium text-text-muted tnum whitespace-nowrap">
      {Icon && <Icon size={10} />}{label}
    </span>
  )
}

// ─── Summary Cards ─────────────────────────────────────────────────────────────

function SeverityCard({ label, value, tone, icon: Icon, sub, big }: {
  label: string; value: number; tone: Severity; icon: LucideIcon; sub: string; big?: boolean
}) {
  const s = SEVERITY_CONFIG[tone]
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${s.bg} ${s.text}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className={`text-[28px] font-semibold tnum tracking-tight leading-none ${big && value > 0 ? s.text : 'text-text'}`}>
        {value}
      </div>
      <div className="text-[11.5px] text-text-muted mt-2">{sub}</div>
    </div>
  )
}

// ─── Filter Bar ────────────────────────────────────────────────────────────────

const SEV_OPTIONS    = ['Todas as severidades', 'Crítico', 'Atenção', 'Informativo']
const STATUS_OPTIONS = ['Ativos', 'Resolvidos', 'Todos']
const TYPE_OPTIONS   = ['Todos os tipos', 'Gateway', 'Bot', 'Integração', 'Plano', 'Pagamento', 'Domínio', 'Venda']

interface Filters { severity: string; status: string; type: string }

const DEFAULT_FILTERS: Filters = {
  severity: 'Todas as severidades',
  status:   'Ativos',
  type:     'Todos os tipos',
}

function FilterBar({ filters, setFilters, hasFilters, onClear, counts }: {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  hasFilters: boolean
  onClear: () => void
  counts: { shown: number; total: number }
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <DropdownSelect
        label="Severidade"
        value={filters.severity}
        options={SEV_OPTIONS}
        onChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
        width={220}
      />
      <DropdownSelect
        label="Status"
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
      />
      <DropdownSelect
        label="Tipo"
        value={filters.type}
        options={TYPE_OPTIONS}
        onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
        width={200}
      />
      {hasFilters && (
        <button
          onClick={onClear}
          className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-ring"
        >
          <X size={13} />Limpar
        </button>
      )}
      <div className="flex-1" />
      <div className="text-[11.5px] text-text-muted tnum">
        {counts.shown} {counts.shown === 1 ? 'alerta' : 'alertas'}
        {counts.shown !== counts.total && (
          <> de <span className="text-text font-medium">{counts.total}</span></>
        )}
      </div>
    </div>
  )
}

// ─── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, now, onResolve, onReopen, onAction, onDelete }: {
  alert: Alert
  now: number
  onResolve: (id: string) => void
  onReopen:  (id: string) => void
  onAction:  (a: Alert)   => void
  onDelete:  (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const cfg  = ALERT_TYPES[alert.type] ?? ALERT_TYPES.gateway_fail
  const sev  = SEVERITY_CONFIG[alert.severity]
  const TypeIcon   = cfg.icon
  const SevIcon    = sev.severityIcon
  const ActionIcon = cfg.actionIcon

  return (
    <article
      className={`relative bg-surface border rounded-xl p-4 transition-opacity ${
        alert.resolved ? 'border-border opacity-70' : 'border-border hover:border-border-strong'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${sev.bg} ${sev.text}`}>
          <TypeIcon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Badge tone={sev.tone} icon={SevIcon}>{sev.label}</Badge>
              <span className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">
                {cfg.categoryLabel}
              </span>
              {alert.resolved && <Badge tone="success" icon={Check}>Resolvido</Badge>}
            </div>
            <time
              className="text-[11px] text-text-muted tnum whitespace-nowrap"
              title={fmtDateTime(alert.dt)}
            >
              {relTime(alert.dt, now)}
            </time>
          </div>

          <h3 className="text-[14.5px] font-semibold text-text mt-1.5 leading-snug">{alert.title}</h3>
          <p className="text-[12.5px] text-text-muted mt-1 leading-relaxed max-w-2xl">{alert.desc}</p>

          {alert.context.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {alert.context.map((c, i) => <ContextChip key={i} icon={c.icon} label={c.label} />)}
            </div>
          )}

          {alert.resolved ? (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11.5px] text-text-muted">
                <CheckCircle2 size={11} className="text-success inline-block -mt-px mr-1" />
                Resolvido {relTime(alert.resolvedAt!, now)}
                {alert.resolvedBy && (
                  <> · por <span className="text-text">{alert.resolvedBy}</span></>
                )}
              </div>
              <button
                onClick={() => onReopen(alert.id)}
                className="text-[11.5px] font-medium text-text-muted hover:text-text inline-flex items-center gap-1 focus-ring rounded px-1"
              >
                <RotateCcw size={11} />Reabrir alerta
              </button>
            </div>
          ) : (
            <div className="mt-3.5 flex items-center gap-2 flex-wrap">
              <Btn variant="primary" size="sm" onClick={() => onAction(alert)}>
                <ActionIcon size={13} />{cfg.actionLabel}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => onResolve(alert.id)}>
                <Check size={13} />Marcar como resolvido
              </Btn>

              <div className="ml-auto relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-ring"
                  title="Mais opções"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 bottom-full mb-1.5 bg-surface border border-border rounded-xl shadow-lg py-1 z-50 min-w-[160px]">
                    <button
                      onClick={() => { onDelete(alert.id); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-[12.5px] text-danger hover:bg-danger-soft flex items-center gap-2"
                    >
                      <Trash2 size={13} />Apagar alerta
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// ─── Empty states ──────────────────────────────────────────────────────────────

function EmptyHappy({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div className="bg-surface border border-border rounded-xl py-20 px-6 flex flex-col items-center justify-center text-center">
      <div className="relative w-16 h-16 rounded-2xl bg-success-soft text-success flex items-center justify-center mb-5">
        <CheckCircle2 size={28} />
        <span className="absolute inset-0 rounded-2xl border border-success/30 animate-ping opacity-50" />
      </div>
      <h3 className="text-[18px] font-semibold text-text">Tudo certo por aqui</h3>
      <p className="text-[13px] text-text-muted mt-1.5 max-w-sm leading-relaxed">
        Nenhum alerta ativo no momento. Seus bots, gateways e integrações estão operando normalmente.
      </p>
      <div className="mt-5">
        <Btn variant="secondary" onClick={onConfigure}><Bell size={14} />Configurar alertas</Btn>
      </div>
    </div>
  )
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="bg-surface border border-dashed border-border rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
        <FilterX size={20} />
      </div>
      <div className="text-[14px] font-semibold text-text">Nenhum alerta corresponde aos filtros</div>
      <p className="text-[12.5px] text-text-muted mt-1 max-w-sm">
        Ajuste a severidade, o status ou o tipo para ver mais resultados.
      </p>
      <Btn variant="secondary" size="sm" onClick={onClear} className="mt-4">
        <X size={13} />Limpar filtros
      </Btn>
    </div>
  )
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50
const SEV_MAP: Record<string, Severity> = {
  'Crítico': 'critical', 'Atenção': 'warning', 'Informativo': 'info',
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function AlertsClient({
  initialAlerts,
  userId,
  userName,
}: {
  initialAlerts: RawAlert[]
  userId: string
  userName: string
}) {
  const router   = useRouter()
  const { track } = useAnalytics()

  const [alerts,      setAlerts]      = useState<Alert[]>(() => initialAlerts.map(mapRaw))
  const [filters,     setFilters]     = useState<Filters>(DEFAULT_FILTERS)
  const [now,         setNow]         = useState(Date.now)   // ← CORRIGIDO: Date.now real
  const [toast,       setToast]       = useState('')
  const [confirmAll,  setConfirmAll]  = useState(false)
  const [offset,      setOffset]      = useState(initialAlerts.length)
  const [hasMore,     setHasMore]     = useState(initialAlerts.length === PAGE_SIZE)
  const [loadingMore, setLoadingMore] = useState(false)

  // Realtime — INSERT e UPDATE filtrados por user_id
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel('alerts-feed')
      .on('postgres_changes' as any, {
        event: 'INSERT', schema: 'public', table: 'alerts',
        filter: `user_id=eq.${userId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as unknown as RawAlert
        setAlerts((prev) => [mapRaw(row), ...prev])
      })
      .on('postgres_changes' as any, {
        event: 'UPDATE', schema: 'public', table: 'alerts',
        filter: `user_id=eq.${userId}`,   // ← NOVO: atualiza estado de outro contexto
      }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as unknown as RawAlert
        setAlerts((prev) => prev.map((a) => a.id === row.id ? mapRaw(row) : a))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Marca alertas ainda não visualizados como vistos (fire-and-forget)
  useEffect(() => {
    const unviewedIds = initialAlerts.filter((a) => !a.viewed_at).map((a) => a.id)
    if (!unviewedIds.length) return
    const supabase = createClient()
    supabase.from('alerts')
      .update({ viewed_at: new Date().toISOString() })
      .in('id', unviewedIds)
      .eq('user_id', userId)
      .then(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Somente na montagem

  // Tick de relógio com Date.now() real — ← CORRIGIDO: era timestamp hardcoded
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // KPIs
  const counts = useMemo(() => {
    const active = alerts.filter((a) => !a.resolved)
    return {
      total:          alerts.length,
      activeCritical: active.filter((a) => a.severity === 'critical').length,
      activeWarning:  active.filter((a) => a.severity === 'warning').length,
      resolvedToday:  alerts.filter((a) => a.resolved && a.resolvedAt && now - a.resolvedAt < 86_400_000).length,
      active:         active.length,
    }
  }, [alerts, now])

  // Lista filtrada + ordenada
  const filtered = useMemo(() => {
    const sevValue  = SEV_MAP[filters.severity] ?? null
    const typeValue = filters.type !== 'Todos os tipos' ? filters.type : null

    const arr = alerts.filter((a) => {
      if (filters.status === 'Ativos'     &&  a.resolved) return false
      if (filters.status === 'Resolvidos' && !a.resolved) return false
      if (sevValue  && a.severity !== sevValue) return false
      if (typeValue && (ALERT_TYPES[a.type]?.categoryLabel ?? '') !== typeValue) return false
      return true
    })

    const ord: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
    return arr.sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
      if (ord[a.severity] !== ord[b.severity]) return ord[a.severity] - ord[b.severity]
      return b.dt - a.dt
    })
  }, [alerts, filters])

  const hasFilters = (
    filters.severity !== DEFAULT_FILTERS.severity ||
    filters.status   !== DEFAULT_FILTERS.status   ||
    filters.type     !== DEFAULT_FILTERS.type
  )
  const onClear = () => setFilters(DEFAULT_FILTERS)

  // ─── Ações ─────────────────────────────────────────────────────────────────

  async function resolve(id: string) {
    const alert = alerts.find((a) => a.id === id)
    setAlerts((arr) => arr.map((a) =>
      a.id === id ? { ...a, resolved: true, resolvedAt: Date.now(), resolvedBy: userName } : a,
    ))
    setToast('Alerta marcado como resolvido.')
    track('alert_resolved', { alert_type: alert?.type ?? '', severity: alert?.severity ?? '' })
    try {
      const supabase = createClient()
      await supabase.from('alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: userName, resolved_by_id: userId })
        .eq('id', id)
        .eq('user_id', userId)   // defesa-em-profundidade além da RLS
    } catch { /* silent — UI já atualizada */ }
  }

  async function reopen(id: string) {
    const alert = alerts.find((a) => a.id === id)
    setAlerts((arr) => arr.map((a) =>
      a.id === id ? { ...a, resolved: false, resolvedAt: undefined, resolvedBy: undefined } : a,
    ))
    setToast('Alerta reaberto.')
    track('alert_reopened', { alert_type: alert?.type ?? '' })
    try {
      const supabase = createClient()
      await supabase.from('alerts')
        .update({ resolved: false, resolved_at: null, resolved_by: null })
        .eq('id', id)
        .eq('user_id', userId)
    } catch { /* silent */ }
  }

  async function deleteAlert(id: string) {
    setAlerts((arr) => arr.filter((a) => a.id !== id))
    setToast('Alerta removido.')
    try {
      const supabase = createClient()
      await supabase.from('alerts').delete().eq('id', id).eq('user_id', userId)
    } catch { /* silent */ }
  }

  async function resolveAll() {
    const activeIds = alerts.filter((a) => !a.resolved).map((a) => a.id)
    if (!activeIds.length) return
    setAlerts((arr) => arr.map((a) =>
      !a.resolved ? { ...a, resolved: true, resolvedAt: Date.now(), resolvedBy: userName } : a,
    ))
    setToast(`${activeIds.length} alertas marcados como resolvidos.`)
    setConfirmAll(false)
    track('all_alerts_resolved', { count: activeIds.length })
    try {
      const supabase = createClient()
      // ← CORRIGIDO: 1 única query em vez de N paralelas
      await supabase.from('alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: userName, resolved_by_id: userId })
        .in('id', activeIds)
        .eq('user_id', userId)
    } catch { /* silent */ }
  }

  function action(a: Alert) {
    const url   = ALERT_TYPES[a.type]?.actionUrl   ?? '/dashboard'
    const label = ALERT_TYPES[a.type]?.actionLabel ?? ''
    track('alert_action_clicked', { alert_type: a.type, action: label })
    router.push(url)
    // Salva a ação tomada (fire-and-forget)
    const supabase = createClient()
    supabase.from('alerts')
      .update({ action_taken: label })
      .eq('id', a.id)
      .eq('user_id', userId)
      .then(() => {})
  }

  function configureAlerts() {
    router.push('/dashboard/notifications')   // ← CORRIGIDO: era clique morto
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (data) {
        setAlerts((prev) => [...prev, ...data.map(mapRaw)])
        setHasMore(data.length === PAGE_SIZE)
        setOffset((o) => o + data.length)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const allResolved = counts.active === 0
  const showHappy   = alerts.length === 0 || (allResolved && filters.status !== 'Resolvidos')

  return (
    <DashboardLayout>
      <PageHeader
        title="Alertas Importantes"
        subtitle="Eventos críticos que pedem sua atenção — gateways, bots, integrações e plano."
        actions={
          <>
            {/* ← CORRIGIDO: "Configurar alertas" agora navega para /dashboard/notifications */}
            <Btn variant="secondary" onClick={configureAlerts}>
              <Bell size={14} />Configurar alertas
            </Btn>
            {counts.active > 0 && (
              confirmAll ? (
                <div className="flex items-center gap-1.5 fade-up">
                  <Btn variant="ghost" onClick={() => setConfirmAll(false)}>Cancelar</Btn>
                  <Btn variant="primary" onClick={resolveAll}>
                    <CheckCheck size={14} />Resolver {counts.active}?
                  </Btn>
                </div>
              ) : (
                <Btn variant="primary" onClick={() => setConfirmAll(true)}>
                  <CheckCheck size={14} />Marcar todos como resolvidos
                </Btn>
              )
            )}
          </>
        }
      />

      {/* Toast */}
      {toast && (
        <div
          className="mb-3 flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3.5 py-2 fade-up"
          style={{ boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,.08))' }}
        >
          <CheckCircle2 size={15} className="text-success" />
          <div className="text-[12.5px] text-text">{toast}</div>
          <button
            onClick={() => setToast('')}
            className="ml-auto w-6 h-6 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-ring"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SeverityCard
          label="Críticos ativos" value={counts.activeCritical} tone="critical"
          icon={AlertTriangle} big
          sub={counts.activeCritical === 0 ? 'Nenhum crítico no momento' : 'Requerem ação imediata'}
        />
        <SeverityCard
          label="Atenção" value={counts.activeWarning} tone="warning"
          icon={AlertCircle} big
          sub={counts.activeWarning === 0 ? 'Tudo sob controle' : 'Acompanhe nas próximas horas'}
        />
        <SeverityCard
          label="Resolvidos hoje" value={counts.resolvedToday} tone="info"
          icon={CheckCircle2}
          sub={`${counts.active} ainda ativos · ${alerts.length} no total`}
        />
      </div>

      {/* Filtros — agora inclui Tipo */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        hasFilters={hasFilters}
        onClear={onClear}
        counts={{ shown: filtered.length, total: alerts.length }}
      />

      {/* Lista */}
      {showHappy && filters.status !== 'Resolvidos' ? (
        <EmptyHappy onConfigure={configureAlerts} />
      ) : filtered.length === 0 ? (
        <EmptyFiltered onClear={onClear} />
      ) : (
        <>
          <div className="space-y-2.5">
            {filtered.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                now={now}
                onResolve={resolve}
                onReopen={reopen}
                onAction={action}
                onDelete={deleteAlert}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Btn variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Carregando…' : `Carregar mais`}
              </Btn>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
