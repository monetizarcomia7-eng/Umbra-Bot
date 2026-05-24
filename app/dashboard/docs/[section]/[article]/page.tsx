import { notFound } from 'next/navigation'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { marked } from 'marked'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { DOC_NAV } from '../../_nav'
import { DocPager } from '../../DocPager'

interface Props {
  params: Promise<{ section: string; article: string }>
}

function stripFrontmatter(content: string): { title: string; description: string; body: string } {
  let title = ''
  let description = ''
  let body = content

  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3)
    if (end !== -1) {
      const front = content.slice(3, end)
      const titleMatch = front.match(/^title:\s*["']?(.+?)["']?\s*$/m)
      const descMatch  = front.match(/^description:\s*["']?(.+?)["']?\s*$/m)
      if (titleMatch) title = titleMatch[1]
      if (descMatch)  description = descMatch[1]
      body = content.slice(end + 3).trimStart()
    }
  }
  return { title, description, body }
}

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

function processHtml(html: string): string {
  return html
    // TL;DR paragraph → styled callout
    .replace(
      /<p><strong>TL;DR:<\/strong>([\s\S]*?)<\/p>/g,
      '<div class="tldr-box"><strong>TL;DR</strong><span>$1</span></div>'
    )
    // screenshot comments → visual placeholder
    .replace(
      /<!--\s*screenshot:\s*([\s\S]*?)\s*-->/g,
      '<div class="screenshot-ph"><span class="screenshot-label">📸 $1</span></div>'
    )
    // generic screenshot comment (no label)
    .replace(
      /<!--\s*screenshot\s*-->/g,
      '<div class="screenshot-ph"><span class="screenshot-label">📸 Imagem ilustrativa</span></div>'
    )
    // TODO comments → remove from user-facing pages
    .replace(/<!--\s*TODO:[\s\S]*?-->/g, '')
    // Blockquotes starting with Dica/Atenção/Nota/Importante → colored
    .replace(
      /<blockquote>\s*<p><strong>Dica:<\/strong>/g,
      '<blockquote class="bq-tip"><p><strong>Dica:</strong>'
    )
    .replace(
      /<blockquote>\s*<p><strong>Atenção:<\/strong>/g,
      '<blockquote class="bq-warn"><p><strong>Atenção:</strong>'
    )
    .replace(
      /<blockquote>\s*<p><strong>Nota:<\/strong>/g,
      '<blockquote class="bq-note"><p><strong>Nota:</strong>'
    )
    .replace(
      /<blockquote>\s*<p><strong>Importante:<\/strong>/g,
      '<blockquote class="bq-warn"><p><strong>Importante:</strong>'
    )
}

export async function generateStaticParams() {
  return DOC_NAV.flatMap((s) => s.articles.map((a) => ({ section: s.folder, article: a.slug })))
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
  const { title, description, body } = stripFrontmatter(raw)
  const readTime = estimateReadTime(body)
  const html = processHtml(await marked(body, { gfm: true, breaks: false }))

  // Prev / Next
  const allArticles = DOC_NAV.flatMap((s) =>
    s.articles.map((a) => ({ href: `/dashboard/docs/${s.folder}/${a.slug}`, title: a.title }))
  )
  const idx  = allArticles.findIndex((a) => a.href === `/dashboard/docs/${section}/${article}`)
  const prev = idx > 0 ? allArticles[idx - 1] : null
  const next = idx < allArticles.length - 1 ? allArticles[idx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] mb-6">
        <Link href="/dashboard/docs" className="hover:text-[var(--foreground)] transition-colors">
          Documentação
        </Link>
        <ChevronRight size={12} className="opacity-40" />
        <span className="text-[var(--foreground)]">{sec.title}</span>
        <ChevronRight size={12} className="opacity-40" />
        <span className="text-[var(--foreground)] font-medium">{art.title}</span>
      </nav>

      {/* Hero */}
      <div className="mb-8 pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--primary)] font-medium">
            {sec.title}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">· {readTime} min de leitura</span>
        </div>
        {title && (
          <h1 className="text-2xl font-bold text-[var(--foreground)] leading-tight mt-1">{title}</h1>
        )}
        {description && (
          <p className="mt-2 text-[var(--muted-foreground)] text-sm leading-relaxed">{description}</p>
        )}
      </div>

      {/* Article body */}
      <div
        className="
          [&_h1]:hidden
          [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-[var(--foreground)]
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-[var(--border)]
          [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-[var(--foreground)]
            [&_h3]:mt-7 [&_h3]:mb-2
          [&_h4]:text-[14px] [&_h4]:font-semibold [&_h4]:text-[var(--foreground)]
            [&_h4]:mt-5 [&_h4]:mb-1.5
          [&_p]:text-[14.5px] [&_p]:text-[var(--muted-foreground)] [&_p]:leading-[1.75] [&_p]:mb-4
          [&_strong]:text-[var(--foreground)] [&_strong]:font-semibold
          [&_a]:text-[var(--primary)] [&_a]:font-medium [&_a]:no-underline
            hover:[&_a]:underline
          [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:pl-5
          [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:pl-5
          [&_li]:text-[14.5px] [&_li]:text-[var(--muted-foreground)] [&_li]:leading-relaxed
          [&_ul>li]:list-disc [&_ol>li]:list-decimal
          [&_li>ul]:mt-1.5 [&_li>ul]:mb-0
          [&_li_input[type=checkbox]]:mr-2 [&_li_input[type=checkbox]]:accent-[var(--primary)]
          [&_code]:bg-[var(--surface-2)] [&_code]:text-[var(--foreground)] [&_code]:font-mono
            [&_code]:text-[12.5px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md
            [&_code]:border [&_code]:border-[var(--border)]
          [&_pre]:bg-[var(--surface-2)] [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--border)]
            [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-5
            [&_pre>code]:bg-transparent [&_pre>code]:border-none [&_pre>code]:p-0
            [&_pre>code]:text-[13px]
          [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--primary)]
            [&_blockquote]:bg-[var(--accent-soft)] [&_blockquote]:rounded-r-xl
            [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:my-5 [&_blockquote]:not-italic
          [&_blockquote_p]:mb-0 [&_blockquote_p]:text-[var(--foreground)]
          [&_blockquote.bq-warn]:border-amber-500 [&_blockquote.bq-warn]:bg-amber-500/10
          [&_blockquote.bq-tip]:border-emerald-500 [&_blockquote.bq-tip]:bg-emerald-500/10
          [&_blockquote.bq-note]:border-sky-500 [&_blockquote.bq-note]:bg-sky-500/10
          [&_table]:w-full [&_table]:text-[13.5px] [&_table]:mb-5 [&_table]:border-collapse
          [&_thead]:bg-[var(--surface-2)]
          [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--foreground)]
            [&_th]:px-3 [&_th]:py-2.5 [&_th]:border [&_th]:border-[var(--border)]
          [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-[var(--border)]
            [&_td]:text-[var(--muted-foreground)]
          [&_tr:nth-child(even)_td]:bg-[var(--surface-2)]/40
          [&_hr]:my-8 [&_hr]:border-[var(--border)]
          [&_img]:rounded-xl [&_img]:border [&_img]:border-[var(--border)] [&_img]:my-4 [&_img]:w-full
          [&_.tldr-box]:flex [&_.tldr-box]:gap-3 [&_.tldr-box]:items-start
            [&_.tldr-box]:bg-[var(--accent-soft)] [&_.tldr-box]:border [&_.tldr-box]:border-[var(--primary)]/30
            [&_.tldr-box]:rounded-xl [&_.tldr-box]:px-4 [&_.tldr-box]:py-3 [&_.tldr-box]:mb-6 [&_.tldr-box]:mt-0
          [&_.tldr-box_strong]:text-[var(--primary)] [&_.tldr-box_strong]:text-xs [&_.tldr-box_strong]:font-bold
            [&_.tldr-box_strong]:uppercase [&_.tldr-box_strong]:tracking-wider [&_.tldr-box_strong]:shrink-0
            [&_.tldr-box_strong]:mt-0.5
          [&_.tldr-box_span]:text-[var(--foreground)] [&_.tldr-box_span]:text-[14px] [&_.tldr-box_span]:leading-relaxed
          [&_.screenshot-ph]:rounded-xl [&_.screenshot-ph]:border-2 [&_.screenshot-ph]:border-dashed
            [&_.screenshot-ph]:border-[var(--border)] [&_.screenshot-ph]:bg-[var(--surface-2)]/50
            [&_.screenshot-ph]:flex [&_.screenshot-ph]:items-center [&_.screenshot-ph]:justify-center
            [&_.screenshot-ph]:h-36 [&_.screenshot-ph]:my-5
          [&_.screenshot-label]:text-xs [&_.screenshot-label]:text-[var(--muted-foreground)]
            [&_.screenshot-label]:font-medium
        "
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <DocPager prev={prev} next={next} />
    </div>
  )
}
