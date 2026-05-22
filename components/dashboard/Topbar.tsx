'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, Bell, Sun, Moon, ChevronDown, Settings, HelpCircle, LogOut, User, Menu,
  Bot, Users, ArrowLeftRight, Loader2,
  GitBranch, Send, ExternalLink, Megaphone, UserPlus, CreditCard,
  Zap, BookOpen, GraduationCap, AlertTriangle, Link2,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useDashboard } from '@/providers/DashboardProvider'

export interface TopbarProps {
  onMobileMenu: () => void
}

type DbResult<T> = PromiseSettledResult<{ data: T[] | null }>
function ok<T>(r: DbResult<T>): T[] { return r.status === 'fulfilled' ? (r.value.data ?? []) : [] }

const PLAN_LABEL: Record<string, string> = {
  free: 'Plano Free',
  pro: 'Plano Pro',
  enterprise: 'Enterprise',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs} h`
  if (hrs < 48) return 'ontem'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function MenuItem({
  icon: Icon, label, danger, href, onClick,
}: {
  icon: React.ElementType
  label: string
  danger?: boolean
  href?: string
  onClick?: () => void
}) {
  const cls = cn(
    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] focus:outline-none rounded-md',
    danger ? 'text-danger hover:bg-danger-soft' : 'text-text hover:bg-surface-2',
  )
  const content = (
    <>
      <Icon size={15} className={danger ? '' : 'text-text-muted'} />
      <span className="flex-1 text-left">{label}</span>
    </>
  )
  if (href) return <Link href={href} className={cls}>{content}</Link>
  return <button onClick={onClick} className={cls}>{content}</button>
}

type SearchResultType =
  | 'bot' | 'contact' | 'transaction' | 'flow' | 'broadcast'
  | 'redirect' | 'campaign' | 'affiliate' | 'gateway' | 'biolink'
  | 'webhook' | 'article' | 'course' | 'alert'

interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  href: string
}

const TYPE_COLOR: Record<SearchResultType, { bg: string; text: string }> = {
  bot:         { bg: 'bg-violet-100',  text: 'text-violet-600'  },
  contact:     { bg: 'bg-sky-100',     text: 'text-sky-600'     },
  transaction: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  flow:        { bg: 'bg-orange-100',  text: 'text-orange-600'  },
  broadcast:   { bg: 'bg-blue-100',    text: 'text-blue-600'    },
  redirect:    { bg: 'bg-cyan-100',    text: 'text-cyan-600'    },
  campaign:    { bg: 'bg-pink-100',    text: 'text-pink-600'    },
  affiliate:   { bg: 'bg-amber-100',   text: 'text-amber-600'   },
  gateway:     { bg: 'bg-indigo-100',  text: 'text-indigo-600'  },
  biolink:     { bg: 'bg-teal-100',    text: 'text-teal-600'    },
  webhook:     { bg: 'bg-yellow-100',  text: 'text-yellow-600'  },
  article:     { bg: 'bg-lime-100',    text: 'text-lime-600'    },
  course:      { bg: 'bg-purple-100',  text: 'text-purple-600'  },
  alert:       { bg: 'bg-red-100',     text: 'text-red-600'     },
}

const TYPE_META: Record<SearchResultType, { label: string; Icon: React.ElementType; href: string }> = {
  bot:         { label: 'Bots',            Icon: Bot,            href: '/dashboard/bots'         },
  contact:     { label: 'Clientes',        Icon: Users,          href: '/dashboard/customers'    },
  transaction: { label: 'Transações',      Icon: ArrowLeftRight, href: '/dashboard/finance'      },
  flow:        { label: 'Fluxos de venda', Icon: GitBranch,      href: '/dashboard/flows'        },
  broadcast:   { label: 'Disparos',        Icon: Send,           href: '/dashboard/broadcasts'   },
  redirect:    { label: 'Redirecionadores',Icon: ExternalLink,   href: '/dashboard/redirects'    },
  campaign:    { label: 'Remarketing',     Icon: Megaphone,      href: '/dashboard/remarketing'  },
  affiliate:   { label: 'Afiliados',       Icon: UserPlus,       href: '/dashboard/affiliates'   },
  gateway:     { label: 'Gateways',        Icon: CreditCard,     href: '/dashboard/gateways'     },
  biolink:     { label: 'Bio Links',       Icon: Link2,          href: '/dashboard/biolink'      },
  webhook:     { label: 'Webhooks',        Icon: Zap,            href: '/dashboard/webhooks'     },
  article:     { label: 'Artigos / Guia',  Icon: BookOpen,       href: '/dashboard/guide'        },
  course:      { label: 'Cursos',          Icon: GraduationCap,  href: '/dashboard/academy'      },
  alert:       { label: 'Alertas',         Icon: AlertTriangle,  href: '/dashboard/alerts'       },
}

function SearchDropdown({ results, loading, query, onClose }: {
  results: SearchResult[]
  loading: boolean
  query: string
  onClose: () => void
}) {
  const grouped = (Object.keys(TYPE_META) as SearchResult['type'][]).map((type) => ({
    type,
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0)

  return (
    <div
      className="absolute left-0 top-full mt-1.5 w-full bg-surface border border-border rounded-xl z-50 overflow-hidden"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-text-muted">
          <Loader2 size={14} className="animate-spin" /> Buscando…
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-text-muted">
          Nenhum resultado para <strong className="text-text">&ldquo;{query}&rdquo;</strong>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto py-1">
          {grouped.map(({ type, items }) => {
            const meta  = TYPE_META[type]
            const color = TYPE_COLOR[type]
            return (
              <div key={type}>
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <meta.Icon size={11} className="text-text-muted" />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">{meta.label}</span>
                </div>
                {items.map((r) => (
                  <Link key={r.id} href={r.href} onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors">
                    <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', color.bg)}>
                      <meta.Icon size={13} className={color.text} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-text truncate">{r.title}</div>
                      <div className="text-[11px] text-text-muted truncate">{r.subtitle}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NotificationsDropdown({
  alerts,
  onMarkAllRead,
}: {
  alerts: { id: string; title: string; description: string; severity: string; created_at: string }[]
  onMarkAllRead: () => void
}) {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-[340px] bg-surface border border-border rounded-xl overflow-hidden z-50"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="text-[13px] font-semibold text-text">Notificações</div>
        {alerts.length > 0 && (
          <button onClick={onMarkAllRead} className="text-[11.5px] text-primary hover:underline font-medium">
            Marcar todas como lidas
          </button>
        )}
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-text-muted">
            Nenhuma notificação pendente.
          </div>
        ) : alerts.map((a) => (
          <button
            key={a.id}
            className="w-full flex items-start gap-3 px-3.5 py-2.5 text-left hover:bg-surface-2 border-b border-border last:border-b-0"
          >
            <span className={cn(
              'mt-1.5 w-2 h-2 rounded-full shrink-0',
              a.severity === 'critical' ? 'bg-danger'
                : a.severity === 'warning' ? 'bg-warning'
                : 'bg-text-muted',
            )} />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-text truncate">{a.title}</div>
              <div className="text-[11.5px] text-text-muted truncate">{a.description}</div>
              <div className="text-[10.5px] text-text-subtle mt-0.5">{relativeTime(a.created_at)}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="px-2 py-1.5 border-t border-border">
        <Link
          href="/dashboard/alerts"
          className="block w-full text-center text-[11.5px] font-medium text-primary hover:bg-surface-2 rounded-md py-1.5"
        >
          Ver todas as notificações
        </Link>
      </div>
    </div>
  )
}

function UserDropdown({ onLogout }: { onLogout: () => void }) {
  const { user } = useDashboard()
  return (
    <div
      className="absolute right-0 top-full mt-2 w-[240px] bg-surface border border-border rounded-xl overflow-hidden z-50 p-1"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <Link
        href="/dashboard/profile"
        className="block px-3 py-2.5 border-b border-border mb-1 hover:bg-surface-2 transition-colors rounded-t-xl"
      >
        <div className="text-[13px] font-semibold text-text leading-tight">{user.name}</div>
        <div className="text-[11.5px] text-text-muted leading-tight mt-0.5">{user.email}</div>
        <div className="mt-2 inline-flex items-center gap-1.5 text-[10.5px] font-medium text-text-muted bg-surface-2 border border-border rounded-md px-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          {PLAN_LABEL[user.plan] ?? 'Plano Free'}
        </div>
      </Link>
      <MenuItem icon={User}       label="Perfil"        href="/dashboard/profile" />
      <MenuItem icon={Settings}   label="Configurações" href="/dashboard/profile" />
      <MenuItem icon={HelpCircle} label="Suporte"       href="/dashboard/guide" />
      <div className="h-px bg-border my-1" />
      <MenuItem icon={LogOut} label="Sair" danger onClick={onLogout} />
    </div>
  )
}

export function Topbar({ onMobileMenu }: TopbarProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen,    setSearchOpen]    = useState(false)
  const searchWrapRef   = useRef<HTMLDivElement>(null)
  const searchVersionRef = useRef(0)

  const { user, alerts, markAllAlertsRead, logout } = useDashboard()

  type BotRow         = { id: string; name: string | null; username: string | null; status: string | null }
  type ContactRow     = { id: string; name: string | null; email: string | null }
  type TxRow          = { id: string; product_name: string | null; customer_name: string | null; amount: string | number }
  type FlowRow        = { id: string; name: string; description: string | null; status: string | null }
  type BroadcastRow   = { id: string; title: string; bot: string | null; status: string | null }
  type RedirectRow    = { id: string; slug: string; destination_label: string | null; status: string | null }
  type CampaignRow    = { id: string; name: string; description: string | null; status: string | null }
  type AffiliateRow   = { id: string; name: string; email: string | null; status: string | null }
  type GatewayRow     = { id: string; name: string; connected: boolean | null }
  type BiolinkRow     = { id: string; name: string | null; slug: string; status: string | null }
  type WebhookRow     = { id: string; name: string; url: string | null; status: string | null }
  type ArticleRow     = { id: string; title: string; excerpt: string | null; category: string | null }
  type CourseRow      = { id: string; title: string; subtitle: string | null; instructor: string | null }
  type AlertRow       = { id: string; title: string; description: string | null; severity: string }

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return }
    const version = ++searchVersionRef.current
    setSearchLoading(true)
    const supabase = createClient()
    const w = `%${q.trim()}%`

    const [
      botsR, contactsR, txR, flowsR, broadcastsR,
      redirectsR, campaignsR, affiliatesR, gatewaysR,
      biolinksR, webhooksR, articlesR, coursesR, alertsR,
    ] = await Promise.allSettled([
      supabase.from('bots').select('id,name,username,status').ilike('name', w).limit(2),
      supabase.from('contacts').select('id,name,email').or(`name.ilike.${w},email.ilike.${w}`).limit(2),
      supabase.from('transactions').select('id,product_name,customer_name,amount').or(`product_name.ilike.${w},customer_name.ilike.${w}`).limit(2),
      supabase.from('flows').select('id,name,description,status').ilike('name', w).limit(2),
      supabase.from('broadcasts').select('id,title,bot,status').ilike('title', w).limit(2),
      supabase.from('redirects').select('id,slug,destination_label,status').or(`slug.ilike.${w},destination_label.ilike.${w}`).limit(2),
      supabase.from('remarketing_campaigns').select('id,name,description,status').ilike('name', w).limit(2),
      supabase.from('affiliates').select('id,name,email,status').or(`name.ilike.${w},email.ilike.${w}`).limit(2),
      supabase.from('gateways').select('id,name,connected').ilike('name', w).limit(2),
      supabase.from('biolinks').select('id,name,slug,status').or(`name.ilike.${w},slug.ilike.${w}`).limit(2),
      supabase.from('webhooks').select('id,name,url,status').or(`name.ilike.${w},url.ilike.${w}`).limit(2),
      supabase.from('guide_articles').select('id,title,excerpt,category').or(`title.ilike.${w},excerpt.ilike.${w}`).limit(3),
      supabase.from('courses').select('id,title,subtitle,instructor').or(`title.ilike.${w},subtitle.ilike.${w}`).limit(2),
      supabase.from('alerts').select('id,title,description,severity').or(`title.ilike.${w},description.ilike.${w}`).limit(2),
    ])

    // Discard stale results if a newer search was triggered while awaiting
    if (version !== searchVersionRef.current) return

    const results: SearchResult[] = [
      ...ok<BotRow>(botsR as DbResult<BotRow>).map((b) => ({ id: b.id, type: 'bot' as const, title: b.name || 'Bot', subtitle: b.username ? `@${b.username}` : b.status ?? '', href: '/dashboard/bots' })),
      ...ok<ContactRow>(contactsR as DbResult<ContactRow>).map((c) => ({ id: c.id, type: 'contact' as const, title: c.name || c.email || 'Cliente', subtitle: c.email ?? '', href: '/dashboard/customers' })),
      ...ok<TxRow>(txR as DbResult<TxRow>).map((x) => ({ id: x.id, type: 'transaction' as const, title: x.product_name || 'Transação', subtitle: `${x.customer_name ?? ''} · R$ ${Number(x.amount).toFixed(2)}`.trim().replace(/^·\s*/, ''), href: '/dashboard/finance' })),
      ...ok<FlowRow>(flowsR as DbResult<FlowRow>).map((f) => ({ id: f.id, type: 'flow' as const, title: f.name, subtitle: f.description || f.status || '', href: '/dashboard/flows' })),
      ...ok<BroadcastRow>(broadcastsR as DbResult<BroadcastRow>).map((b) => ({ id: b.id, type: 'broadcast' as const, title: b.title, subtitle: b.bot || b.status || '', href: '/dashboard/broadcasts' })),
      ...ok<RedirectRow>(redirectsR as DbResult<RedirectRow>).map((r) => ({ id: r.id, type: 'redirect' as const, title: r.destination_label || r.slug, subtitle: `/${r.slug}`, href: '/dashboard/redirects' })),
      ...ok<CampaignRow>(campaignsR as DbResult<CampaignRow>).map((c) => ({ id: c.id, type: 'campaign' as const, title: c.name, subtitle: c.description || c.status || '', href: '/dashboard/remarketing' })),
      ...ok<AffiliateRow>(affiliatesR as DbResult<AffiliateRow>).map((a) => ({ id: a.id, type: 'affiliate' as const, title: a.name, subtitle: a.email || '', href: '/dashboard/affiliates' })),
      ...ok<GatewayRow>(gatewaysR as DbResult<GatewayRow>).map((g) => ({ id: g.id, type: 'gateway' as const, title: g.name, subtitle: g.connected ? 'Conectado' : 'Desconectado', href: '/dashboard/gateways' })),
      ...ok<BiolinkRow>(biolinksR as DbResult<BiolinkRow>).map((b) => ({ id: b.id, type: 'biolink' as const, title: b.name || b.slug, subtitle: `umbra.bio/${b.slug}`, href: '/dashboard/biolink' })),
      ...ok<WebhookRow>(webhooksR as DbResult<WebhookRow>).map((w) => ({ id: w.id, type: 'webhook' as const, title: w.name, subtitle: w.url || '', href: '/dashboard/webhooks' })),
      ...ok<ArticleRow>(articlesR as DbResult<ArticleRow>).map((a) => ({ id: a.id, type: 'article' as const, title: a.title, subtitle: a.category || a.excerpt?.slice(0, 60) || '', href: '/dashboard/guide' })),
      ...ok<CourseRow>(coursesR as DbResult<CourseRow>).map((c) => ({ id: c.id, type: 'course' as const, title: c.title, subtitle: c.instructor || c.subtitle || '', href: '/dashboard/academy' })),
      ...ok<AlertRow>(alertsR as DbResult<AlertRow>).map((a) => ({ id: a.id, type: 'alert' as const, title: a.title, subtitle: a.description?.slice(0, 60) || a.severity, href: '/dashboard/alerts' })),
    ]

    setSearchResults(results)
    setSearchLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery) runSearch(searchQuery) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, runSearch])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setUserOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center px-3 md:px-5 gap-2 shrink-0 z-30">
      <button
        onClick={onMobileMenu}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 focus:outline-none"
        title="Abrir menu"
      >
        <Menu size={18} />
      </button>

      <div className="hidden sm:flex flex-1 max-w-md relative ml-1" ref={searchWrapRef}>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10" />
        <input
          ref={searchRef}
          type="search"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') } }}
          placeholder="Pesquisar bots, clientes, transações…"
          className="w-full h-9 pl-9 pr-14 bg-surface-2 border border-border rounded-lg text-[13px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
          autoComplete="off"
        />
        <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-text-muted bg-surface border border-border rounded px-1.5 h-5 items-center tnum">
          ⌘K
        </kbd>
        {searchOpen && searchQuery.trim().length >= 2 && (
          <SearchDropdown
            results={searchResults}
            loading={searchLoading}
            query={searchQuery}
            onClose={() => { setSearchOpen(false); setSearchQuery('') }}
          />
        )}
      </div>

      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-0.5 ml-auto">
        <button className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2">
          <Search size={18} />
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 focus:outline-none"
          title={mounted && theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {mounted && theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((o) => !o); setUserOpen(false) }}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 focus:outline-none"
            title="Notificações"
          >
            <Bell size={17} />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] text-[10px] font-semibold leading-none flex items-center justify-center bg-danger text-white rounded-full px-1 tnum ring-2 ring-surface">
                {alerts.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <NotificationsDropdown alerts={alerts} onMarkAllRead={markAllAlertsRead} />
          )}
        </div>

        <div className="relative ml-1" ref={userRef}>
          <button
            onClick={() => { setUserOpen((o) => !o); setNotifOpen(false) }}
            className="flex items-center gap-2 pl-1 pr-1.5 md:pr-2 h-9 rounded-lg hover:bg-surface-2 focus:outline-none"
          >
            <div className="w-7 h-7 rounded-md bg-primary text-primary-fg text-[11px] font-semibold flex items-center justify-center">
              {user.initials || '…'}
            </div>
            <div className="hidden lg:flex flex-col items-start leading-tight">
              <span className="text-[12px] font-medium text-text">{user.name || '…'}</span>
              <span className="text-[10.5px] text-text-muted">Administrador</span>
            </div>
            <ChevronDown size={13} className="hidden lg:inline text-text-muted" />
          </button>
          {userOpen && <UserDropdown onLogout={logout} />}
        </div>
      </div>
    </header>
  )
}
