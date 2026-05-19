'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, Bell, Sun, Moon, ChevronDown, Settings, HelpCircle, LogOut, User, Menu } from 'lucide-react'
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

  const { identify, reset } = useAnalytics()

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
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
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

      <div className="hidden sm:flex flex-1 max-w-md relative ml-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          ref={searchRef}
          type="search"
          placeholder="Pesquisar bots, clientes, transações…"
          className="w-full h-9 pl-9 pr-14 bg-surface-2 border border-border rounded-lg text-[13px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
        />
        <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-text-muted bg-surface border border-border rounded px-1.5 h-5 items-center tnum">
          ⌘K
        </kbd>
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
