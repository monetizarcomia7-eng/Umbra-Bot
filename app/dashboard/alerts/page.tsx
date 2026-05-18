'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  CreditCard, Ban, WifiOff, Gauge, Clock, TrendingUp, ShieldAlert, ShieldCheck,
  AlertTriangle, AlertCircle, Info, CheckCircle2, RotateCcw, MoreHorizontal,
  Bell, X, Activity, FilterX, CheckCheck, Play, BarChart3, Plug, TrendingDown,
  Inbox, XCircle, CircleDollarSign, Users, Globe, Sparkles, Calendar, Check,
  Bot, ChevronDown,
  type LucideIcon,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType    = 'gateway_fail' | 'bot_banned' | 'bot_offline' | 'send_quota' | 'webhook_fail' | 'payment_pending' | 'limit_warning' | 'ssl_expiring'
type Severity     = 'critical' | 'warning' | 'info'

interface ContextChipData { icon: string; label: string }

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
  context: ContextChipData[]
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const ALERT_TYPES: Record<AlertType, { icon: LucideIcon; categoryLabel: string; actionLabel: string; actionIcon: LucideIcon }> = {
  gateway_fail:    { icon: CreditCard,  categoryLabel: 'Gateway',    actionLabel: 'Reconectar gateway',   actionIcon: RotateCcw  },
  bot_banned:      { icon: Ban,         categoryLabel: 'Bot',         actionLabel: 'Substituir bot',        actionIcon: Bot        },
  bot_offline:     { icon: WifiOff,     categoryLabel: 'Bot',         actionLabel: 'Tentar reconectar',     actionIcon: RotateCcw  },
  send_quota:      { icon: Gauge,       categoryLabel: 'Plano',       actionLabel: 'Atualizar plano',       actionIcon: TrendingUp },
  webhook_fail:    { icon: AlertCircle, categoryLabel: 'Integração',  actionLabel: 'Testar webhook',        actionIcon: Play       },
  payment_pending: { icon: Clock,       categoryLabel: 'Pagamento',   actionLabel: 'Ver checkouts',         actionIcon: Globe      },
  limit_warning:   { icon: TrendingUp,  categoryLabel: 'Plano',       actionLabel: 'Ver uso',               actionIcon: BarChart3  },
  ssl_expiring:    { icon: ShieldAlert, categoryLabel: 'Domínio',     actionLabel: 'Renovar certificado',   actionIcon: ShieldCheck},
}

const SEVERITY_CONFIG: Record<Severity, { label: string; tone: string; bg: string; text: string; severityIcon: LucideIcon }> = {
  critical: { label: 'Crítico',     tone: 'danger',  bg: 'bg-danger-soft',  text: 'text-danger',  severityIcon: AlertTriangle },
  warning:  { label: 'Atenção',     tone: 'warning', bg: 'bg-warning-soft', text: 'text-warning', severityIcon: AlertCircle   },
  info:     { label: 'Informativo', tone: 'primary', bg: 'bg-primary-soft', text: 'text-primary', severityIcon: Info          },
}

// Context chip icon map
const CHIP_ICONS: Record<string, LucideIcon> = {
  plug: Plug, 'trending-down': TrendingDown, inbox: Inbox, webhook: AlertCircle,
  'x-circle': XCircle, 'circle-dollar-sign': CircleDollarSign, users: Users,
  globe: Globe, sparkles: Sparkles, calendar: Calendar, bot: Bot, clock: Clock,
  'check-circle-2': CheckCircle2, gauge: Gauge, 'shield-check': ShieldCheck,
  'credit-card': CreditCard, activity: Activity, ban: Ban,
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const NOW_AL = new Date('2026-05-18T15:30:00').getTime()

const MOCK_ALERTS: Alert[] = [
  {
    id: 'al_001', type: 'gateway_fail', severity: 'critical',
    title: 'Pushinpay retornando erro 502',
    desc: '12 tentativas de cobrança falharam nos últimos 18 minutos. Vendas em Pix foram redirecionadas automaticamente para o Mercado Pago.',
    dt: NOW_AL - 18 * 60 * 1000, resolved: false,
    context: [{ icon: 'plug', label: '#int_pushinpay' }, { icon: 'trending-down', label: '12 falhas / 18 min' }],
  },
  {
    id: 'al_002', type: 'bot_banned', severity: 'critical',
    title: '@lancamento_black_bot foi banido pelo Telegram',
    desc: 'Possível violação de política. Substitua o bot para retomar a operação. Mensagens em fila serão preservadas.',
    dt: NOW_AL - 65 * 60 * 1000, resolved: false,
    context: [{ icon: 'bot', label: '@lancamento_black_bot' }, { icon: 'inbox', label: '847 msgs em fila' }],
  },
  {
    id: 'al_003', type: 'webhook_fail', severity: 'critical',
    title: 'Webhook /receive retornando 502',
    desc: 'O endpoint configurado retornou erro nas últimas 5 tentativas. Próxima retentativa automática em 2 minutos.',
    dt: NOW_AL - 42 * 60 * 1000, resolved: false,
    context: [{ icon: 'webhook', label: 'POST /receive' }, { icon: 'x-circle', label: '5/5 falhas' }],
  },
  {
    id: 'al_004', type: 'bot_offline', severity: 'warning',
    title: '@suporte_premium_bot sem heartbeat',
    desc: 'Sem resposta há 14 minutos. Pode ser instabilidade temporária do Telegram — uma reconexão automática será tentada em 5 minutos.',
    dt: NOW_AL - 14 * 60 * 1000, resolved: false,
    context: [{ icon: 'bot', label: '@suporte_premium_bot' }, { icon: 'clock', label: 'offline há 14 min' }],
  },
  {
    id: 'al_005', type: 'send_quota', severity: 'warning',
    title: 'Limite de envios próximo do esgotamento',
    desc: 'Você usou 9.847 de 10.000 mensagens do plano Pro neste mês. Próxima renovação em ~6 dias.',
    dt: NOW_AL - 3 * 3600 * 1000, resolved: false,
    context: [{ icon: 'gauge', label: '98,47% usado' }, { icon: 'calendar', label: 'reseta 01/jun' }],
  },
  {
    id: 'al_006', type: 'payment_pending', severity: 'warning',
    title: '8 pagamentos no Pix aguardando confirmação',
    desc: 'Clientes geraram QR Code mas não concluíram em mais de 30 minutos. Valor total em aberto neste momento.',
    dt: NOW_AL - 95 * 60 * 1000, resolved: false,
    context: [{ icon: 'circle-dollar-sign', label: 'R$ 4.279,00' }, { icon: 'users', label: '8 clientes' }],
  },
  {
    id: 'al_007', type: 'limit_warning', severity: 'info',
    title: 'Você atingiu 80% do plano Pro',
    desc: 'Considere subir para o plano Scale e ganhar 25k mensagens/mês, bots ilimitados e suporte prioritário.',
    dt: NOW_AL - 5 * 3600 * 1000, resolved: false,
    context: [{ icon: 'sparkles', label: 'plano Scale disponível' }],
  },
  {
    id: 'al_008', type: 'ssl_expiring', severity: 'warning',
    title: 'Certificado SSL do checkout expira em 14 dias',
    desc: 'O domínio checkout.minhaempresa.com.br precisa renovar o certificado antes de 01/jun para evitar interrupção do pagamento.',
    dt: NOW_AL - 8 * 3600 * 1000, resolved: false,
    context: [{ icon: 'globe', label: 'checkout.minhaempresa.com.br' }, { icon: 'calendar', label: 'expira em 14 d' }],
  },
  {
    id: 'al_009', type: 'bot_offline', severity: 'warning',
    title: '@upsell_pos_bot ficou offline',
    desc: 'O bot ficou inacessível por 4 minutos. Reconexão automática bem-sucedida.',
    dt: NOW_AL - 4 * 3600 * 1000, resolved: true,
    resolvedAt: NOW_AL - Math.round(3.8 * 3600 * 1000), resolvedBy: 'auto',
    context: [{ icon: 'bot', label: '@upsell_pos_bot' }],
  },
  {
    id: 'al_010', type: 'webhook_fail', severity: 'critical',
    title: 'Webhook do tracker estava desabilitado',
    desc: 'Endpoint foi reabilitado após reconfiguração do domínio. Retomando entregas normalmente.',
    dt: NOW_AL - 24 * 3600 * 1000, resolved: true,
    resolvedAt: NOW_AL - 18 * 3600 * 1000, resolvedBy: 'Ana Souza',
    context: [{ icon: 'webhook', label: 'POST /tracker' }],
  },
  {
    id: 'al_011', type: 'gateway_fail', severity: 'warning',
    title: 'Stripe com lentidão acima do normal',
    desc: 'Latência elevada por 22 minutos. Sistema voltou ao normal sem intervenção.',
    dt: NOW_AL - 28 * 3600 * 1000, resolved: true,
    resolvedAt: NOW_AL - Math.round(27.5 * 3600 * 1000), resolvedBy: 'auto',
    context: [{ icon: 'credit-card', label: '#int_stripe' }],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── UI primitives ────────────────────────────────────────────────────────────

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}
function Badge({ children, tone = 'muted', icon: Icon }: { children: React.ReactNode; tone?: string; icon?: LucideIcon }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>
      {Icon && <Icon size={10} />}{children}
    </span>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; onClick?: () => void; disabled?: boolean; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
  }[variant]
  return <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

function Dropdown({ label, value, options, onChange, width = 200 }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2 focus-ring">
        <span className="truncate max-w-[140px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1" style={{ minWidth: width }}>
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}>
              {o === value && <Check size={12} />}
              <span className={o !== value ? 'pl-[20px]' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Context Chip ─────────────────────────────────────────────────────────────

function ContextChip({ icon, label }: ContextChipData) {
  const Icon = CHIP_ICONS[icon]
  return (
    <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-surface-2 border border-border text-[10.5px] font-medium text-text-muted tnum whitespace-nowrap">
      {Icon && <Icon size={10} />}{label}
    </span>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SeverityCard({ label, value, tone, icon: Icon, sub, big }: {
  label: string; value: number; tone: Severity; icon: LucideIcon; sub: string; big?: boolean
}) {
  const s = SEVERITY_CONFIG[tone]
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${s.bg} ${s.text}`}><Icon size={14} /></div>
      </div>
      <div className={`text-[28px] font-semibold tnum tracking-tight leading-none ${big && value > 0 ? s.text : 'text-text'}`}>{value}</div>
      <div className="text-[11.5px] text-text-muted mt-2">{sub}</div>
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const SEV_OPTIONS    = ['Todas as severidades', 'Crítico', 'Atenção', 'Informativo']
const STATUS_OPTIONS = ['Ativos', 'Resolvidos', 'Todos']

interface Filters { severity: string; status: string }

function FilterBar({ filters, setFilters, hasFilters, onClear, counts }: {
  filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>>; hasFilters: boolean; onClear: () => void; counts: { shown: number; total: number }
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Dropdown label="Severidade" value={filters.severity} options={SEV_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, severity: v }))} width={220} />
      <Dropdown label="Status" value={filters.status} options={STATUS_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
      {hasFilters && (
        <button onClick={onClear} className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-ring">
          <X size={13} />Limpar
        </button>
      )}
      <div className="flex-1" />
      <div className="text-[11.5px] text-text-muted tnum">
        {counts.shown} {counts.shown === 1 ? 'alerta' : 'alertas'}
        {counts.shown !== counts.total && <> de <span className="text-text font-medium">{counts.total}</span></>}
      </div>
    </div>
  )
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert, now, onResolve, onReopen, onAction }: {
  alert: Alert; now: number; onResolve: (id: string) => void; onReopen: (id: string) => void; onAction: (a: Alert) => void
}) {
  const type = ALERT_TYPES[alert.type]
  const sev  = SEVERITY_CONFIG[alert.severity]
  const TypeIcon     = type.icon
  const SevIcon      = sev.severityIcon
  const ActionIcon   = type.actionIcon

  return (
    <article className={`relative bg-surface border rounded-xl p-4 transition-opacity ${alert.resolved ? 'border-border opacity-70' : 'border-border hover:border-border-strong'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${sev.bg} ${sev.text}`}>
          <TypeIcon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Badge tone={sev.tone} icon={SevIcon}>{sev.label}</Badge>
              <span className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{type.categoryLabel}</span>
              {alert.resolved && <Badge tone="success" icon={Check}>Resolvido</Badge>}
            </div>
            <time className="text-[11px] text-text-muted tnum whitespace-nowrap" title={fmtDateTime(alert.dt)}>
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
                {alert.resolvedBy && <> · por <span className="text-text">{alert.resolvedBy === 'auto' ? 'sistema (auto)' : alert.resolvedBy}</span></>}
              </div>
              <button onClick={() => onReopen(alert.id)} className="text-[11.5px] font-medium text-text-muted hover:text-text inline-flex items-center gap-1 focus-ring rounded px-1">
                <RotateCcw size={11} />Reabrir alerta
              </button>
            </div>
          ) : (
            <div className="mt-3.5 flex items-center gap-2 flex-wrap">
              <Btn variant="primary" size="sm" onClick={() => onAction(alert)}><ActionIcon size={13} />{type.actionLabel}</Btn>
              <Btn variant="ghost" size="sm" onClick={() => onResolve(alert.id)}><Check size={13} />Marcar como resolvido</Btn>
              <button className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-ring" title="Mais opções">
                <MoreHorizontal size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyHappy() {
  return (
    <div className="bg-surface border border-border rounded-xl py-20 px-6 flex flex-col items-center justify-center text-center">
      <div className="relative w-16 h-16 rounded-2xl bg-success-soft text-success flex items-center justify-center mb-5">
        <CheckCircle2 size={28} />
        <span className="absolute inset-0 rounded-2xl border border-success/30 animate-ping opacity-50" />
      </div>
      <h3 className="text-[18px] font-semibold text-text">Tudo certo por aqui</h3>
      <p className="text-[13px] text-text-muted mt-1.5 max-w-sm leading-relaxed">
        Nenhum alerta crítico no momento. Seus bots, gateways e integrações estão operando normalmente.
      </p>
      <div className="flex items-center gap-2 mt-5">
        <Btn variant="secondary"><Activity size={14} />Ver atividade</Btn>
        <Btn variant="secondary"><Bell size={14} />Configurar alertas</Btn>
      </div>
    </div>
  )
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="bg-surface border border-dashed border-border rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4"><FilterX size={20} /></div>
      <div className="text-[14px] font-semibold text-text">Nenhum alerta corresponde aos filtros</div>
      <p className="text-[12.5px] text-text-muted mt-1 max-w-sm">Ajuste a severidade ou o status para ver mais resultados.</p>
      <Btn variant="secondary" size="sm" onClick={onClear} className="mt-4"><X size={13} />Limpar filtros</Btn>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = { severity: 'Todas as severidades', status: 'Ativos' }
const SEV_MAP: Record<string, Severity> = { 'Crítico': 'critical', 'Atenção': 'warning', 'Informativo': 'info' }

export default function AlertsPage() {
  const [alerts,       setAlerts]       = useState<Alert[]>(MOCK_ALERTS)
  const [filters,      setFilters]      = useState<Filters>(DEFAULT_FILTERS)
  const [now,          setNow]          = useState(NOW_AL)
  const [toast,        setToast]        = useState('')
  const [confirmAll,   setConfirmAll]   = useState(false)

  // Supabase — initial fetch
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('alerts').select('*').order('created_at', { ascending: false })
        if (!error && data && data.length > 0) {
          setAlerts(data.map((row) => ({
            id: String(row.id),
            type: (row.type as AlertType) ?? 'gateway_fail',
            severity: (row.severity as Severity) ?? 'warning',
            title: String(row.title ?? ''),
            desc: String(row.description ?? ''),
            dt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
            resolved: Boolean(row.resolved),
            resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).getTime() : undefined,
            resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
            context: Array.isArray(row.context) ? row.context : [],
          })))
        }
      } catch { /* tabela não existe ainda — usa mock */ }
    }
    load()
  }, [])

  // Supabase Realtime — new alerts
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('alerts-feed')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new
        const newAlert: Alert = {
          id: String(row.id ?? `rt_${Date.now()}`),
          type: (row.type as AlertType) ?? 'gateway_fail',
          severity: (row.severity as Severity) ?? 'warning',
          title: String(row.title ?? ''),
          desc: String(row.description ?? ''),
          dt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
          resolved: false,
          context: Array.isArray(row.context) ? row.context : [],
        }
        setAlerts((prev) => [newAlert, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Clock tick for relative times
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 30000), 30000)
    return () => clearInterval(t)
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Counts
  const counts = useMemo(() => {
    const active = alerts.filter((a) => !a.resolved)
    return {
      total: alerts.length,
      activeCritical: active.filter((a) => a.severity === 'critical').length,
      activeWarning:  active.filter((a) => a.severity === 'warning').length,
      resolvedToday:  alerts.filter((a) => a.resolved && a.resolvedAt && (now - a.resolvedAt) < 24 * 3600 * 1000).length,
      active: active.length,
    }
  }, [alerts, now])

  // Filtered + sorted
  const filtered = useMemo(() => {
    const sevValue = SEV_MAP[filters.severity] ?? null
    const arr = alerts.filter((a) => {
      if (filters.status === 'Ativos'     && a.resolved)  return false
      if (filters.status === 'Resolvidos' && !a.resolved) return false
      if (sevValue && a.severity !== sevValue) return false
      return true
    })
    const sevOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
    return arr.sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity]
      return b.dt - a.dt
    })
  }, [alerts, filters])

  const hasFilters = filters.severity !== DEFAULT_FILTERS.severity || filters.status !== DEFAULT_FILTERS.status
  const onClear    = () => setFilters(DEFAULT_FILTERS)

  async function resolve(id: string) {
    setAlerts((arr) => arr.map((a) => a.id === id ? { ...a, resolved: true, resolvedAt: Date.now(), resolvedBy: 'Você' } : a))
    setToast('Alerta marcado como resolvido.')
    try {
      const supabase = createClient()
      await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: 'Você' }).eq('id', id)
    } catch { }
  }

  async function reopen(id: string) {
    setAlerts((arr) => arr.map((a) => a.id === id ? { ...a, resolved: false, resolvedAt: undefined, resolvedBy: undefined } : a))
    setToast('Alerta reaberto.')
    try {
      const supabase = createClient()
      await supabase.from('alerts').update({ resolved: false, resolved_at: null, resolved_by: null }).eq('id', id)
    } catch { }
  }

  function action(a: Alert) { setToast(`Ação "${ALERT_TYPES[a.type].actionLabel}" iniciada.`) }

  async function resolveAll() {
    const activeIds = alerts.filter((a) => !a.resolved).map((a) => a.id)
    if (!activeIds.length) return
    setAlerts((arr) => arr.map((a) => !a.resolved ? { ...a, resolved: true, resolvedAt: Date.now(), resolvedBy: 'Você' } : a))
    setToast(`${activeIds.length} alertas marcados como resolvidos.`)
    setConfirmAll(false)
    try {
      const supabase = createClient()
      await Promise.all(activeIds.map((id) => supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: 'Você' }).eq('id', id)))
    } catch { }
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
            <Btn variant="secondary"><Bell size={14} />Configurar alertas</Btn>
            {counts.active > 0 && (
              confirmAll ? (
                <div className="flex items-center gap-1.5 fade-up">
                  <Btn variant="ghost" onClick={() => setConfirmAll(false)}>Cancelar</Btn>
                  <Btn variant="primary" onClick={resolveAll}><CheckCheck size={14} />Resolver {counts.active}?</Btn>
                </div>
              ) : (
                <Btn variant="primary" onClick={() => setConfirmAll(true)}><CheckCheck size={14} />Marcar todos como resolvidos</Btn>
              )
            )}
          </>
        }
      />

      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3.5 py-2 fade-up" style={{ boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,.08))' }}>
          <CheckCircle2 size={15} className="text-success" />
          <div className="text-[12.5px] text-text">{toast}</div>
          <button onClick={() => setToast('')} className="ml-auto w-6 h-6 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-ring">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SeverityCard label="Críticos ativos" value={counts.activeCritical} tone="critical" icon={AlertTriangle} big sub={counts.activeCritical === 0 ? 'Nenhum crítico no momento' : 'Requerem ação imediata'} />
        <SeverityCard label="Atenção" value={counts.activeWarning} tone="warning" icon={AlertCircle} big sub={counts.activeWarning === 0 ? 'Tudo sob controle' : 'Acompanhe nas próximas horas'} />
        <SeverityCard label="Resolvidos hoje" value={counts.resolvedToday} tone="info" icon={CheckCircle2} sub={`${counts.active} ainda ativos · ${alerts.length} no total`} />
      </div>

      <FilterBar filters={filters} setFilters={setFilters} hasFilters={hasFilters} onClear={onClear} counts={{ shown: filtered.length, total: alerts.length }} />

      {showHappy && filters.status !== 'Resolvidos' ? (
        <EmptyHappy />
      ) : filtered.length === 0 ? (
        <EmptyFiltered onClear={onClear} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} now={now} onResolve={resolve} onReopen={reopen} onAction={action} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
