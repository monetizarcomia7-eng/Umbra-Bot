'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import { exportCSV } from '@/lib/csv'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  ShoppingBag, UserPlus, CheckCircle2, Wifi, XCircle, Undo2, WifiOff,
  Gauge, Bot, Webhook, GitBranch, UserX, Filter, Bell, Download,
  X, ArrowUpRight, SearchX, Check, ChevronDown, Search, Calendar,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ── Public types (exported for use in page.tsx) ──────────── */

export interface RawActivityEvent {
  id: string
  type: string
  title: string
  description: string
  bot: string
  bot_id: string | null
  amount: number | null
  created_at: string
}

export interface BotOption {
  id: string
  name: string
  username: string | null
}

/* ── Internal types ───────────────────────────────────────── */

interface ActivityEvent {
  id: string
  type: string
  dt: number
  title: string
  desc: string
  bot: string
  bot_id: string | null
  amount: number | null
}

/* ── Icon map ─────────────────────────────────────────────── */

const iconMap: Record<string, LucideIcon> = {
  'shopping-bag':   ShoppingBag,
  'user-plus':      UserPlus,
  'check-circle-2': CheckCircle2,
  'wifi':           Wifi,
  'x-circle':       XCircle,
  'undo-2':         Undo2,
  'wifi-off':       WifiOff,
  'gauge':          Gauge,
  'bot':            Bot,
  'webhook':        Webhook,
  'git-branch':     GitBranch,
  'user-x':         UserX,
  'filter':         Filter,
  'bell':           Bell,
  'download':       Download,
  'x':              X,
  'arrow-up-right': ArrowUpRight,
  'search-x':       SearchX,
  'check':          Check,
  'chevron-down':   ChevronDown,
  'search':         Search,
  'calendar':       Calendar,
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
  new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

const fmtExport = (dt: number) =>
  new Date(dt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

/* ── Event configuration ──────────────────────────────────── */

const eventTypes: Record<string, { icon: string; severity: string; label: string; res: string; link: string }> = {
  sale:          { icon: 'shopping-bag',   severity: 'success', label: 'Nova venda',           res: 'venda',      link: '/dashboard/finance'   },
  lead:          { icon: 'user-plus',      severity: 'info',    label: 'Novo lead',            res: 'lead',       link: '/dashboard/customers' },
  payment:       { icon: 'check-circle-2', severity: 'success', label: 'Pagamento confirmado', res: 'pagamento',  link: '/dashboard/finance'   },
  reconnect:     { icon: 'wifi',           severity: 'info',    label: 'Bot reconectado',      res: 'bot',        link: '/dashboard/bots'      },
  failure:       { icon: 'x-circle',       severity: 'danger',  label: 'Falha de envio',       res: 'mensagem',   link: '/dashboard/customers' },
  refund:        { icon: 'undo-2',         severity: 'warning', label: 'Estorno',              res: 'venda',      link: '/dashboard/finance'   },
  disconnect:    { icon: 'wifi-off',       severity: 'danger',  label: 'Bot desconectado',     res: 'bot',        link: '/dashboard/bots'      },
  limit:         { icon: 'gauge',          severity: 'warning', label: 'Limite próximo',       res: 'plano',      link: '/dashboard/profile'   },
  newBot:        { icon: 'bot',            severity: 'info',    label: 'Bot adicionado',       res: 'bot',        link: '/dashboard/bots'      },
  webhookFailed: { icon: 'webhook',        severity: 'danger',  label: 'Webhook falhou',       res: 'webhook',    link: '/dashboard/webhooks'  },
  flowPublished: { icon: 'git-branch',     severity: 'info',    label: 'Fluxo publicado',      res: 'fluxo',      link: '/dashboard/flows'     },
  cancellation:  { icon: 'user-x',         severity: 'warning', label: 'Assinatura cancelada', res: 'assinatura', link: '/dashboard/finance'   },
}

const severityTones: Record<string, { bg: string; text: string }> = {
  success: { bg: 'bg-success-soft', text: 'text-success' },
  info:    { bg: 'bg-primary-soft', text: 'text-primary' },
  warning: { bg: 'bg-warning-soft', text: 'text-warning' },
  danger:  { bg: 'bg-danger-soft',  text: 'text-danger'  },
}

const categoryGroups: Record<string, string[] | 'critical' | null> = {
  'Todas as categorias': null,
  'Vendas e pagamentos': ['sale', 'payment', 'refund', 'cancellation'],
  'Leads e mensagens':   ['lead', 'failure'],
  'Bots e sistema':      ['reconnect', 'disconnect', 'limit', 'newBot'],
  'Integrações':         ['webhookFailed', 'flowPublished'],
  'Apenas críticos':     'critical',
}

const PERIOD_OPTIONS = [
  { value: 'all',   label: 'Todo o período' },
  { value: 'today', label: 'Hoje'            },
  { value: '7d',    label: 'Últimos 7 dias'  },
  { value: '30d',   label: 'Últimos 30 dias' },
]

function getPeriodCutoff(period: string, now: number): number | null {
  if (period === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  if (period === '7d')  return now - 7  * 24 * 60 * 60 * 1000
  if (period === '30d') return now - 30 * 24 * 60 * 60 * 1000
  return null
}

const LS = {
  get: (k: string, def: string) => (typeof window !== 'undefined' ? (localStorage.getItem(k) ?? def) : def),
  set: (k: string, v: string)   => { if (typeof window !== 'undefined') localStorage.setItem(k, v) },
  del: (k: string)               => { if (typeof window !== 'undefined') localStorage.removeItem(k) },
}

/* ── Map raw DB row → ActivityEvent ──────────────────────── */

function mapRaw(row: RawActivityEvent): ActivityEvent {
  return {
    id:     String(row.id),
    type:   String(row.type ?? 'sale'),
    dt:     row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    title:  String(row.title ?? ''),
    desc:   String(row.description ?? ''),
    bot:    String(row.bot ?? ''),
    bot_id: row.bot_id ?? null,
    amount: row.amount ?? null,
  }
}

/* ── Time helpers ─────────────────────────────────────────── */

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  return new Date(key + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/* ── Local UI primitives ──────────────────────────────────── */

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

function Btn({ variant = 'secondary', iconName, children, onClick, className, disabled }: {
  variant?: 'primary' | 'secondary'
  iconName?: string; children?: React.ReactNode; onClick?: () => void
  className?: string; disabled?: boolean
}) {
  const Ico = iconName ? (iconMap[iconName] ?? null) : null
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-primary text-primary-fg hover:opacity-90'
          : 'border border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
    >
      {Ico && <Ico size={14} className="shrink-0" />}
      {children}
    </button>
  )
}

function Dropdown({ icon, label, value, options, onChange, width }: {
  icon?: string; label: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void; width?: number
}) {
  const Ico = icon ? (iconMap[icon] ?? null) : null
  return (
    <div className="relative h-9" style={width ? { width } : { minWidth: 160 }}>
      {Ico && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10">
          <Ico size={13} />
        </span>
      )}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
          Ico ? 'pl-8' : 'pl-3',
        )}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
        <ChevronDown size={12} />
      </span>
    </div>
  )
}

/* ── Event Card ───────────────────────────────────────────── */

function EventCard({ event, now, isNew, botDisplay }: {
  event: ActivityEvent; now: number; isNew: boolean; botDisplay: string
}) {
  const t = eventTypes[event.type] ?? eventTypes.sale
  const tone = severityTones[t.severity]

  return (
    <article className={cn('relative pl-12 py-2.5 group', isNew && 'fade-up')}>
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
            {botDisplay && <span className="tnum text-text-subtle">{botDisplay}</span>}
            {botDisplay && <span className="text-text-subtle">·</span>}
            <Link
              href={t.link}
              className="text-primary font-medium hover:underline inline-flex items-center gap-0.5 focus-ring rounded"
            >
              Ver {t.res}
              <Icon name="arrow-up-right" size={10} />
            </Link>
          </div>
        </div>
        <time
          className="text-[11px] text-text-muted tnum shrink-0 mt-0.5 whitespace-nowrap"
          title={fmtDateTime(event.dt)}
        >
          {relTime(event.dt, now)}
        </time>
      </div>
    </article>
  )
}

/* ── Day Group ────────────────────────────────────────────── */

function DayGroup({ dayKey: key, events, now, newIds, botMap }: {
  dayKey: string; events: ActivityEvent[]; now: number
  newIds: Set<string>; botMap: Map<string, string>
}) {
  return (
    <section className="relative">
      <div className="sticky top-0 z-10 -mx-1 px-1 bg-bg/85 backdrop-blur py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {dayLabel(key, now)}
          </h3>
          <span className="text-[10.5px] text-text-subtle tnum">{dayKeyFormatted(key)}</span>
          <span className="text-[10.5px] text-text-subtle">·</span>
          <span className="text-[10.5px] text-text-subtle tnum">{events.length} eventos</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>
      <div className="relative pb-2">
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border" />
        {events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            now={now}
            isNew={newIds.has(e.id)}
            botDisplay={e.bot || (e.bot_id ? (botMap.get(e.bot_id) ?? '') : '')}
          />
        ))}
      </div>
    </section>
  )
}

/* ── Filter Bar ───────────────────────────────────────────── */

function FilterBar({
  category, onCategoryChange,
  botId, onBotChange,
  period, onPeriodChange,
  search, onSearchChange,
  bots,
  live, onLiveToggle,
  eventsPerHour, onClear, hasFilters,
}: {
  category: string; onCategoryChange: (v: string) => void
  botId: string; onBotChange: (v: string) => void
  period: string; onPeriodChange: (v: string) => void
  search: string; onSearchChange: (v: string) => void
  bots: BotOption[]
  live: boolean; onLiveToggle: () => void
  eventsPerHour: number; onClear: () => void; hasFilters: boolean
}) {
  const categoryOptions = Object.keys(categoryGroups).map((k) => ({ value: k, label: k }))
  const botOptions = [
    { value: 'all', label: 'Todos os bots' },
    ...bots.map((b) => ({ value: b.id, label: b.username ? `@${b.username}` : b.name })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Busca por texto */}
      <div className="relative h-9" style={{ minWidth: 200 }}>
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <Search size={13} />
        </span>
        <input
          type="text"
          placeholder="Buscar eventos…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-full w-full bg-surface border border-border rounded-lg text-[12.5px] text-text pl-8 pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-text-muted"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <Dropdown icon="filter" label="Categoria" value={category} options={categoryOptions} onChange={onCategoryChange} width={200} />
      <Dropdown icon="bot"    label="Bot"       value={botId}    options={botOptions}       onChange={onBotChange}    width={190} />
      <Dropdown icon="calendar" label="Período" value={period}   options={PERIOD_OPTIONS}   onChange={onPeriodChange} width={170} />

      {hasFilters && (
        <button
          onClick={onClear}
          className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-ring"
        >
          <X size={13} />
          Limpar
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={onLiveToggle}
        className={cn(
          'h-9 px-3 inline-flex items-center gap-2 rounded-lg text-[12.5px] font-medium border focus-ring',
          live
            ? 'bg-success-soft text-success border-success/30'
            : 'bg-surface text-text-muted border-border hover:bg-surface-2 hover:text-text',
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

function SummarySidebar({ events, now, onSelectCategory, botMap }: {
  events: ActivityEvent[]
  now: number
  onSelectCategory: (v: string) => void
  botMap: Map<string, string>
}) {
  const last24h = useMemo(() => events.filter((e) => now - e.dt < 86400000), [events, now])

  const bySeverity = useMemo(() => {
    const acc: Record<string, number> = { success: 0, info: 0, warning: 0, danger: 0 }
    last24h.forEach((e) => { const t = eventTypes[e.type]; if (t) acc[t.severity]++ })
    return acc
  }, [last24h])

  const total = last24h.length

  const byBot = useMemo(() => {
    const acc: Record<string, number> = {}
    last24h.forEach((e) => {
      const display = e.bot || (e.bot_id ? (botMap.get(e.bot_id) ?? e.bot_id.slice(0, 8)) : '')
      if (display) acc[display] = (acc[display] || 0) + 1
    })
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [last24h, botMap])

  const critical = useMemo(
    () => events.filter((e) => eventTypes[e.type]?.severity === 'danger').slice(0, 3),
    [events],
  )

  const sevConfig = [
    { key: 'success', label: 'Sucesso',     sev: 'success' },
    { key: 'info',    label: 'Informações', sev: 'info'    },
    { key: 'warning', label: 'Avisos',      sev: 'warning' },
    { key: 'danger',  label: 'Críticos',    sev: 'danger'  },
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
          {byBot.length === 0 && (
            <div className="text-[12px] text-text-muted">Sem atividade nas últimas 24 h.</div>
          )}
          {byBot.map(([bot, count]) => {
            const pct = byBot[0][1] > 0 ? (count / byBot[0][1]) * 100 : 0
            return (
              <div key={bot}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="tnum text-text truncate">{bot}</span>
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
        action={
          critical.length > 0 ? (
            <button
              onClick={() => onSelectCategory('Apenas críticos')}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Ver todos
            </button>
          ) : undefined
        }
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
              const botDisplay = e.bot || (e.bot_id ? (botMap.get(e.bot_id) ?? '') : '')
              return (
                <div key={e.id} className="flex items-start gap-2.5 text-[12px]">
                  <span className="w-6 h-6 rounded-md bg-danger-soft text-danger flex items-center justify-center shrink-0">
                    <Icon name={t.icon} size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-text truncate font-medium leading-tight">{e.title}</div>
                    <div className="text-[10.5px] text-text-muted tnum mt-0.5">
                      {relTime(e.dt, now)}{botDisplay ? ` · ${botDisplay}` : ''}
                    </div>
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

/* ── Empty states ─────────────────────────────────────────── */

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

function NoDataState() {
  return (
    <div className="bg-surface border border-dashed border-border rounded-xl py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-5">
        <Bell size={22} />
      </div>
      <div className="text-[15px] font-semibold text-text">Aguardando primeiros eventos</div>
      <p className="text-[12.5px] text-text-muted mt-2 max-w-sm leading-relaxed">
        Os eventos aparecerão aqui em tempo real conforme seus bots receberem mensagens e
        pagamentos forem processados.
      </p>
      <div className="mt-5 flex flex-col gap-1.5 text-[11.5px] text-text-subtle">
        <span>• Conecte um bot do Telegram para registrar leads</span>
        <span>• Pagamentos aprovados via PIX aparecem automaticamente</span>
      </div>
    </div>
  )
}

/* ── Main Client Component ────────────────────────────────── */

const PAGE_SIZE = 25

export default function ActivityClient({
  initialEvents,
  bots,
}: {
  initialEvents: RawActivityEvent[]
  bots: BotOption[]
}) {
  const { track } = useAnalytics()
  const router = useRouter()

  const [rows, setRows] = useState<ActivityEvent[]>(() => initialEvents.map(mapRaw))
  const [extras, setExtras] = useState<ActivityEvent[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [live, setLive] = useState(true)
  const [category, setCategory] = useState(() => LS.get('umbra_act_category', 'Todas as categorias'))
  const [botId,    setBotId]    = useState(() => LS.get('umbra_act_bot',      'all'))
  const [period,   setPeriod]   = useState(() => LS.get('umbra_act_period',   'all'))
  const [search,   setSearch]   = useState(() => LS.get('umbra_act_search',   ''))
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [dbOffset, setDbOffset] = useState(initialEvents.length)
  const [hasMore, setHasMore] = useState(initialEvents.length >= PAGE_SIZE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const initialNewIds = useRef(new Set<string>())
  const liveRef = useRef(live)
  const periodRef = useRef(period)

  useEffect(() => { liveRef.current = live }, [live])
  useEffect(() => { periodRef.current = period }, [period])

  // Tick now a cada 30s usando Date.now() real (sem incremento de valor fixo)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // Supabase Realtime — inserts em tempo real
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events' },
        (payload: { new: Record<string, unknown> }) => {
          if (!liveRef.current) return
          const row = payload.new as unknown as RawActivityEvent
          const evt = mapRaw(row)
          initialNewIds.current.add(evt.id)
          setExtras((prev) => [evt, ...prev].slice(0, 40))
          setNow(Date.now())
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])


  // Carrega mais eventos do banco com offset (respeita filtro de período)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const supabase = createClient()
      const cutoff = getPeriodCutoff(periodRef.current, Date.now())
      let query = supabase
        .from('activity_events')
        .select('id, type, title, description, bot, bot_id, amount, created_at')
        .order('created_at', { ascending: false })
        .range(dbOffset, dbOffset + PAGE_SIZE - 1)
      if (cutoff !== null) query = query.gte('created_at', new Date(cutoff).toISOString())
      const { data } = await query

      if (data && data.length > 0) {
        setRows((prev) => [...prev, ...(data as unknown as RawActivityEvent[]).map(mapRaw)])
        setDbOffset((prev) => prev + data.length)
        setHasMore(data.length === PAGE_SIZE)
      } else {
        setHasMore(false)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, dbOffset])

  // Mapa id → nome de exibição do bot (para resolver bot_id → @username)
  const botMap = useMemo(() => {
    const m = new Map<string, string>()
    bots.forEach((b) => {
      m.set(b.id, b.username ? `@${b.username}` : b.name)
    })
    return m
  }, [bots])

  // Todos os eventos: realtime (extras) + banco/mock (rows)
  const allEvents = useMemo(() => [...extras, ...rows], [extras, rows])

  // Filtro por período + categoria + bot + busca de texto
  const filtered = useMemo(() => {
    const cutoff = getPeriodCutoff(period, now)
    const q = search.trim().toLowerCase()
    return allEvents.filter((e) => {
      if (cutoff !== null && e.dt < cutoff) return false
      const cat = categoryGroups[category]
      if (cat === 'critical') {
        if (eventTypes[e.type]?.severity !== 'danger') return false
      } else if (Array.isArray(cat)) {
        if (!cat.includes(e.type)) return false
      }
      if (botId !== 'all' && e.bot_id !== botId) return false
      if (q && !e.title.toLowerCase().includes(q) && !e.desc.toLowerCase().includes(q)) return false
      return true
    })
  }, [allEvents, category, botId, period, search, now])

  // Resetar visível ao mudar filtros
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [category, botId, period, search])

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

  // IntersectionObserver — lazy render + load more automático
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      if (visibleCount < filtered.length) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length))
      } else if (hasMore && !isLoadingMore) {
        loadMore()
      }
    }, { rootMargin: '400px', threshold: 0 })
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [visibleCount, filtered.length, hasMore, isLoadingMore, loadMore])

  const eventsPerHour = useMemo(
    () => allEvents.filter((e) => now - e.dt < 3600000).length,
    [allEvents, now],
  )

  const hasFilters = category !== 'Todas as categorias' || botId !== 'all' || period !== 'all' || search !== ''
  const onClear = () => {
    setCategory('Todas as categorias'); LS.del('umbra_act_category')
    setBotId('all');                    LS.del('umbra_act_bot')
    setPeriod('all');                   LS.del('umbra_act_period')
    setSearch('');                      LS.del('umbra_act_search')
  }

  // Handlers com PostHog + localStorage
  const handleCategoryChange = (v: string) => {
    setCategory(v); LS.set('umbra_act_category', v)
    track('activity_filter_changed', { category: v, bot_filtered: botId !== 'all' })
  }

  const handleBotChange = (v: string) => {
    setBotId(v); LS.set('umbra_act_bot', v)
    track('activity_filter_changed', { category, bot_filtered: v !== 'all' })
  }

  const handlePeriodChange = (v: string) => {
    setPeriod(v); LS.set('umbra_act_period', v)
    track('activity_filter_changed', { category, bot_filtered: botId !== 'all', period: v })
  }

  const handleSearchChange = (v: string) => {
    setSearch(v); LS.set('umbra_act_search', v)
  }

  const handleLiveToggle = () => {
    const next = !live
    setLive(next)
    track('activity_live_toggled', { live: next })
  }

  // Export CSV com filtros ativos
  const handleExport = () => {
    const csvRows = filtered.map((e) => [
      fmtExport(e.dt),
      eventTypes[e.type]?.label ?? e.type,
      e.title,
      e.desc,
      e.bot || (e.bot_id ? (botMap.get(e.bot_id) ?? '') : ''),
      e.amount != null ? e.amount.toFixed(2) : '',
    ])
    exportCSV(
      `atividade_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Data', 'Tipo', 'Título', 'Descrição', 'Bot', 'Valor (R$)'],
      csvRows,
    )
    track('csv_exported', { section: 'activity', rows: csvRows.length })
  }

  return (
    <>
      <PageHeader
        title="Atividade"
        subtitle="Linha do tempo de eventos do seu painel — vendas, leads, sistema e integrações."
        actions={
          <>
            <Btn
              iconName="download"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              Exportar
            </Btn>
            <Btn iconName="bell" onClick={() => router.push('/dashboard/alerts')}>
              Configurar alertas
            </Btn>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        <div className="min-w-0">
          <FilterBar
            category={category}
            onCategoryChange={handleCategoryChange}
            botId={botId}
            onBotChange={handleBotChange}
            period={period}
            onPeriodChange={handlePeriodChange}
            search={search}
            onSearchChange={handleSearchChange}
            bots={bots}
            live={live}
            onLiveToggle={handleLiveToggle}
            eventsPerHour={eventsPerHour}
            onClear={onClear}
            hasFilters={hasFilters}
          />

          {allEvents.length === 0 ? (
            <NoDataState />
          ) : filtered.length === 0 ? (
            <EmptyFeed onClear={onClear} />
          ) : (
            <div className="space-y-1">
              {grouped.map(([k, items]) => (
                <DayGroup
                  key={k}
                  dayKey={k}
                  events={items}
                  now={now}
                  newIds={initialNewIds.current}
                  botMap={botMap}
                />
              ))}

              <div ref={sentinelRef} className="py-6 flex items-center justify-center">
                {(visibleCount < filtered.length || isLoadingMore) ? (
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
            onSelectCategory={(v) => setCategory(v)}
            botMap={botMap}
          />
        </aside>
      </div>
    </>
  )
}
