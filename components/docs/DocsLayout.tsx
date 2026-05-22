'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Menu, X, ChevronDown, ChevronRight, ArrowUp } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

export interface DocsTocItem    { id: string; label: string }
export interface DocsArticleMeta { slug: string; title: string }
export interface DocsCategoryMeta {
  slug:        string
  title:       string
  icon:        string
  articles:    DocsArticleMeta[]
}

interface DocsLayoutProps {
  categories:  DocsCategoryMeta[]
  breadcrumb?: { label: string; href?: string }[]
  toc?:        DocsTocItem[]
  children:    React.ReactNode
}

export function DocsLayout({ categories, breadcrumb, toc, children }: DocsLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch]           = useState('')
  const [openCats, setOpenCats]       = useState<Record<string, boolean>>({})
  const [activeId, setActiveId]       = useState('')
  const [showTop, setShowTop]         = useState(false)

  useEffect(() => {
    if (!toc?.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-56px 0px -60% 0px', threshold: 0 },
    )
    document.querySelectorAll('[data-toc-section]').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [toc, pathname])

  useEffect(() => {
    const h = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean)
    if (parts[0] === 'docs' && parts[1]) {
      setOpenCats((p) => ({ ...p, [parts[1]]: true }))
    }
  }, [pathname])

  const filtered = search.trim()
    ? categories
        .map((cat) => ({
          ...cat,
          articles: cat.articles.filter((a) =>
            a.title.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((cat) => cat.articles.length > 0)
    : categories

  function SidebarNav() {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar artigo…"
              className="w-full pl-8 pr-8 py-2 text-[13px] bg-surface-2 border border-border rounded-lg text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-hide">
          <Link
            href="/docs"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12.5px] transition-colors',
              pathname === '/docs'
                ? 'bg-primary-soft text-primary font-semibold'
                : 'text-text-muted hover:text-text hover:bg-surface-2',
            )}
          >
            ← Início
          </Link>

          <div className="h-px bg-border my-2" />

          {filtered.map((cat) => {
            const isActive = pathname.startsWith(`/docs/${cat.slug}`)
            const isOpen   = search.trim() ? true : (openCats[cat.slug] ?? isActive)
            return (
              <div key={cat.slug}>
                <button
                  onClick={() => setOpenCats((p) => ({ ...p, [cat.slug]: !isOpen }))}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded text-[10.5px] font-bold uppercase tracking-[0.08em] transition-colors',
                    isActive ? 'text-primary' : 'text-text-subtle hover:text-text-muted',
                  )}
                >
                  <span>{cat.icon} {cat.title}</span>
                  {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
                {isOpen && (
                  <div className="ml-2 space-y-0.5 mb-1">
                    {cat.articles.map((art) => {
                      const href   = `/docs/${cat.slug}/${art.slug}`
                      const active = pathname === href
                      return (
                        <Link
                          key={art.slug}
                          href={href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'block px-2.5 py-1.5 rounded-lg text-[12.5px] leading-snug transition-colors',
                            active
                              ? 'bg-primary-soft text-primary font-semibold'
                              : 'text-text-muted hover:text-text hover:bg-surface-2',
                          )}
                        >
                          {art.title}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg,white)] text-text" style={{ colorScheme: 'light dark' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-[1340px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
            >
              <Menu size={18} />
            </button>
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden>
                <rect width="32" height="32" rx="9" fill="var(--primary)" />
                <path d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z" fill="white" />
              </svg>
              <span className="font-semibold text-[14px] text-text leading-none">
                Umbra<span className="text-text-muted font-normal"> Docs</span>
              </span>
            </Link>
          </div>

          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-text-muted">
            <Link href="/docs"      className="text-primary font-medium">Documentação</Link>
            <Link href="/status"    className="hover:text-text transition-colors">Status</Link>
            <Link href="/changelog" className="hover:text-text transition-colors">Changelog</Link>
            <Link href="/roadmap"   className="hover:text-text transition-colors">Roadmap</Link>
          </nav>

          <ThemeToggle />
        </div>
      </header>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[280px] bg-surface h-full flex flex-col border-r border-border">
            <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
              <span className="font-semibold text-[14px] text-text">Documentação</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
              >
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line react-hooks/static-components */}
            <SidebarNav />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-[1340px] mx-auto flex min-h-[calc(100vh-56px)]">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-[240px] xl:w-[260px] shrink-0 sticky top-[56px] self-start max-h-[calc(100vh-56px)] border-r border-border">
          {/* eslint-disable-next-line react-hooks/static-components */}
          <SidebarNav />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-5 md:px-8 xl:px-12 py-8 md:py-10">

          {/* Breadcrumb */}
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 text-[12.5px] text-text-muted mb-6 flex-wrap">
              <Link href="/docs" className="hover:text-text transition-colors">Docs</Link>
              {breadcrumb.map((crumb, i) => (
                <React.Fragment key={i}>
                  <span className="text-text-subtle">/</span>
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-text transition-colors">{crumb.label}</Link>
                  ) : (
                    <span className="text-text font-medium">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {children}
        </main>

        {/* Right TOC */}
        {toc && toc.length > 0 && (
          <aside className="hidden xl:flex flex-col w-[200px] shrink-0 sticky top-[56px] self-start max-h-[calc(100vh-56px)] overflow-y-auto py-10 pl-4 border-l border-border">
            <p className="text-[10px] uppercase tracking-widest font-bold text-text-subtle mb-3 px-1">
              Nesta página
            </p>
            <nav className="space-y-0.5">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={cn(
                    'block text-[12px] py-1 px-2 rounded transition-colors leading-snug',
                    activeId === item.id
                      ? 'bg-primary-soft text-primary font-semibold'
                      : 'text-text-muted hover:text-text hover:bg-surface-2',
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>

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
