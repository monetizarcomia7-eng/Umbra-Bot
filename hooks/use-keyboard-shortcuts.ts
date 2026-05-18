'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ShortcutOptions {
  /** Selector of the search input to focus on Cmd/Ctrl+K */
  searchSelector?: string
}

export function useKeyboardShortcuts(options: ShortcutOptions = {}) {
  const router = useRouter()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      const tag = (e.target as HTMLElement).tagName

      // Don't fire shortcuts when typing in inputs
      if (!mod && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return

      // Cmd/Ctrl + K — focus search
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const el = document.querySelector<HTMLInputElement>(
          options.searchSelector ?? 'input[type="search"]',
        )
        el?.focus()
        return
      }

      // Navigation shortcuts (no modifier, not in input)
      if (!mod && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        switch (e.key.toLowerCase()) {
          case 'g':
            // next keypress determines destination (vi-style prefix)
            break
          case 'b':
            router.push('/dashboard/bots')
            break
          case 'f':
            router.push('/dashboard/finance')
            break
          case 'c':
            router.push('/dashboard/customers')
            break
          case 'a':
            router.push('/dashboard/activity')
            break
          case '?':
            router.push('/dashboard/guide')
            break
        }
      }

      // Escape — close modals / panels (native browser handles most cases)
      if (e.key === 'Escape') {
        const closeBtn = document.querySelector<HTMLButtonElement>('[data-close-panel]')
        closeBtn?.click()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, options.searchSelector])
}
