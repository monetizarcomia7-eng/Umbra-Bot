'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PagerItem { href: string; title: string }
interface Props { prev: PagerItem | null; next: PagerItem | null }

export function DocPager({ prev, next }: Props) {
  if (!prev && !next) return null

  return (
    <div className="mt-14 pt-6 border-t border-[var(--border)] flex items-stretch gap-3">
      {prev ? (
        <Link
          href={prev.href}
          className="flex-1 flex items-center gap-3 rounded-xl border border-[var(--border)]
            bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--accent-fg)]/40
            px-4 py-3 transition-all duration-150 group"
        >
          <ChevronLeft
            size={16}
            className="shrink-0 text-[var(--muted-foreground)] group-hover:-translate-x-0.5 transition-transform"
          />
          <span>
            <span className="block text-[11px] text-[var(--muted-foreground)] mb-0.5 uppercase tracking-wide font-medium">
              Anterior
            </span>
            <span className="text-[13.5px] font-semibold text-[var(--foreground)] leading-snug">
              {prev.title}
            </span>
          </span>
        </Link>
      ) : <div className="flex-1" />}

      {next ? (
        <Link
          href={next.href}
          className="flex-1 flex items-center justify-end gap-3 rounded-xl border border-[var(--border)]
            bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--accent-fg)]/40
            px-4 py-3 transition-all duration-150 group text-right"
        >
          <span>
            <span className="block text-[11px] text-[var(--muted-foreground)] mb-0.5 uppercase tracking-wide font-medium">
              Próximo
            </span>
            <span className="text-[13.5px] font-semibold text-[var(--foreground)] leading-snug">
              {next.title}
            </span>
          </span>
          <ChevronRight
            size={16}
            className="shrink-0 text-[var(--muted-foreground)] group-hover:translate-x-0.5 transition-transform"
          />
        </Link>
      ) : <div className="flex-1" />}
    </div>
  )
}
