'use client'

import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DocsLayout } from '@/components/docs/DocsLayout'
import { DOCS_CATEGORIES, findArticle, toMeta } from '@/lib/docs/content'

const META = toMeta(DOCS_CATEGORIES)

export default function ArticlePage({
  params,
}: {
  params: Promise<{ category: string; article: string }>
}) {
  const { category, article } = React.use(params)
  const found = findArticle(category, article)
  if (!found) notFound()
  const { cat, art } = found

  /* ── prev/next within category ── */
  const artIdx  = cat.articles.findIndex((a) => a.slug === art.slug)
  const prev    = cat.articles[artIdx - 1] ?? null
  const next    = cat.articles[artIdx + 1] ?? null

  const { Content } = art

  return (
    <DocsLayout
      categories={META}
      breadcrumb={[
        { label: cat.title, href: `/docs/${cat.slug}` },
        { label: art.title },
      ]}
      toc={art.toc}
    >
      {/* Article header */}
      <div className="mb-8 pb-6 border-b border-border">
        <h1 className="text-[24px] md:text-[28px] font-semibold text-text leading-tight mb-2">
          {art.title}
        </h1>
        <p className="text-[14px] text-text-muted">{art.description}</p>
      </div>

      {/* Article body */}
      <article className="prose-none">
        <Content />
      </article>

      {/* Prev / Next navigation */}
      <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row gap-3">
        {prev ? (
          <Link
            href={`/docs/${cat.slug}/${prev.slug}`}
            className="flex-1 flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary-soft/10 transition-colors group"
          >
            <ChevronLeft size={18} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
            <div>
              <div className="text-[11px] text-text-subtle uppercase tracking-wider mb-0.5">Anterior</div>
              <div className="text-[13.5px] font-medium text-text group-hover:text-primary transition-colors">
                {prev.title}
              </div>
            </div>
          </Link>
        ) : <div className="flex-1" />}

        {next ? (
          <Link
            href={`/docs/${cat.slug}/${next.slug}`}
            className="flex-1 flex items-center justify-end gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary-soft/10 transition-colors group text-right"
          >
            <div>
              <div className="text-[11px] text-text-subtle uppercase tracking-wider mb-0.5">Próximo</div>
              <div className="text-[13.5px] font-medium text-text group-hover:text-primary transition-colors">
                {next.title}
              </div>
            </div>
            <ChevronRight size={18} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
          </Link>
        ) : <div className="flex-1" />}
      </div>

      {/* Edit on GitHub hint */}
      <p className="mt-6 text-center text-[12px] text-text-subtle">
        Encontrou um erro?{' '}
        <Link href="/contato" className="text-primary hover:underline">
          Fale conosco
        </Link>{' '}
        ou abra uma issue no repositório.
      </p>
    </DocsLayout>
  )
}
