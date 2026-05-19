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
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'

export interface TopbarProps {
  onMobileMenu: () => void
}

interface AlertRow {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  created_at: string
}

interface UserInfo {
  id: string
  name: string
  email: string
  initials: string
  plan: 'free' | 'pro' | 'enterprise'
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
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

const PLAN_LABEL: Record<string, string> = {
  free: 'Plano Free',
  pro: 'Plano Pro',
  enterprise: 'Enterprise',
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
  if (href) {
    return <Link href={href} className={cls}>{content}</Link>
  }
  return (
    <button onClick={onClick} className={cls}>{content}</button>
  )
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
    <div className="absolute left-0 top-full mt-1.5 w-full bg-surface border border-border rounded-xl z-50 overflow-hidden"
      style={{ boxShadow: 'var(--shadow-lg)' }}>
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
            const meta = TYPE_META[type]
            return (
              <div key={type}>
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <meta.Icon size={11} className="text-text-muted" />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">{meta.label}</span>
                </div>
                {items.map((r) => (
                  <Link key={r.id} href={r.href} onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <meta.Icon size={13} className="text-primary" />
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
  alerts: AlertRow[]
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
        <button className="w-full text-center text-[11.5px] font-medium text-primary hover:bg-surface-2 rounded-md py-1.5">
          Ver todas as notificações
        </button>
      </div>
    </div>
  )
}

function UserDropdown({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-[240px] bg-surface border border-border rounded-xl overflow-hidden z-50 p-1"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <Link href="/dashboard/profile"
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
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [user, setUser] = useState<UserInfo>({ id: '', name: '', email: '', initials: '', plan: 'free' })
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen,    setSearchOpen]    = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  const { identify, reset } = useAnalytics()

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return }
    setSearchLoading(true)
    const supabase = createClient()
    const t = q.trim()
    const w = `%${t}%`

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? (r.value.data ?? []) : []

    const results: SearchResult[] = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(botsR).map((b: any) => ({ id: b.id, type: 'bot' as const, title: b.name || 'Bot', subtitle: b.username ? `@${b.username}` : b.status ?? '', href: '/dashboard/bots' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(contactsR).map((c: any) => ({ id: c.id, type: 'contact' as const, title: c.name || c.email || 'Cliente', subtitle: c.email ?? '', href: '/dashboard/customers' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(txR).map((x: any) => ({ id: x.id, type: 'transaction' as const, title: x.product_name || 'Transação', subtitle: `${x.customer_name ?? ''} · R$ ${Number(x.amount).toFixed(2)}`.trim().replace(/^·\s*/, ''), href: '/dashboard/finance' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(flowsR).map((f: any) => ({ id: f.id, type: 'flow' as const, title: f.name, subtitle: f.description || f.status, href: '/dashboard/flows' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(broadcastsR).map((b: any) => ({ id: b.id, type: 'broadcast' as const, title: b.title, subtitle: b.bot || b.status, href: '/dashboard/broadcasts' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(redirectsR).map((r: any) => ({ id: r.id, type: 'redirect' as const, title: r.destination_label || r.slug, subtitle: `/${r.slug}`, href: '/dashboard/redirects' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(campaignsR).map((c: any) => ({ id: c.id, type: 'campaign' as const, title: c.name, subtitle: c.description || c.status, href: '/dashboard/remarketing' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(affiliatesR).map((a: any) => ({ id: a.id, type: 'affiliate' as const, title: a.name, subtitle: a.email, href: '/dashboard/affiliates' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(gatewaysR).map((g: any) => ({ id: g.id, type: 'gateway' as const, title: g.name, subtitle: g.connected ? 'Conectado' : 'Desconectado', href: '/dashboard/gateways' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(biolinksR).map((b: any) => ({ id: b.id, type: 'biolink' as const, title: b.name || b.slug, subtitle: `umbra.bio/${b.slug}`, href: '/dashboard/biolink' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(webhooksR).map((w: any) => ({ id: w.id, type: 'webhook' as const, title: w.name, subtitle: w.url, href: '/dashboard/webhooks' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(articlesR).map((a: any) => ({ id: a.id, type: 'article' as const, title: a.title, subtitle: a.category || a.excerpt?.slice(0, 60) || '', href: '/dashboard/guide' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(coursesR).map((c: any) => ({ id: c.id, type: 'course' as const, title: c.title, subtitle: c.instructor || c.subtitle, href: '/dashboard/academy' })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...ok(alertsR).map((a: any) => ({ id: a.id, type: 'alert' as const, title: a.title, subtitle: a.description?.slice(0, 60) || a.severity, href: '/dashboard/alerts' })),
    ]

    setSearchResults(results)
    setSearchLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery) runSearch(searchQuery) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, runSearch])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return

      const name = (data.user.user_metadata?.full_name as string | undefined)
        || data.user.email?.split('@')[0]
        || 'Usuário'

      const uid = data.user.id

      // Fetch profile (plan)
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', uid)
        .single()

      setUser({
        id: uid,
        name,
        email: data.user.email ?? '',
        initials: getInitials(name),
        plan: (profile?.plan as UserInfo['plan']) ?? 'free',
      })

      identify(uid, { email: data.user.email, name })

      // Fetch unresolved alerts
      const { data: alertData } = await supabase
        .from('alerts')
        .select('id, title, description, severity, created_at')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10)

      setAlerts((alertData as AlertRow[]) ?? [])
    })
  }, [])

  async function handleMarkAllRead() {
    if (alerts.length === 0) return
    const supabase = createClient()
    await supabase
      .from('alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .in('id', alerts.map((a) => a.id))
    setAlerts([])
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    reset()
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
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
            <NotificationsDropdown alerts={alerts} onMarkAllRead={handleMarkAllRead} />
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
          {userOpen && <UserDropdown user={user} onLogout={handleLogout} />}
        </div>
      </div>
    </header>
  )
}
