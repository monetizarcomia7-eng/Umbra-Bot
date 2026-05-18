'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BarChart3, Wallet, Activity, Users, UserPlus,
  AlertTriangle, Bot, GitBranch, Shuffle, Megaphone, Send, Wrench,
  CreditCard, LineChart, ShoppingCart, Link2, Webhook, User, Bell,
  BookOpen, GraduationCap, LogOut, ChevronLeft, ChevronRight, ChevronDown, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarProps {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

interface NavItemDef {
  id: string
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

interface NavGroupDef {
  id: string
  label: string
  items: NavItemDef[]
}

const topNav: NavItemDef[] = [
  { id: 'dashboard',  label: 'Dashboard',           href: '/dashboard',           icon: LayoutDashboard },
  { id: 'analytics',  label: 'Análises',            href: '/dashboard/analytics', icon: BarChart3 },
  { id: 'finance',    label: 'Financeiro',          href: '/dashboard/finance',   icon: Wallet },
  { id: 'activity',   label: 'Atividade',           href: '/dashboard/activity',  icon: Activity },
  { id: 'customers',  label: 'Clientes',            href: '/dashboard/customers', icon: Users },
  { id: 'affiliates', label: 'Afiliados',           href: '/dashboard/affiliates', icon: UserPlus },
  { id: 'alerts',     label: 'Alertas Importantes', href: '/dashboard/alerts',    icon: AlertTriangle, badge: 3 },
]

const navGroups: NavGroupDef[] = [
  {
    id: 'automacoes',
    label: 'Automações',
    items: [
      { id: 'bots',        label: 'Gerenciar bots',   href: '/dashboard/bots',        icon: Bot },
      { id: 'flows',       label: 'Fluxos de venda',  href: '/dashboard/flows',       icon: GitBranch },
      { id: 'redirects',   label: 'Redirecionadores', href: '/dashboard/redirects',   icon: Shuffle },
      { id: 'remarketing', label: 'Remarketing',      href: '/dashboard/remarketing', icon: Megaphone },
      { id: 'sender',      label: 'Disparador',       href: '/dashboard/sender',      icon: Send },
      { id: 'tools',       label: 'Ferramentas',      href: '/dashboard/tools',       icon: Wrench },
    ],
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    items: [
      { id: 'gateways',  label: 'Gateways',     href: '/dashboard/gateways',  icon: CreditCard },
      { id: 'tracking',  label: 'Trackeamento', href: '/dashboard/tracking',  icon: LineChart },
      { id: 'checkout',  label: 'Checkout',     href: '/dashboard/checkout',  icon: ShoppingCart },
      { id: 'biolink',   label: 'Bio Link',     href: '/dashboard/biolink',   icon: Link2 },
      { id: 'webhooks',  label: 'Webhooks',     href: '/dashboard/webhooks',  icon: Webhook },
    ],
  },
  {
    id: 'config',
    label: 'Configurações',
    items: [
      { id: 'profile',       label: 'Perfil',              href: '/dashboard/profile',       icon: User },
      { id: 'notifications', label: 'Notificações',        href: '/dashboard/notifications', icon: Bell },
      { id: 'guide',         label: 'Guia da Plataforma',  href: '/dashboard/guide',         icon: BookOpen },
      { id: 'education',     label: 'Sistema Educacional', href: '/dashboard/education',     icon: GraduationCap },
    ],
  },
]

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none min-w-0">
      <svg viewBox="0 0 32 32" width="28" height="28" className="shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path
          d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z"
          fill="white"
        />
      </svg>
      {!collapsed && (
        <div className="font-semibold tracking-tight text-[15px] leading-none truncate text-text">
          Umbra<span className="text-text-muted font-normal"> Bot</span>
        </div>
      )}
    </div>
  )
}

function NavItem({
  item, isActive, collapsed, onClick,
}: {
  item: NavItemDef
  isActive: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'relative w-full flex items-center rounded-lg text-[13.5px] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary/40',
        collapsed ? 'h-9 justify-center' : 'h-9 gap-3 px-2.5',
        isActive
          ? 'bg-primary-soft text-primary font-medium'
          : 'text-text-muted hover:text-text hover:bg-surface-2',
      )}
    >
      <Icon size={17} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge ? (
            <span className={cn(
              'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md tnum leading-none',
              isActive ? 'bg-primary text-primary-fg' : 'bg-danger-soft text-danger',
            )}>
              {item.badge}
            </span>
          ) : null}
        </>
      )}
      {collapsed && item.badge ? (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-danger rounded-full ring-2 ring-surface" />
      ) : null}
    </Link>
  )
}

function NavGroup({
  group, pathname, collapsed, isOpen, onToggle, onItemClick,
}: {
  group: NavGroupDef
  pathname: string
  collapsed: boolean
  isOpen: boolean
  onToggle: () => void
  onItemClick?: () => void
}) {
  return (
    <div className="space-y-0.5">
      {collapsed ? (
        <div className="my-2 mx-3 h-px bg-border" />
      ) : (
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-text-subtle hover:text-text-muted focus:outline-none rounded"
        >
          <span>{group.label}</span>
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      )}
      {(isOpen || collapsed) && group.items.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          isActive={pathname === item.href}
          collapsed={collapsed}
          onClick={onItemClick}
        />
      ))}
    </div>
  )
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    automacoes: true,
    integracoes: true,
    config: true,
  })

  const toggleGroup = (id: string) =>
    setOpenGroups((g) => ({ ...g, [id]: !g[id] }))

  const handleItemClick = () => {
    if (mobileOpen) setMobileOpen(false)
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'flex flex-col bg-surface border-r border-border z-50 shrink-0',
          'fixed md:static inset-y-0 left-0',
          'transition-[width,transform] duration-300',
          'w-[280px]',
          collapsed ? 'md:w-[68px]' : 'md:w-[244px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-border shrink-0">
          <Logo collapsed={collapsed} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex w-7 h-7 items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 focus:outline-none"
            title="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-hide">
          <div className="space-y-0.5">
            {topNav.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={pathname === item.href}
                collapsed={collapsed}
                onClick={handleItemClick}
              />
            ))}
          </div>

          {navGroups.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              pathname={pathname}
              collapsed={collapsed}
              isOpen={openGroups[group.id] ?? true}
              onToggle={() => toggleGroup(group.id)}
              onItemClick={handleItemClick}
            />
          ))}
        </nav>

        <div className="p-2 border-t border-border shrink-0">
          <Link
            href="/logout"
            title={collapsed ? 'Sair da Conta' : undefined}
            className={cn(
              'w-full flex items-center rounded-lg text-[13.5px] transition-colors',
              'text-text-muted hover:text-text hover:bg-surface-2',
              'focus:outline-none focus:ring-2 focus:ring-primary/40',
              collapsed ? 'h-9 justify-center' : 'h-9 gap-3 px-2.5',
            )}
          >
            <LogOut size={17} className="shrink-0" />
            {!collapsed && <span className="flex-1 text-left">Sair da Conta</span>}
          </Link>
        </div>
      </aside>
    </>
  )
}
