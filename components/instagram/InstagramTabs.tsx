'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarPlus, ListTodo, Users, Settings } from 'lucide-react'

const TABS = [
  { href: '/dashboard/instagram/posts',     label: 'Posts',           Icon: ListTodo },
  { href: '/dashboard/instagram/schedule',  label: 'Agendar',         Icon: CalendarPlus },
  { href: '/dashboard/instagram/accounts',  label: 'Contas',          Icon: Users },
  { href: '/dashboard/instagram/settings',  label: 'Configurações',   Icon: Settings },
] as const

export default function InstagramTabs() {
  const pathname = usePathname() ?? ''

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              color: active ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: active
                ? '2px solid var(--primary)'
                : '2px solid transparent',
              marginBottom: -1, // alinha com o border-b do layout
            }}
          >
            <Icon size={14} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
