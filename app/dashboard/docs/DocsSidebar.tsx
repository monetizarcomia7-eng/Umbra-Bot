'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOC_NAV } from './_nav'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

export function DocsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] h-full overflow-y-auto">
      <div className="p-4 border-b border-[var(--border)]">
        <Link
          href="/dashboard/docs"
          className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent-fg)] transition-colors"
        >
          Documentação
        </Link>
      </div>

      <div className="p-3 space-y-1">
        {DOC_NAV.map((section) => (
          <div key={section.folder}>
            <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {section.title}
            </p>
            {section.articles.map((article) => {
              const href = `/dashboard/docs/${section.folder}/${article.slug}`
              const active = pathname === href
              return (
                <Link
                  key={article.slug}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-fg)] font-medium'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  )}
                >
                  {active && <ChevronRight size={12} className="shrink-0" />}
                  {article.title}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
