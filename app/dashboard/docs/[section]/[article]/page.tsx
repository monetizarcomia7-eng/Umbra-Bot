import { notFound } from 'next/navigation'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { marked } from 'marked'
import { DOC_NAV } from '../../_nav'
import { DocPager } from '../../DocPager'

interface Props {
  params: Promise<{ section: string; article: string }>
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const end = content.indexOf('---', 3)
  if (end === -1) return content
  return content.slice(end + 3).trimStart()
}

export async function generateStaticParams() {
  const params: { section: string; article: string }[] = []
  for (const section of DOC_NAV) {
    for (const article of section.articles) {
      params.push({ section: section.folder, article: article.slug })
    }
  }
  return params
}

export default async function DocArticlePage({ params }: Props) {
  const { section, article } = await params

  const sec = DOC_NAV.find((s) => s.folder === section)
  if (!sec) notFound()
  const art = sec.articles.find((a) => a.slug === article)
  if (!art) notFound()

  const filePath = path.join(process.cwd(), 'docs', section, `${article}.md`)
  if (!existsSync(filePath)) notFound()

  const raw = readFileSync(filePath, 'utf-8')
  const markdown = stripFrontmatter(raw)
  const html = await marked(markdown, { gfm: true, breaks: false })

  // Build prev/next for pager
  const allArticles: { href: string; title: string }[] = []
  for (const s of DOC_NAV) {
    for (const a of s.articles) {
      allArticles.push({ href: `/dashboard/docs/${s.folder}/${a.slug}`, title: a.title })
    }
  }
  const currentIdx = allArticles.findIndex((a) => a.href === `/dashboard/docs/${section}/${article}`)
  const prev = currentIdx > 0 ? allArticles[currentIdx - 1] : null
  const next = currentIdx < allArticles.length - 1 ? allArticles[currentIdx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {/* Article content */}
      <div
        className="prose prose-neutral dark:prose-invert max-w-none
          prose-headings:font-semibold
          prose-h1:text-2xl prose-h1:mb-6
          prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
          prose-p:text-[var(--muted-foreground)] prose-p:leading-relaxed
          prose-strong:text-[var(--foreground)]
          prose-a:text-[var(--accent-fg)] prose-a:no-underline hover:prose-a:underline
          prose-code:bg-[var(--surface-2)] prose-code:text-[var(--foreground)]
          prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
          prose-pre:bg-[var(--surface-2)] prose-pre:border prose-pre:border-[var(--border)]
          prose-blockquote:border-l-[var(--accent-fg)] prose-blockquote:bg-[var(--accent-soft)]
          prose-blockquote:rounded-r-md prose-blockquote:py-0.5 prose-blockquote:not-italic
          prose-blockquote:text-[var(--foreground)]
          prose-table:text-sm
          prose-th:bg-[var(--surface-2)] prose-th:text-[var(--foreground)]
          prose-td:text-[var(--muted-foreground)]
          prose-hr:border-[var(--border)]
          prose-li:text-[var(--muted-foreground)]
          [&_img]:rounded-lg [&_img]:border [&_img]:border-[var(--border)]
          [&_.callout]:bg-[var(--accent-soft)] [&_.callout]:border [&_.callout]:border-[var(--accent-fg)]
          [&_.callout]:rounded-md [&_.callout]:p-4 [&_.callout]:my-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Comment placeholders: render screenshot callouts visually */}
      <DocPager prev={prev} next={next} />
    </div>
  )
}
