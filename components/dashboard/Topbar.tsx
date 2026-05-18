'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, Bell, Sun, Moon, ChevronDown, Settings, HelpCircle, LogOut, User, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

export interface TopbarProps {
  onMobileMenu: () => void
}

const mockNotifications = [
  { id: 1, title: 'Nova venda confirmada',   desc: 'Plano Pro Anual · R$ 1.297,00',           time: 'há 2 min',  unread: true,  kind: 'success' },
  { id: 2, title: 'Falha na integração',     desc: 'Gateway Pushinpay retornou erro 502',     time: 'há 18 min', unread: true,  kind: 'danger'  },
  { id: 3, title: 'Pico de tráfego no bot', desc: '124 novos usuários em 5 min',             time: 'há 1 h',    unread: true,  kind: 'warning' },
  { id: 4, title: 'Remarketing concluído',   desc: 'Campanha "Carrinho abandonado" entregue', time: 'há 3 h',    unread: false, kind: 'info'    },
  { id: 5, title: 'Saque processado',        desc: 'R$ 12.480,00 transferido para conta',     time: 'ontem',     unread: false, kind: 'info'    },
]

const mockUser = {
  name: 'Ana Souza',
  email: 'ana@umbra.bot',
  initials: 'AS',
  role: 'Administradora',
  workspace: 'Tribo Black',
}

function MenuItem({
  icon: Icon, label, danger, onClick,
}: {
  icon: React.ElementType
  label: string
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] focus:outline-none rounded-md',
        danger ? 'text-danger hover:bg-danger-soft' : 'text-text hover:bg-surface-2',
      )}
    >
      <Icon size={15} className={danger ? '' : 'text-text-muted'} />
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
}

function NotificationsDropdown() {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-[340px] bg-surface border border-border rounded-xl overflow-hidden z-50"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="text-[13px] font-semibold text-text">Notificações</div>
        <button className="text-[11.5px] text-primary hover:underline font-medium">
          Marcar todas como lidas
        </button>
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {mockNotifications.map((n) => (
          <button
            key={n.id}
            className="w-full flex items-start gap-3 px-3.5 py-2.5 text-left hover:bg-surface-2 border-b border-border last:border-b-0"
          >
            <span className={cn(
              'mt-1.5 w-2 h-2 rounded-full shrink-0',
              n.kind === 'success' ? 'bg-success'
                : n.kind === 'danger' ? 'bg-danger'
                : n.kind === 'warning' ? 'bg-warning'
                : 'bg-text-muted',
              !n.unread && 'opacity-30',
            )} />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-text truncate">{n.title}</div>
              <div className="text-[11.5px] text-text-muted truncate">{n.desc}</div>
              <div className="text-[10.5px] text-text-subtle mt-0.5">{n.time}</div>
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

function UserDropdown() {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-[240px] bg-surface border border-border rounded-xl overflow-hidden z-50 p-1"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="px-3 py-2.5 border-b border-border mb-1">
        <div className="text-[13px] font-semibold text-text leading-tight">{mockUser.name}</div>
        <div className="text-[11.5px] text-text-muted leading-tight mt-0.5">{mockUser.email}</div>
        <div className="mt-2 inline-flex items-center gap-1.5 text-[10.5px] font-medium text-text-muted bg-surface-2 border border-border rounded-md px-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          {mockUser.workspace}
        </div>
      </div>
      <MenuItem icon={User}        label="Perfil" />
      <MenuItem icon={Settings}    label="Configurações" />
      <MenuItem icon={HelpCircle}  label="Suporte" />
      <div className="h-px bg-border my-1" />
      <MenuItem icon={LogOut}      label="Sair" danger />
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

  useEffect(() => { setMounted(true) }, [])

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

  const unread = mockNotifications.filter((n) => n.unread).length

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

      <div className="flex items-center gap-0.5">
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
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] text-[10px] font-semibold leading-none flex items-center justify-center bg-danger text-white rounded-full px-1 tnum ring-2 ring-surface">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && <NotificationsDropdown />}
        </div>

        <div className="relative ml-1" ref={userRef}>
          <button
            onClick={() => { setUserOpen((o) => !o); setNotifOpen(false) }}
            className="flex items-center gap-2 pl-1 pr-1.5 md:pr-2 h-9 rounded-lg hover:bg-surface-2 focus:outline-none"
          >
            <div className="w-7 h-7 rounded-md bg-primary text-primary-fg text-[11px] font-semibold flex items-center justify-center">
              {mockUser.initials}
            </div>
            <div className="hidden lg:flex flex-col items-start leading-tight">
              <span className="text-[12px] font-medium text-text">{mockUser.name}</span>
              <span className="text-[10.5px] text-text-muted">{mockUser.role}</span>
            </div>
            <ChevronDown size={13} className="hidden lg:inline text-text-muted" />
          </button>
          {userOpen && <UserDropdown />}
        </div>
      </div>
    </header>
  )
}
