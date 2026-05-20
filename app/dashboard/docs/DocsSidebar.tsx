'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { DOC_NAV } from './_nav'
import { cn } from '@/lib/utils'
import { ChevronRight, Sun, Moon, ArrowLeft, BookOpen } from 'lucide-react'

export function DocsSidebar() {
  const pathname  = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && theme === 'dark'

  return (
    <nav className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col h-full">

      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-[var(--accent-fg)] flex items-center justify-center shrink-0">
            <BookOpen size={13} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-[var(--foreground)]">Documentação</span>
        </div>
        <Link
          href="/dashboard/bots"
          className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={12} />
          Voltar ao painel
        </Link>
      </div>

      {/* Nav — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {DOC_NAV.map((section) => (
          <div key={section.folder} className="mb-1">
            <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              {section.title}
            </p>
            {section.articles.map((article) => {
              const href   = `/dashboard/docs/${section.folder}/${article.slug}`
              const active = pathname === href
              return (
                <Link
                  key={article.slug}
                  href={href}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg px-3 py-[7px] text-[13px] transition-all duration-150',
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-fg)] font-semibold'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  )}
                >
                  <ChevronRight
                    size={11}
                    className={cn(
                      'shrink-0 transition-opacity',
                      active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                    )}
                  />
                  <span className="leading-snug">{article.title}</span>
                </Link>
              )
            })}
          </div>
        ))}
        <div className="h-4" />
      </div>

      {/* Footer — theme toggle */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--border)]">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
        >
          {mounted
            ? isDark
              ? <Sun size={14} className="shrink-0" />
              : <Moon size={14} className="shrink-0" />
            : <Moon size={14} className="shrink-0" />
          }
          <span>{mounted ? (isDark ? 'Tema claro' : 'Tema escuro') : 'Tema escuro'}</span>
          <div className={cn(
            'ml-auto w-8 h-4 rounded-full flex items-center transition-colors duration-200 px-0.5',
            isDark ? 'bg-[var(--accent-fg)]' : 'bg-[var(--border)]'
          )}>
            <div className={cn(
              'w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200',
              isDark ? 'translate-x-4' : 'translate-x-0'
            )} />
          </div>
        </button>
      </div>
    </nav>
  )
}
