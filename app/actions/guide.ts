'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { marked, Renderer } from 'marked'
import * as Sentry from '@sentry/nextjs'

export interface TocItem { id: string; label: string }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
}

function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = []
  const regex = /^## (.+)$/gm
  let match
  while ((match = regex.exec(markdown)) !== null) {
    const label = match[1].trim()
    items.push({ id: slugify(label), label })
  }
  return items
}

function buildRenderer(): Renderer {
  const renderer = new Renderer()
  const origHeading = renderer.heading.bind(renderer)
  renderer.heading = function (token) {
    const { depth, text } = token as { depth: number; text: string }
    if (depth === 2) {
      return `<h2 id="${slugify(text)}">${text}</h2>\n`
    }
    return origHeading(token)
  }
  return renderer
}

export async function getArticleBodyAction(articleId: string): Promise<{
  bodyHtml: string | null
  toc: TocItem[]
  helpfulYes: number
  helpfulNo: number
  views: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { bodyHtml: null, toc: [], helpfulYes: 0, helpfulNo: 0, views: 0, error: 'Não autenticado.' }

  const { data, error } = await supabase
    .from('guide_articles')
    .select('body, helpful_yes, helpful_no, views')
    .eq('id', articleId)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !data) {
    return { bodyHtml: null, toc: [], helpfulYes: 0, helpfulNo: 0, views: 0, error: 'Artigo não encontrado.' }
  }

  const body = (data.body as string | null) ?? ''

  // Increment views fire-and-forget
  void supabase.rpc('increment_article_views', { p_article_id: articleId }).then(({ error }) => {
    if (error) Sentry.captureException(error, { extra: { articleId, context: 'increment_article_views' } })
  })

  const toc = extractToc(body)
  const renderer = buildRenderer()
  const bodyHtml = marked.parse(body, { renderer }) as string

  return {
    bodyHtml,
    toc,
    helpfulYes: (data.helpful_yes as number) ?? 0,
    helpfulNo: (data.helpful_no as number) ?? 0,
    views: ((data.views as number) ?? 0) + 1, // optimistic +1 before DB propagates
  }
}

export async function voteArticleAction(
  articleId: string,
  helpful: boolean,
): Promise<{ ok: boolean; helpfulYes: number; helpfulNo: number; userVote: boolean | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, helpfulYes: 0, helpfulNo: 0, userVote: null, error: 'Não autenticado.' }

  const rl = await rateLimit(`guide_vote:${user.id}`, 10, 60_000)
  if (!rl.ok) return { ok: false, helpfulYes: 0, helpfulNo: 0, userVote: null, error: 'Muitas tentativas.' }

  const { error: voteError } = await supabase.rpc('vote_article', { p_article_id: articleId, p_helpful: helpful })

  if (voteError) {
    Sentry.captureException(voteError, { extra: { articleId, helpful, context: 'vote_article' } })
    return { ok: false, helpfulYes: 0, helpfulNo: 0, userVote: null, error: 'Erro ao registrar voto.' }
  }

  const [countsRes, voteRes] = await Promise.all([
    supabase.from('guide_articles').select('helpful_yes, helpful_no').eq('id', articleId).maybeSingle(),
    supabase.rpc('get_article_vote', { p_article_id: articleId }),
  ])

  return {
    ok: true,
    helpfulYes: (countsRes.data?.helpful_yes as number) ?? 0,
    helpfulNo: (countsRes.data?.helpful_no as number) ?? 0,
    userVote: typeof voteRes.data === 'boolean' ? voteRes.data : null,
  }
}

export async function getUserVoteAction(articleId: string): Promise<boolean | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.rpc('get_article_vote', { p_article_id: articleId })
  return typeof data === 'boolean' ? data : null
}

export async function logGuideSearchAction(query: string, resultsCount: number): Promise<void> {
  if (!query.trim() || query.trim().length < 2) return
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('guide_search_logs').insert({
      user_id: user.id,
      query:   query.trim().slice(0, 200),
      results_count: resultsCount,
    })
  } catch { /* silent */ }
}
