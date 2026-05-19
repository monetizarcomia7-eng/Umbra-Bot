'use client'

import React from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { DashboardProvider } from '@/providers/DashboardProvider'

function LayoutShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar onMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <LayoutShell>{children}</LayoutShell>
    </DashboardProvider>
  )
}
