'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { cn } from '@/lib/utils'
import {
  ShoppingBag, UserPlus, CheckCircle2, Wifi, XCircle, Undo2, WifiOff,
  Gauge, Bot, Webhook, GitBranch, UserX, Filter, Bell, Download,
  X, ArrowUpRight, SearchX, Check, ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ── Icon map ─────────────────────────────────────────────── */

const iconMap: Record<string, LucideIcon> = {
  'shopping-bag':    ShoppingBag,
  'user-plus':       UserPlus,
  'check-circle-2':  CheckCircle2,
  'wifi':            Wifi,
  'x-circle':        XCircle,
  'undo-2':          Undo2,
  'wifi-off':        WifiOff,
  'gauge':           Gauge,
  'bot':             Bot,
  'webhook':         Webhook,
  'git-branch':      GitBranch,
  'user-x':          UserX,
  'filter':          Filter,
  'bell':            Bell,
  'download':        Download,
  'x':               X,
  'arrow-up-right':  ArrowUpRight,
  'search-x':        SearchX,
  'check':           Check,
  'chevron-down':    ChevronDown,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Comp = iconMap[name]
  if (!Comp) return null
  return <Comp size={size} className={className} />
}

/* ── Formatters ───────────────────────────────────────────── */

const fmtBRLdec = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
const fmtDateTime = (dt: number) =>
  new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/* ── Event types ──────────────────────────────────────────── */

const eventTypes: Record<string, { icon: string; severity: string; label: string; res: string }> = {
  sale:          { icon: 'shopping-bag',   severity: 'success', label: 'Nova venda',           res: 'venda'      },
  lead:          { icon: 'user-plus',      severity: 'info',    label: 'Novo lead',            res: 'lead'       },
  payment:       { icon: 'check-circle-2', severity: 'success', label: 'Pagamento confirmado', res: 'pagamento'  },
  reconnect:     { icon: 'wifi',           severity: 'info',    label: 'Bot reconectado',      res: 'bot'        },
  failure:       { icon: 'x-circle',       severity: 'danger',  label: 'Falha de envio',       res: 'mensagem'   },
  refund:        { icon: 'undo-2',         severity: 'warning', label: 'Estorno',              res: 'venda'      },
  disconnect:    { icon: 'wifi-off',       severity: 'danger',  label: 'Bot desconectado',     res: 'bot'        },
  limit:         { icon: 'gauge',          severity: 'warning', label: 'Limite próximo',       res: 'plano'      },
  newBot:        { icon: 'bot',            severity: 'info',    label: 'Bot adicionado',       res: 'bot'        },
  webhookFailed: { icon: 'webhook',        severity: 'danger',  label: 'Webhook falhou',       res: 'webhook'    },
  flowPublished: { icon: 'git-branch',     severity: 'info',    label: 'Fluxo publicado',      res: 'fluxo'      },
  cancellation:  { icon: 'user-x',         severity: 'warning', label: 'Assinatura cancelada', res: 'assinatura' },
}

const severityTones: Record<string, { bg: string; text: string }> = {
  success: { bg: 'bg-success-soft', text: 'text-success' },
  info:    { bg: 'bg-primary-soft', text: 'text-primary' },
  warning: { bg: 'bg-warning-soft', text: 'text-warning' },
  danger:  { bg: 'bg-danger-soft',  text: 'text-danger'  },
}

const categoryGroups: Record<string, string[] | 'critical' | null> = {
  'Todas as categorias':   null,
  'Vendas e pagamentos':   ['sale', 'payment', 'refund', 'cancellation'],
  'Leads e mensagens':     ['lead', 'failure'],
  'Bots e sistema':        ['reconnect', 'disconnect', 'limit', 'newBot'],
  'Integrações':           ['webhookFailed', 'flowPublished'],
  'Apenas críticos':       'critical',
}

const botNames = ['@mentoria_vip_bot', '@lancamento_black_bot', '@upsell_pos_bot', '@vendas_curso_bot', '@suporte_premium_bot']

/* ── Mock data (determinístico) ───────────────────────────── */

interface ActivityEvent { id: string; type: string; dt: number; title: string; desc: string; bot: string }

function seededRand(seed: number) {
  let s = seed % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}
const pick = <T,>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length)]
function pickWeighted<T>(items: [T, number][], r: () => number): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let v = r() * total
  for (const [item, w] of items) { if ((v -= w) <= 0) return item }
  return items[items.length - 1][0]
}

const productTickets: Record<string, number> = {
  'Mentoria Premium Anual': 1297, 'Curso Intensivo 90 dias': 147,
  'Pack Templates Pro': 70, 'Consultoria Individual': 675, 'E-book Estratégias': 20,
}
const customerNames = [
  'João da Silva', 'Maria Souza', 'Pedro Castro', 'Ana Lima', 'Luana Andrade',
  'Rafael Mendes', 'Bianca Ramos', 'Thiago Lopes', 'Camila Oliveira', 'Diego Antunes',
  'Sabrina Pinheiro', 'Fernando Pires', 'Igor Bertolini', 'Renata Cavalcanti',
  'Patrícia Albuquerque', 'Vinícius Costa', 'Beatriz Nogueira', 'Marcos Tavares',
]
const products = Object.keys(productTickets)
const typeWeights: [string, number][] = [
  ['sale', 28], ['lead', 24], ['payment', 18], ['failure', 6],
  ['reconnect', 3], ['refund', 4], ['disconnect', 2], ['limit', 2],
  ['newBot', 1], ['webhookFailed', 4], ['flowPublished', 4], ['cancellation', 4],
]

function buildEventContent(type: string, r: () => number): { title: string; desc: string; bot: string } {
  const bot = pick(botNames, r)
  const customer = pick(customerNames, r)
  const product = pick(products, r)
  const ticket = productTickets[product]
  switch (type) {
    case 'sale':          return { title: `Nova venda — ${product}`,       desc: `${customer} · ${fmtBRLdec(ticket)}`, bot }
    case 'lead':          return { title: `Novo lead`,                      desc: `${customer} iniciou conversa`, bot }
    case 'payment':       return { title: `Pagamento confirmado`,           desc: `${customer} · ${fmtBRLdec(ticket)} via Pix`, bot }
    case 'failure':       return { title: `Falha ao enviar mensagem`,       desc: `${customer} bloqueou ou desinstalou o app`, bot }
    case 'reconnect':     return { title: `Bot reconectado`,                desc: `${bot} voltou a operar normalmente`, bot }
    case 'refund':        return { title: `Estorno solicitado`,             desc: `${customer} · ${fmtBRLdec(ticket)} · motivo: arrependimento`, bot }
    case 'disconnect':    return { title: `Bot desconectado`,               desc: `${bot} perdeu conexão com a API do Telegram`, bot }
    case 'limit':         return { title: `Limite mensal próximo`,          desc: `Você usou 84% do plano Pro (8.412 / 10.000 mensagens)`, bot }
    case 'newBot':        return { title: `Bot adicionado`,                 desc: `${bot} foi conectado ao workspace`, bot }
    case 'webhookFailed': return { title: `Webhook falhou`,                 desc: `POST /receive retornou 502 · 3 tentativas restantes`, bot }
    case 'flowPublished': return { title: `Fluxo publicado`,                desc: `"Upsell pós-compra v3" agora está ativo`, bot }
    case 'cancellation':  return { title: `Assinatura cancelada`,           desc: `${customer} cancelou Mentoria Premium · churn em 30 d`, bot }
    default:              return { title: type, desc: '', bot }
  }
}

const NOW = new Date('2026-05-18T15:30:00').getTime()

function generateBaseEvents(): ActivityEvent[] {
  const r = seededRand(42)
  const events: ActivityEvent[] = []
  let cursor = NOW
  for (let i = 0; i < 80; i++) {
    const gap = (0.4 + r() * 4.5) * 60 * 1000 * (1 + i * 0.05)
    cursor -= gap
    const type = pickWeighted(typeWeights, r)
    const c = buildEventContent(type, r)
    events.push({ id: `ev_${i}`, type, dt: cursor, ...c })
  }
  return events
}

const allBaseEvents = generateBaseEvents()

/* ── Helpers de tempo ─────────────────────────────────────── */

function relTime(dt: number, now: number) {
  const diff = Math.max(0, now - dt)
  const s = Math.floor(diff / 1000)
  if (s < 5)  return 'agora'
  if (s < 60) return `há ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d} d`
  return `há ${Math.floor(d / 7)} sem`
}

function dayKey(dt: number) {
  const d = new Date(dt)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function dayLabel(key: string, refNow: number) {
  const d = new Date(key + 'T00:00:00')
  const today = new Date(refNow); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function dayKeyFormatted(key: string) {
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/* ── Local helpers ────────────────────────────────────────── */

function Card({ title, subtitle, action, children }: {
  title?: string; subtitle?: string; action?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          {title && (
            <div>
              <div className="text-[14px] font-semibold text-text">{title}</div>
              {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
            </div>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="px-5 pb-5">{children}</div>
    </div>
  )
}

function Btn({ variant = 'secondary', iconName, children, onClick, className }: {
  variant?: 'primary' | 'secondary'
  iconName?: string; children?: React.ReactNode; onClick?: () => void; className?: string
}) {
  const Ico = iconName ? (iconMap[iconName] ?? null) : null
  return (
    <button onClick={onClick} className={cn(
      'inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-lg transition-colors',
      variant === 'primary' ? 'bg-primary text-primary-fg hover:opacity-90' : 'border border-border bg-surface text-text hover:bg-surface-2',
      className,
    )}>
      {Ico && <Ico size={14} className="shrink-0" />}
      {children}
    </button>
  )
}

function Dropdown({ icon, label, value, options, onChange, width }: {
  icon?: string; label: string; value: string; options: string[]
  onChange: (v: string) => void; width?: number
}) {
  const Ico = icon ? (iconMap[icon] ?? null) : null
  return (
    <div className="relative h-9" style={width ? { width } : { minWidth: 160 }}>
      {Ico && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10"><Ico size={13} /></span>}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className={cn('h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50', Ico ? 'pl-8' : 'pl-3')}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"><ChevronDown size={12} /></span>
    </div>
  )
}

/* ── Event Card ───────────────────────────────────────────── */

function EventCard({ event, now, isNew }: { event: ActivityEvent; now: number; isNew: boolean }) {
  const t = eventTypes[event.type] ?? eventTypes.sale
  const tone = severityTones[t.severity]

  return (
    <article className={cn('relative pl-12 py-2.5 group', isNew ? 'fade-up' : '')}>
      <div
        className={cn('absolute left-1 top-2 w-7 h-7 rounded-md flex items-center justify-center', tone.bg, tone.text)}
        style={{ boxShadow: '0 0 0 4px var(--bg)' }}
      >
        <Icon name={t.icon} size={13} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">{t.label}</span>
            {isNew && (
              <span className="text-[9.5px] uppercase tracking-wider font-semibold text-success bg-success-soft px-1.5 py-0.5 rounded">
                Novo
              </span>
            )}
          </div>
          <div className="text-[13px] font-medium text-text mt-0.5 leading-snug">{event.title}</div>
          <div className="text-[12px] text-text-muted mt-0.5 leading-snug">{event.desc}</div>
          <div className="flex items-center gap-2 mt-1.5 text-[10.5px]">
            <span className="tnum text-text-subtle">{event.bot}</span>
            <span className="text-text-subtle">·</span>
            <button className="text-primary font-medium hover:underline inline-flex items-center gap-0.5 focus-ring rounded">
              Ver {t.res}
              <Icon name="arrow-up-right" size={10} />
            </button>
          </div>
        </div>
        <time className="text-[11px] text-text-muted tnum shrink-0 mt-0.5 whitespace-nowrap" title={fmtDateTime(event.dt)}>
          {relTime(event.dt, now)}
        </time>
      </div>
    </article>
  )
}

/* ── Day Group ────────────────────────────────────────────── */

function DayGroup({ dayKey: key, events, now, newIds }: {
  dayKey: string; events: ActivityEvent[]; now: number; newIds: Set<string>
}) {
  return (
    <section className="relative">
      <div className="sticky top-0 z-10 -mx-1 px-1 bg-bg/85 backdrop-blur py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{dayLabel(key, now)}</h3>
          <span className="text-[10.5px] text-text-subtle tnum">{dayKeyFormatted(key)}</span>
          <span className="text-[10.5px] text-text-subtle">·</span>
          <span className="text-[10.5px] text-text-subtle tnum">{events.length} eventos</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>
      <div className="relative pb-2">
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border" />
        {events.map((e) => (
          <EventCard key={e.id} event={e} now={now} isNew={newIds.has(e.id)} />
        ))}
      </div>
    </section>
  )
}

/* ── Filter Bar ───────────────────────────────────────────── */

interface ActivityFilters { category: string; bot: string }

function FilterBar({ category, setCategory, bot, setBot, live, setLive, eventsPerHour, onClear, hasFilters }: {
  category: string; setCategory: (v: string) => void
  bot: string; setBot: (v: string) => void
  live: boolean; setLive: React.Dispatch<React.SetStateAction<boolean>>
  eventsPerHour: number; onClear: () => void; hasFilters: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Dropdown icon="filter" label="Categoria" value={category} options={Object.keys(categoryGroups)} onChange={setCategory} width={220} />
      <Dropdown icon="bot" label="Bot" value={bot} options={['Todos os bots', ...botNames]} onChange={setBot} width={240} />

      {hasFilters && (
        <button onClick={onClear} className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-ring">
          <X size={13} />
          Limpar
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={() => setLive((l) => !l)}
        className={cn(
          'h-9 px-3 inline-flex items-center gap-2 rounded-lg text-[12.5px] font-medium border focus-ring',
          live ? 'bg-success-soft text-success border-success/30' : 'bg-surface text-text-muted border-border hover:bg-surface-2 hover:text-text',
        )}
        title={live ? 'Pausar atualização ao vivo' : 'Retomar atualização ao vivo'}
      >
        <span className={cn('relative w-2 h-2 rounded-full', live ? 'bg-success' : 'bg-text-subtle')}>
          {live && <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />}
        </span>
        {live ? 'Ao vivo' : 'Pausado'}
        {live && <span className="text-success/70 tnum">· {eventsPerHour}/h</span>}
      </button>
    </div>
  )
}

/* ── Summary Sidebar ──────────────────────────────────────── */

function SummarySidebar({ events, now, onSelectCategory }: {
  events: ActivityEvent[]; now: number; onSelectCategory: (v: string) => void
}) {
  const last24h = useMemo(() => events.filter((e) => now - e.dt < 24 * 60 * 60 * 1000), [events, now])
  const bySeverity = useMemo(() => {
    const acc: Record<string, number> = { success: 0, info: 0, warning: 0, danger: 0 }
    last24h.forEach((e) => { const t = eventTypes[e.type]; if (t) acc[t.severity]++ })
    return acc
  }, [last24h])
  const total = last24h.length
  const byBot = useMemo(() => {
    const acc: Record<string, number> = {}
    last24h.forEach((e) => { acc[e.bot] = (acc[e.bot] || 0) + 1 })
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [last24h])
  const critical = useMemo(() => events.filter((e) => { const t = eventTypes[e.type]; return t?.severity === 'danger' }).slice(0, 3), [events])

  const sevConfig = [
    { key: 'success', label: 'Sucesso',      sev: 'success' },
    { key: 'info',    label: 'Informações',  sev: 'info'    },
    { key: 'warning', label: 'Avisos',       sev: 'warning' },
    { key: 'danger',  label: 'Críticos',     sev: 'danger'  },
  ]

  return (
    <div className="space-y-4">
      <Card title="Últimas 24 horas" subtitle={`${total} eventos registrados`}>
        <div className="space-y-2.5 mt-1">
          {sevConfig.map((s) => {
            const v = bySeverity[s.key] ?? 0
            const pct = total ? (v / total) * 100 : 0
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: `var(--${s.sev})` }} />
                    <span className="text-text">{s.label}</span>
                  </span>
                  <span className="tnum text-text-muted">{v}</span>
                </div>
                <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(--${s.sev})` }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Bots mais ativos" subtitle="Eventos nas últimas 24 h">
        <div className="space-y-2 mt-1">
          {byBot.length === 0 && <div className="text-[12px] text-text-muted">Sem atividade nas últimas 24 h.</div>}
          {byBot.map(([botName, count]) => {
            const maxCount = byBot[0][1]
            const pct = (count / maxCount) * 100
            return (
              <div key={botName}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="tnum text-text truncate">{botName}</span>
                  <span className="tnum text-text-muted shrink-0 ml-2">{count}</span>
                </div>
                <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card
        title="Atenção"
        subtitle={critical.length === 0 ? 'Tudo certo no momento.' : `${critical.length} eventos críticos recentes`}
        action={critical.length > 0 ? (
          <button onClick={() => onSelectCategory('Apenas críticos')} className="text-[11px] font-medium text-primary hover:underline">
            Ver todos
          </button>
        ) : undefined}
      >
        {critical.length === 0 ? (
          <div className="flex items-center gap-2 mt-1 text-[12px] text-success">
            <CheckCircle2 size={14} />
            <span>Nenhum incidente ativo.</span>
          </div>
        ) : (
          <div className="space-y-2 mt-1">
            {critical.map((e) => {
              const t = eventTypes[e.type]
              if (!t) return null
              return (
                <div key={e.id} className="flex items-start gap-2.5 text-[12px]">
                  <span className="w-6 h-6 rounded-md bg-danger-soft text-danger flex items-center justify-center shrink-0">
                    <Icon name={t.icon} size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-text truncate font-medium leading-tight">{e.title}</div>
                    <div className="text-[10.5px] text-text-muted tnum mt-0.5">{relTime(e.dt, now)} · {e.bot}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Empty Feed ───────────────────────────────────────────── */

function EmptyFeed({ onClear }: { onClear: () => void }) {
  return (
    <div className="bg-surface border border-dashed border-border rounded-xl py-14 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
        <SearchX size={20} />
      </div>
      <div className="text-[14px] font-semibold text-text">Nenhum evento corresponde aos filtros</div>
      <p className="text-[12.5px] text-text-muted mt-1.5 max-w-sm">
        Tente ampliar a categoria, mudar de bot ou limpar os filtros para ver o histórico completo.
      </p>
      <Btn iconName="x" onClick={onClear} className="mt-4">Limpar filtros</Btn>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────── */

const defaultFilters: ActivityFilters = { category: 'Todas as categorias', bot: 'Todos os bots' }
const liveTypes: [string, number][] = [
  ['sale', 35], ['lead', 30], ['payment', 18], ['failure', 8], ['webhookFailed', 4], ['flowPublished', 5],
]

export default function ActivityPage() {
  const [filters, setFilters] = useState<ActivityFilters>(defaultFilters)
  const [live, setLive] = useState(true)
  const [extras, setExtras] = useState<ActivityEvent[]>([])
  const [dbEvents, setDbEvents] = useState<ActivityEvent[]>([])
  const [now, setNow] = useState(NOW)
  const [visibleCount, setVisibleCount] = useState(25)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const initialNewIds = useRef(new Set<string>())
  const liveRef = useRef(live)

  useEffect(() => { liveRef.current = live }, [live])

  /* Now tick para relTime atualizar */
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 30000), 30000)
    return () => clearInterval(t)
  }, [])

  /* Busca inicial no Supabase — fallback silencioso para mock se tabela não existir */
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('activity_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(80)
        if (!error && data && data.length > 0) {
          const mapped: ActivityEvent[] = data.map((row) => ({
            id: String(row.id),
            type: String(row.type ?? 'sale'),
            dt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
            title: String(row.title ?? ''),
            desc: String(row.description ?? ''),
            bot: String(row.bot ?? ''),
          }))
          setDbEvents(mapped)
        }
      } catch {
        // tabela não existe ainda — usa mock
      }
    }
    load()
  }, [])

  /* Supabase Realtime — novos eventos em tempo real */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('activity-feed')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'activity_events' }, (payload: { new: Record<string, unknown> }) => {
        if (!liveRef.current) return
        const row = payload.new
        const evt: ActivityEvent = {
          id: String(row.id ?? `rt_${Date.now()}`),
          type: String(row.type ?? 'sale'),
          dt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
          title: String(row.title ?? ''),
          desc: String(row.description ?? ''),
          bot: String(row.bot ?? ''),
        }
        initialNewIds.current.add(evt.id)
        setExtras((prev) => [evt, ...prev].slice(0, 40))
        setNow(Date.now())
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  /* Mock live — gera eventos demo quando ao vivo */
  useEffect(() => {
    if (!live) return
    const r = seededRand(Math.floor(Date.now()) % 233280)
    let counter = 0
    const t = setInterval(() => {
      const type = pickWeighted(liveTypes, r)
      const c = buildEventContent(type, r)
      const newDt = Date.now()
      const id = `live_${newDt}_${counter++}`
      initialNewIds.current.add(id)
      setNow(newDt)
      setExtras((prev) => [{ id, type, dt: newDt, ...c }, ...prev].slice(0, 40))
    }, 5500)
    return () => clearInterval(t)
  }, [live])

  /* Combina + filtra */
  const baseEvents = dbEvents.length > 0 ? dbEvents : allBaseEvents
  const allEvents = useMemo(() => [...extras, ...baseEvents], [extras, baseEvents])

  const filtered = useMemo(() => allEvents.filter((e) => {
    const cat = categoryGroups[filters.category]
    if (cat === 'critical') {
      if (eventTypes[e.type]?.severity !== 'danger') return false
    } else if (Array.isArray(cat)) {
      if (!cat.includes(e.type)) return false
    }
    if (filters.bot !== 'Todos os bots' && e.bot !== filters.bot) return false
    return true
  }), [allEvents, filters])

  useEffect(() => { setVisibleCount(25) }, [filters])

  const visible = filtered.slice(0, visibleCount)
  const grouped = useMemo(() => {
    const m = new Map<string, ActivityEvent[]>()
    visible.forEach((e) => {
      const k = dayKey(e.dt)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    })
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [visible])

  /* IntersectionObserver — scroll incremental */
  useEffect(() => {
    if (!sentinelRef.current || visibleCount >= filtered.length) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount((c) => Math.min(c + 15, filtered.length))
    }, { rootMargin: '300px', threshold: 0 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [visibleCount, filtered.length])

  const eventsPerHour = useMemo(() => allEvents.filter((e) => now - e.dt < 60 * 60 * 1000).length, [allEvents, now])
  const hasFilters = filters.category !== defaultFilters.category || filters.bot !== defaultFilters.bot
  const onClear = () => setFilters(defaultFilters)

  return (
    <DashboardLayout>
      <PageHeader
        title="Atividade"
        subtitle="Linha do tempo de eventos do seu painel — vendas, leads, sistema e integrações."
        actions={
          <>
            <Btn iconName="download">Exportar</Btn>
            <Btn iconName="bell">Configurar alertas</Btn>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        <div className="min-w-0">
          <FilterBar
            category={filters.category}
            setCategory={(v) => setFilters((f) => ({ ...f, category: v }))}
            bot={filters.bot}
            setBot={(v) => setFilters((f) => ({ ...f, bot: v }))}
            live={live}
            setLive={setLive}
            eventsPerHour={eventsPerHour}
            onClear={onClear}
            hasFilters={hasFilters}
          />

          {filtered.length === 0 ? (
            <EmptyFeed onClear={onClear} />
          ) : (
            <div className="space-y-1">
              {grouped.map(([k, items]) => (
                <DayGroup key={k} dayKey={k} events={items} now={now} newIds={initialNewIds.current} />
              ))}

              <div ref={sentinelRef} className="py-6 flex items-center justify-center">
                {visibleCount < filtered.length ? (
                  <div className="flex items-center gap-2 text-[12px] text-text-muted">
                    <svg viewBox="0 0 24 24" width="14" height="14" className="spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Carregando mais eventos…
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11.5px] text-text-subtle">
                    <Check size={12} />
                    Você está no fim do histórico.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <SummarySidebar
            events={allEvents}
            now={now}
            onSelectCategory={(v) => setFilters((f) => ({ ...f, category: v }))}
          />
        </aside>
      </div>
    </DashboardLayout>
  )
}
