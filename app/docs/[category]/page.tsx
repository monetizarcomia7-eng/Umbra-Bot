'use client'

import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DocsLayout } from '@/components/docs/DocsLayout'
import { DOCS_CATEGORIES, toMeta } from '@/lib/docs/content'

const META = toMeta(DOCS_CATEGORIES)

export default function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = React.use(params)
  const cat = DOCS_CATEGORIES.find((c) => c.slug === category)
  if (!cat) notFound()

  return (
    <DocsLayout
      categories={META}
      breadcrumb={[{ label: cat.title }]}
    >
      <div className="mb-8">
        <div className="text-3xl mb-2">{cat.icon}</div>
        <h1 className="text-[26px] font-semibold text-text mb-2">{cat.title}</h1>
        <p className="text-[14px] text-text-muted leading-relaxed">{cat.description}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {cat.articles.map((art) => (
          <Link
            key={art.slug}
            href={`/docs/${cat.slug}/${art.slug}`}
            className="group rounded-xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary-soft/10 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[13.5px] font-semibold text-text group-hover:text-primary transition-colors">
                {art.title}
              </span>
              <ArrowRight size={14} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
            </div>
            <p className="text-[12.5px] text-text-muted leading-[1.6]">{art.description}</p>
          </Link>
        ))}
      </div>
    </DocsLayout>
  )
}
