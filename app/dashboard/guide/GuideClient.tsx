'use client'

import { useState, useMemo, useEffect, useCallback, useRef, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  Rocket, Bot, GitBranch, CreditCard, Send, Globe,
  BookOpen, Search, ArrowUpRight, Info, AlertTriangle,
  ThumbsUp, ThumbsDown, MessageCircle, ChevronLeft,
  Minus, Plus, X, LifeBuoy, Mail, ExternalLink,
  Loader2, Clock, Eye,
} from 'lucide-react'
import type { RawGuideArticle, RawGuideFaq } from './page'
import type { TocItem } from '@/app/actions/guide'
import {
  getArticleBodyAction,
  voteArticleAction,
  getUserVoteAction,
  logGuideSearchAction,
} from '@/app/actions/guide'

/* ============================================================
   Types
   ============================================================ */

interface Category { id: string; name: string; icon: string; color: string; desc: string }
interface Article {
  id: string; slug: string | null; cat: string; icon: string; iconColor: string
  title: string; excerpt: string; readMin: number
  updatedAt: number; views: number; featured: boolean
  helpfulYes: number; helpfulNo: number; tags: string[]
}
interface FaqItem { id: string; q: string; a: string }

/* ============================================================
   Static category catalog
   ============================================================ */

const CATEGORIES: Category[] = [
  { id: 'getting_started', name: 'Primeiros passos', icon: 'rocket',       color: 'var(--primary)',          desc: 'Conheça o painel e configure sua primeira venda.' },
  { id: 'bots',            name: 'Bots',             icon: 'bot',          color: 'var(--success)',          desc: 'Conectar, configurar e diagnosticar bots do Telegram.' },
  { id: 'flows',           name: 'Fluxos',           icon: 'git-branch',   color: 'var(--warning)',          desc: 'Editor visual, gatilhos e boas práticas de fluxos.' },
  { id: 'payments',        name: 'Pagamentos',       icon: 'credit-card',  color: 'var(--danger)',           desc: 'Gateways, split, taxas e teste de cobrança PIX.' },
  { id: 'broadcasts',      name: 'Disparos',         icon: 'send',         color: 'oklch(0.62 0.18 280)',    desc: 'Listas, segmentos e limites de envio do Telegram.' },
  { id: 'integrations',    name: 'Integrações',      icon: 'webhook',      color: 'oklch(0.62 0.16 200)',    desc: 'Webhooks, pixels e ferramentas externas.' },
]

/* ============================================================
   Helpers
   ============================================================ */

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function mapArticle(r: RawGuideArticle): Article {
  return {
    id:         r.id,
    slug:       r.slug,
    cat:        r.category,
    icon:       r.icon,
    iconColor:  r.icon_color,
    title:      r.title,
    excerpt:    r.excerpt,
    readMin:    r.read_min,
    updatedAt:  new Date(r.updated_at).getTime(),
    views:      r.views,
    featured:   r.featured,
    helpfulYes: r.helpful_yes,
    helpfulNo:  r.helpful_no,
    tags:       r.tags ?? [],
  }
}

function mapFaq(r: RawGuideFaq): FaqItem {
  return { id: r.id, q: r.question, a: r.answer }
}

/* ============================================================
   Icon map
   ============================================================ */

const ICON_MAP: Record<string, React.ElementType> = {
  rocket: Rocket, bot: Bot, 'git-branch': GitBranch,
  'credit-card': CreditCard, send: Send, webhook: Globe,
  'book-open': BookOpen, search: Search, 'arrow-up-right': ArrowUpRight,
  info: Info, 'alert-triangle': AlertTriangle,
  'thumbs-up': ThumbsUp, 'thumbs-down': ThumbsDown,
  'message-circle': MessageCircle, 'chevron-left': ChevronLeft,
  minus: Minus, plus: Plus, x: X,
  'life-buoy': LifeBuoy, mail: Mail, 'external-link': ExternalLink,
  globe: Globe,
}
function DynIcon({ name, size = 14, className }: { name?: string; size?: number; className?: string }) {
  const Comp = ICON_MAP[name ?? ''] ?? Globe
  return <Comp size={size} className={className} />
}

/* ============================================================
   Shared UI atoms
   ============================================================ */

function Btn({ variant = 'secondary', size = 'sm', icon, onClick, href, children, className, disabled }: {
  variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md'
  icon?: React.ReactNode; onClick?: () => void; href?: string
  children?: React.ReactNode; className?: string; disabled?: boolean
}) {
  const sz = size === 'md' ? 'h-9 px-4 text-[12.5px]' : 'h-8 px-3 text-[12px]'
  const v  = variant === 'primary'
    ? 'bg-primary text-white hover:opacity-90'
    : variant === 'ghost'
    ? 'text-text-muted hover:bg-surface-2 hover:text-text'
    : 'bg-surface-2 text-text border border-border hover:bg-surface-3'
  const cls = `inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none ${sz} ${v} ${className ?? ''} ${disabled ? 'opacity-50 pointer-events-none' : ''}`

  if (href) return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {icon}{children}
    </a>
  )
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {icon}{children}
    </button>
  )
}

function Card({ title, subtitle, children, noPadding = false }: {
  title?: string; subtitle?: string; children: React.ReactNode; noPadding?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {title && (
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[13.5px] font-semibold text-text">{title}</div>
          {subtitle && <div className="text-[11.5px] text-text-muted mt-0.5">{subtitle}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'px-5 py-4'}>{children}</div>
    </div>
  )
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  const cls: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success-soft text-success border-success/20',
    warning: 'bg-warning-soft text-warning border-warning/20',
    muted:   'bg-surface-2 text-text-muted border-border',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${cls[tone] ?? cls.muted}`}>
      {children}
    </span>
  )
}

/* ============================================================
   HeroSearch
   ============================================================ */

function HeroSearch({ search, onSearch }: { search: string; onSearch: (s: string) => void }) {
  const SUGGESTIONS = ['conectar bot', 'split de pagamento', 'webhook 502', 'limite Telegram']
  return (
    <div className="bg-gradient-to-br from-primary/5 via-surface to-surface border border-border rounded-2xl px-6 py-10 mb-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
      <div className="relative max-w-2xl mx-auto text-center">
        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mx-auto mb-3.5">
          <BookOpen size={20} />
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight text-text">Como podemos ajudar?</h2>
        <p className="text-[13.5px] text-text-muted mt-1.5">Documentação, tutoriais e respostas para o time do Umbra Bot.</p>
        <div className="relative mt-5 max-w-lg mx-auto">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text" value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Buscar por palavra-chave, módulo ou erro…"
            className="w-full h-12 pl-11 pr-4 bg-surface border border-border rounded-xl text-[14px] placeholder:text-text-muted text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap text-[11.5px] text-text-muted">
          <span>Populares:</span>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => onSearch(s)}
              className="px-2 py-0.5 rounded bg-surface border border-border hover:border-primary hover:text-primary focus:outline-none">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   CategoryCard
   ============================================================ */

function CategoryCard({ cat, count, onClick }: { cat: Category; count: number; onClick: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: cat.color }}>
          <DynIcon name={cat.icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold text-text leading-snug">{cat.name}</h3>
          <p className="text-[11.5px] text-text-muted mt-1 leading-relaxed">{cat.desc}</p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11.5px]">
        <span className="text-text-muted">{count} {count === 1 ? 'artigo' : 'artigos'}</span>
        <span className="inline-flex items-center gap-1 text-text-muted group-hover:text-primary transition-colors">
          Ver categoria <ArrowUpRight size={11} />
        </span>
      </div>
    </div>
  )
}

/* ============================================================
   ArticleRow
   ============================================================ */

function ArticleRow({ article, onOpen }: { article: Article; onOpen: () => void }) {
  const cat = CATEGORIES.find(c => c.id === article.cat)
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group flex items-start gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors cursor-pointer focus:outline-none rounded-md -mx-1">
      <div className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0"
        style={{ background: article.iconColor }}>
        <DynIcon name={article.icon} size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[13px] font-semibold text-text leading-snug group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          {article.featured && <Badge tone="primary">Em destaque</Badge>}
        </div>
        <p className="text-[11.5px] text-text-muted mt-0.5 leading-snug max-w-2xl">{article.excerpt}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-text-muted">
          <span>{cat?.name}</span><span>·</span>
          <span>{article.readMin} min de leitura</span><span>·</span>
          <span className="inline-flex items-center gap-1"><Eye size={10} />{fmtNum(article.views)}</span>
        </div>
      </div>
      <ArrowUpRight size={12} className="text-text-muted group-hover:text-primary transition-colors mt-1 shrink-0" />
    </div>
  )
}

/* ============================================================
   FAQ Accordion
   ============================================================ */

function FAQ({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {items.map((f, i) => {
        const isOpen = open === f.id
        return (
          <div key={f.id} className={i === 0 ? '' : 'border-t border-border'}>
            <button onClick={() => setOpen(id => id === f.id ? null : f.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-2/50 focus:outline-none">
              <span className="text-[13.5px] font-medium text-text pr-2">{f.q}</span>
              {isOpen
                ? <Minus size={14} className="text-text-muted shrink-0" />
                : <Plus  size={14} className="text-text-muted shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-[12.5px] text-text-muted leading-relaxed max-w-3xl">{f.a}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   ArticleReader
   ============================================================ */

function ArticleReader({
  article, articles, onBack, onOpen,
}: {
  article: Article; articles: Article[]; onBack: () => void; onOpen: (a: Article) => void
}) {
  const { track } = useAnalytics()
  const cat = CATEGORIES.find(c => c.id === article.cat)
  const related = articles.filter(a => a.cat === article.cat && a.id !== article.id).slice(0, 4)

  const [bodyHtml, setBodyHtml]   = useState<string | null>(null)
  const [toc, setToc]             = useState<TocItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [views, setViews]         = useState(article.views)
  const [helpfulYes, setYes]      = useState(article.helpfulYes)
  const [helpfulNo, setNo]        = useState(article.helpfulNo)
  const [userVote, setUserVote]   = useState<boolean | null>(null)
  const [voting, startVoting]     = useTransition()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setBodyHtml(null)
    setToc([])

    Promise.all([
      getArticleBodyAction(article.id),
      getUserVoteAction(article.id),
    ]).then(([bodyRes, vote]) => {
      if (cancelled) return
      if (bodyRes.bodyHtml) {
        setBodyHtml(bodyRes.bodyHtml)
        setToc(bodyRes.toc)
        setViews(bodyRes.views)
        setYes(bodyRes.helpfulYes)
        setNo(bodyRes.helpfulNo)
      }
      setUserVote(vote)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [article.id])

  function handleVote(helpful: boolean) {
    startVoting(async () => {
      const result = await voteArticleAction(article.id, helpful)
      if (result.ok) {
        setYes(result.helpfulYes)
        setNo(result.helpfulNo)
        setUserVote(result.userVote)
        track('guide_article_helpful', { article_id: article.id, helpful })
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start max-w-[1100px]">
      <article className="min-w-0">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 h-8 px-2 text-[12px] text-text-muted hover:text-text rounded-md hover:bg-surface-2 focus:outline-none mb-4">
          <ChevronLeft size={13} /> Voltar à central
        </button>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge tone="primary"><DynIcon name={cat?.icon} size={10} /> {cat?.name}</Badge>
          <span className="text-[11px] text-text-muted inline-flex items-center gap-1.5">
            <Clock size={10} /> {article.readMin} min · atualizado {fmtDate(article.updatedAt)}
            {views > 0 && <><span>·</span><Eye size={10} /> {fmtNum(views)}</>}
          </span>
        </div>

        <h1 className="text-[26px] font-semibold tracking-tight text-text leading-tight">{article.title}</h1>
        <p className="text-[14px] text-text-muted mt-2 leading-relaxed">{article.excerpt}</p>

        {loading && (
          <div className="mt-8 flex items-center gap-2 text-[13px] text-text-muted">
            <Loader2 size={15} className="animate-spin" /> Carregando artigo…
          </div>
        )}

        {!loading && bodyHtml && (
          <div
            className="mt-7 prose prose-sm prose-neutral dark:prose-invert max-w-none
              [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-text [&_h2]:mt-7 [&_h2]:mb-1 [&_h2]:scroll-mt-20
              [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-text [&_h3]:mt-5 [&_h3]:mb-1
              [&_p]:text-[14px] [&_p]:text-text [&_p]:leading-relaxed
              [&_ul]:text-[14px] [&_ul]:text-text [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1
              [&_ol]:text-[14px] [&_ol]:text-text [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-1
              [&_strong]:font-semibold [&_strong]:text-text
              [&_code]:bg-surface-2 [&_code]:border [&_code]:border-border [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11.5px] [&_code]:font-mono
              [&_pre]:bg-surface-2 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto
              [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0
              [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:text-text-muted [&_blockquote]:italic
              [&_table]:w-full [&_table]:text-[13px] [&_table]:border-collapse
              [&_th]:text-left [&_th]:font-semibold [&_th]:text-text [&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:pr-4
              [&_td]:text-text-muted [&_td]:border-b [&_td]:border-border/50 [&_td]:py-2 [&_td]:pr-4
              [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
              [&_hr]:border-border [&_hr]:my-6"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}

        {!loading && !bodyHtml && (
          <div className="mt-8 p-5 bg-surface-2 border border-border rounded-xl text-[13px] text-text-muted">
            Conteúdo não disponível no momento. Tente novamente mais tarde.
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-border">
          <div className="text-[12px] text-text-muted mb-2.5">Este artigo foi útil?</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Btn
              variant={userVote === true ? 'primary' : 'secondary'}
              size="sm"
              icon={<ThumbsUp size={13} />}
              onClick={() => handleVote(true)}
              disabled={voting}
            >
              Sim, ajudou {helpfulYes > 0 && <span className="ml-1 opacity-70 text-[10px]">({helpfulYes})</span>}
            </Btn>
            <Btn
              variant={userVote === false ? 'primary' : 'secondary'}
              size="sm"
              icon={<ThumbsDown size={13} />}
              onClick={() => handleVote(false)}
              disabled={voting}
            >
              Não muito {helpfulNo > 0 && <span className="ml-1 opacity-70 text-[10px]">({helpfulNo})</span>}
            </Btn>
            <Btn
              variant="ghost" size="sm"
              icon={<MessageCircle size={13} />}
              href="mailto:suporte@umbra.bot?subject=Preciso%20de%20ajuda"
              className="ml-auto"
            >
              Falar com suporte
            </Btn>
          </div>
        </div>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-[80px]">
        {toc.length > 0 && (
          <Card title="Nesta página" subtitle="Sumário">
            <nav className="space-y-1 text-[12px]">
              {toc.map(s => (
                <a key={s.id} href={`#${s.id}`}
                  className="block px-2 py-1 rounded text-text-muted hover:text-text hover:bg-surface-2 focus:outline-none">
                  {s.label}
                </a>
              ))}
            </nav>
          </Card>
        )}

        <Card title="Artigos relacionados" subtitle={cat?.name}>
          <div className="-mx-1">
            {related.map(r => (
              <button key={r.id} onClick={() => onOpen(r)}
                className="w-full text-left px-2 py-2 rounded hover:bg-surface-2/60 focus:outline-none group">
                <div className="text-[12.5px] font-medium text-text group-hover:text-primary leading-snug">{r.title}</div>
                <div className="text-[10.5px] text-text-muted mt-0.5">{r.readMin} min · {fmtNum(r.views)} views</div>
              </button>
            ))}
            {related.length === 0 && (
              <div className="px-2 py-3 text-[12px] text-text-muted">Nenhum artigo relacionado.</div>
            )}
          </div>
        </Card>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-text mb-1.5">Precisa de mais ajuda?</div>
          <p className="text-[11.5px] text-text-muted mb-3 leading-relaxed">
            Nosso time responde em até <strong className="text-text">15 min</strong> em horário comercial.
          </p>
          <div className="flex flex-col gap-1.5">
            <Btn variant="primary" size="sm" icon={<MessageCircle size={13} />}
              href="mailto:suporte@umbra.bot?subject=Preciso%20de%20ajuda"
              className="justify-center">
              Abrir chat
            </Btn>
            <Btn variant="secondary" size="sm" icon={<Mail size={13} />}
              href="mailto:suporte@umbra.bot"
              className="justify-center">
              Enviar e-mail
            </Btn>
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ============================================================
   GuideClient (main)
   ============================================================ */

interface Props {
  initialArticles: RawGuideArticle[]
  initialFaqs: RawGuideFaq[]
}

export default function GuideClient({ initialArticles, initialFaqs }: Props) {
  const { track } = useAnalytics()
  const searchParams = useSearchParams()
  const router = useRouter()

  const articles = useMemo(() => initialArticles.map(mapArticle), [initialArticles])
  const faqs     = useMemo(() => initialFaqs.map(mapFaq), [initialFaqs])

  // ── URL-synced state ─────────────────────────────────────────
  const [search,   setSearchRaw] = useState(() => searchParams.get('q') ?? '')
  const [category, setCatRaw]    = useState<string | null>(() => searchParams.get('cat'))
  const [readingId, setReadingId] = useState<string | null>(() => searchParams.get('article'))

  const reading = useMemo(
    () => readingId ? articles.find(a => a.id === readingId) ?? null : null,
    [readingId, articles],
  )

  // Search log debounce ref
  const searchLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function updateUrl(patch: { q?: string | null; cat?: string | null; article?: string | null }) {
    const params = new URLSearchParams()
    const q   = patch.q       !== undefined ? patch.q       : search
    const cat = patch.cat     !== undefined ? patch.cat     : category
    const art = patch.article !== undefined ? patch.article : readingId
    if (q)   params.set('q',       q)
    if (cat) params.set('cat',     cat)
    if (art) params.set('article', art)
    router.replace(`/dashboard/guide${params.toString() ? `?${params}` : ''}`, { scroll: false })
  }

  function setSearch(val: string) {
    setSearchRaw(val)
    updateUrl({ q: val || null, article: null })

    // Debounced search log
    if (searchLogTimerRef.current) clearTimeout(searchLogTimerRef.current)
    searchLogTimerRef.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        const results = articles.filter(a =>
          a.title.toLowerCase().includes(val.toLowerCase()) ||
          a.excerpt.toLowerCase().includes(val.toLowerCase()),
        ).length
        logGuideSearchAction(val.trim(), results)
        track('guide_search_performed', { query: val.trim(), results_count: results })
      }
    }, 800)
  }

  function setCategory(cat: string | null) {
    setCatRaw(cat)
    setSearchRaw('')
    setReadingId(null)
    updateUrl({ cat, q: null, article: null })
    if (cat) track('guide_category_viewed', { category: cat })
  }

  function openArticle(a: Article) {
    setReadingId(a.id)
    updateUrl({ article: a.id, q: search || null, cat: category })
    track('guide_article_opened', { article_id: a.id, article_title: a.title, category: a.cat })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeArticle() {
    setReadingId(null)
    updateUrl({ article: null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSupportClick(action: string) {
    track('guide_support_clicked', { action })
  }

  // ── Computed ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    articles.forEach(a => { out[a.cat] = (out[a.cat] ?? 0) + 1 })
    return out
  }, [articles])

  const filtered = useMemo(() => {
    let arr = articles
    if (category) arr = arr.filter(a => a.cat === category)
    const q = search.trim().toLowerCase()
    if (q) arr = arr.filter(a => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q))
    return arr
  }, [articles, search, category])

  const isFiltering = !!search.trim() || !!category

  // ── Page header actions ───────────────────────────────────────
  const headerActions = (
    <>
      <Btn
        variant="secondary" size="sm" icon={<MessageCircle size={13} />}
        href="mailto:suporte@umbra.bot?subject=Preciso%20de%20ajuda"
        onClick={() => handleSupportClick('falar_com_suporte')}
      >
        Falar com suporte
      </Btn>
      <Btn
        variant="ghost" size="sm" icon={<ExternalLink size={13} />}
        href="https://status.umbra.bot"
        onClick={() => handleSupportClick('status')}
      >
        Status
      </Btn>
    </>
  )

  // ── Article view ──────────────────────────────────────────────
  if (reading) {
    return (
      <>
        <PageHeader
          title="Guia da Plataforma"
          subtitle="Tudo que você precisa para usar o Umbra Bot no seu potencial máximo."
          actions={headerActions}
        />
        <ArticleReader
          article={reading}
          articles={articles}
          onBack={closeArticle}
          onOpen={openArticle}
        />
      </>
    )
  }

  // ── List view ─────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Guia da Plataforma"
        subtitle="Tudo que você precisa para usar o Umbra Bot no seu potencial máximo."
        actions={headerActions}
      />

      <HeroSearch search={search} onSearch={setSearch} />

      {/* Categories */}
      {!isFiltering && (
        <section className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Categorias</h2>
            <span className="text-[10.5px] text-text-muted">{CATEGORIES.length} áreas · {articles.length} artigos</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {CATEGORIES.map(c => (
              <CategoryCard key={c.id} cat={c} count={counts[c.id] ?? 0} onClick={() => setCategory(c.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Active filter chips */}
      {isFiltering && (
        <div className="mb-4 flex items-center gap-2 flex-wrap text-[12px]">
          {category && (
            <button onClick={() => setCategory(null)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 font-medium focus:outline-none">
              <DynIcon name={CATEGORIES.find(c => c.id === category)?.icon} size={11} />
              {CATEGORIES.find(c => c.id === category)?.name}
              <X size={11} />
            </button>
          )}
          {search && (
            <button onClick={() => setSearch('')}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-surface-2 border border-border text-text hover:bg-surface-3 font-medium focus:outline-none">
              <Search size={11} /> &ldquo;{search}&rdquo;
              <X size={11} />
            </button>
          )}
          <span className="text-text-muted ml-1">
            {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
      )}

      {/* Articles */}
      <section className="mb-7">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
            {isFiltering ? 'Resultados' : 'Artigos em destaque'}
          </h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <Card noPadding>
          <div className="px-1 py-1">
            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mx-auto mb-3">
                  <Search size={20} />
                </div>
                <div className="text-[13px] font-semibold text-text">Nenhum artigo corresponde à busca</div>
                <div className="text-[12px] text-text-muted mt-1">Tente outra palavra-chave ou abra uma conversa com o suporte.</div>
              </div>
            )}
            {!isFiltering && articles.filter(a => a.featured).map(a => (
              <ArticleRow key={a.id} article={a} onOpen={() => openArticle(a)} />
            ))}
            {isFiltering && filtered.map(a => (
              <ArticleRow key={a.id} article={a} onOpen={() => openArticle(a)} />
            ))}
          </div>
        </Card>
      </section>

      {/* FAQ */}
      {!isFiltering && faqs.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Perguntas frequentes</h2>
            <span className="text-[10.5px] text-text-muted">{faqs.length} respostas</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <FAQ items={faqs} />
        </section>
      )}

      {/* Contact CTA */}
      {!isFiltering && (
        <section>
          <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4 flex-wrap">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <LifeBuoy size={18} />
            </div>
            <div className="flex-1 min-w-[240px]">
              <div className="text-[13.5px] font-semibold text-text">Não achou o que procurava?</div>
              <div className="text-[11.5px] text-text-muted mt-0.5">
                Fale com nosso time. Tempo médio de resposta: <strong className="text-text">15 min</strong> em horário comercial.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Btn
                variant="secondary" size="sm" icon={<Mail size={13} />}
                href="mailto:suporte@umbra.bot"
                onClick={() => handleSupportClick('enviar_email')}
              >
                Enviar e-mail
              </Btn>
              <Btn
                variant="primary" size="sm" icon={<MessageCircle size={13} />}
                href="mailto:suporte@umbra.bot?subject=Preciso%20de%20ajuda"
                onClick={() => handleSupportClick('abrir_chat')}
              >
                Abrir chat
              </Btn>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
