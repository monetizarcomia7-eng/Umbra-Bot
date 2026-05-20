'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PagerItem {
  href: string
  title: string
}

interface Props {
  prev: PagerItem | null
  next: PagerItem | null
}

export function DocPager({ prev, next }: Props) {
  if (!prev && !next) return null

  return (
    <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between gap-4">
      {prev ? (
        <Link
          href={prev.href}
          className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors group"
        >
          <ChevronLeft size={16} className="shrink-0 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-left">
            <span className="block text-xs text-[var(--muted-foreground)] mb-0.5">Anterior</span>
            <span className="font-medium text-[var(--foreground)]">{prev.title}</span>
          </span>
        </Link>
      ) : <div />}

      {next ? (
        <Link
          href={next.href}
          className="flex items-center gap-2 text-sm text-right text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors group ml-auto"
        >
          <span className="text-right">
            <span className="block text-xs text-[var(--muted-foreground)] mb-0.5">Próximo</span>
            <span className="font-medium text-[var(--foreground)]">{next.title}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      ) : <div />}
    </div>
  )
}
