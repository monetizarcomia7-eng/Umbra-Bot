'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ArrowUp } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export interface TocItem {
  id: string
  label: string
}

interface LegalLayoutProps {
  title: string
  badge?: string
  lastUpdated: string
  toc: TocItem[]
  children: React.ReactNode
}

export function LegalLayout({ title, badge, lastUpdated, toc, children }: LegalLayoutProps) {
  const [activeId, setActiveId]   = useState('')
  const [tocOpen, setTocOpen]     = useState(false)
  const [showTop, setShowTop]     = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-56px 0px -60% 0px', threshold: 0 },
    )
    document.querySelectorAll('section[id]').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const h = () => setShowTop(window.scrollY > 500)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg,white)] text-text" style={{ colorScheme: 'light dark' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-[1160px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
            <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
              <rect width="32" height="32" rx="9" fill="var(--primary)" />
              <path d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z" fill="white" />
            </svg>
            <span className="font-semibold text-[14px] text-text leading-none">
              Umbra<span className="text-text-muted font-normal"> Bot</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-text-muted">
            <Link href="/termos"      className="hover:text-text transition-colors">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-text transition-colors">Privacidade</Link>
            <Link href="/contato"     className="hover:text-text transition-colors">Contato</Link>
          </nav>

          <ThemeToggle />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="max-w-[1160px] mx-auto px-4 md:px-8 py-10 md:py-14">

        {/* Page header */}
        <div className="mb-10 pb-8 border-b border-border">
          {badge && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary-soft text-primary text-[10.5px] font-bold uppercase tracking-widest mb-4">
              {badge}
            </span>
          )}
          <h1 className="text-[28px] md:text-[34px] font-semibold text-text leading-tight">{title}</h1>
          <p className="mt-2 text-[13px] text-text-muted">
            Última atualização: <strong className="text-text">{lastUpdated}</strong>
          </p>
          <div className="mt-4 flex items-start gap-2.5 bg-warning-soft/30 border border-warning/25 rounded-xl px-4 py-3 text-[13px] text-text max-w-2xl leading-relaxed">
            <span className="text-warning shrink-0 text-[15px] mt-px">⚠</span>
            <span>
              <strong>Rascunho modelo:</strong> Este documento não constitui assessoria jurídica.{' '}
              <strong>Consulte um advogado qualificado antes de publicar.</strong>
            </span>
          </div>
        </div>

        <div className="flex gap-10 xl:gap-14 items-start">

          {/* TOC Desktop */}
          <aside className="hidden lg:flex flex-col w-[200px] xl:w-[220px] shrink-0 sticky top-[72px] max-h-[calc(100vh-100px)] overflow-y-auto pb-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-text-subtle mb-3 px-1">Índice</p>
            <nav className="space-y-0.5">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`block text-[12.5px] py-1.5 px-2.5 rounded-lg transition-colors leading-snug ${
                    activeId === item.id
                      ? 'bg-primary-soft text-primary font-semibold'
                      : 'text-text-muted hover:text-text hover:bg-surface-2'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0">
            {/* TOC Mobile */}
            <div className="lg:hidden mb-8 border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setTocOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-surface-2 text-[13px] font-semibold text-text"
              >
                <span>Índice / Sumário</span>
                {tocOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {tocOpen && (
                <div className="px-4 py-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setTocOpen(false)}
                      className="text-[13px] py-1.5 text-primary hover:underline leading-snug"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {children}
          </main>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-surface mt-16">
        <div className="max-w-[1160px] mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row gap-4 items-center justify-between text-[12.5px] text-text-muted">
          <span>© {new Date().getFullYear()} [RAZÃO SOCIAL] — CNPJ [CNPJ]. Todos os direitos reservados.</span>
          <div className="flex gap-5">
            <Link href="/termos"      className="hover:text-text transition-colors">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-text transition-colors">Privacidade</Link>
            <Link href="/contato"     className="hover:text-text transition-colors">Contato</Link>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Voltar ao topo"
          className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-primary text-primary-fg flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-50"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </div>
  )
}
