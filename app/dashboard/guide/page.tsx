'use client'

import { useState, useMemo, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Rocket, Bot, GitBranch, CreditCard, Send, Globe,
  BookOpen, Search, ArrowUpRight, Info, AlertTriangle,
  ThumbsUp, ThumbsDown, MessageCircle, ChevronLeft,
  Minus, Plus, X, LifeBuoy, Mail, ExternalLink, File,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

interface Category { id: string; name: string; icon: string; color: string; desc: string }
interface Article {
  id: string; cat: string; title: string; readMin: number
  updatedAt: number; views: number; featured: boolean; excerpt: string
}
interface FaqItem { id: string; q: string; a: string }

/* ============================================================
   Helpers
   ============================================================ */

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const NOW = new Date('2026-05-18T15:30:00').getTime()

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
  file: File, globe: Globe,
}
function DynIcon({ name, size = 14, className }: { name?: string; size?: number; className?: string }) {
  const Comp = ICON_MAP[name ?? ''] ?? Globe
  return <Comp size={size} className={className} />
}

/* ============================================================
   Catalog data
   ============================================================ */

const CATEGORIES: Category[] = [
  { id: 'getting_started', name: 'Primeiros passos', icon: 'rocket',      color: 'var(--primary)', desc: 'Conheça o painel e configure sua primeira venda.' },
  { id: 'bots',            name: 'Bots',             icon: 'bot',         color: 'var(--success)', desc: 'Conectar, configurar e diagnosticar bots do Telegram.' },
  { id: 'flows',           name: 'Fluxos',           icon: 'git-branch',  color: 'var(--warning)', desc: 'Editor visual, gatilhos e boas práticas de fluxos.' },
  { id: 'payments',        name: 'Pagamentos',       icon: 'credit-card', color: 'var(--danger)',  desc: 'Gateways, split, taxas e teste de cobrança PIX.' },
  { id: 'broadcasts',      name: 'Disparos',         icon: 'send',        color: 'oklch(0.62 0.18 280)', desc: 'Listas, segmentos e limites de envio do Telegram.' },
  { id: 'integrations',    name: 'Integrações',      icon: 'webhook',     color: 'oklch(0.62 0.16 200)', desc: 'Webhooks, pixels e ferramentas externas.' },
]

const ARTICLES: Article[] = [
  { id: 'a01', cat: 'getting_started', title: 'Bem-vindo ao Umbra Bot — visão geral do painel', readMin: 4, updatedAt: NOW - 3*24*3600*1000, views: 8420, featured: true,  excerpt: 'Tour rápido pelos módulos do painel — Dashboard, Bots, Fluxos, Financeiro — e o que cada um faz.' },
  { id: 'a02', cat: 'getting_started', title: 'Como conectar seu primeiro bot em 3 minutos',     readMin: 3, updatedAt: NOW - 5*24*3600*1000, views: 6210, featured: true,  excerpt: 'Vamos do @BotFather até o webhook configurado, passo a passo.' },
  { id: 'a03', cat: 'getting_started', title: 'Convidando sua equipe e definindo papéis',        readMin: 5, updatedAt: NOW - 14*24*3600*1000,views: 2840, featured: false, excerpt: 'Administrador, Editor, Analista: o que cada papel pode fazer e como convidar membros.' },
  { id: 'a10', cat: 'bots',            title: 'Validando o token do BotFather',                   readMin: 2, updatedAt: NOW - 7*24*3600*1000, views: 4180, featured: false, excerpt: 'Como verificar se um token está correto antes de conectar o bot.' },
  { id: 'a11', cat: 'bots',            title: 'Bot banido — como recuperar ou substituir',        readMin: 6, updatedAt: NOW - 12*24*3600*1000,views: 1842, featured: false, excerpt: 'O Telegram baniu seu bot? Veja o que fazer e como manter os contatos.' },
  { id: 'a12', cat: 'bots',            title: 'Configurando o webhook do bot',                    readMin: 4, updatedAt: NOW - 20*24*3600*1000,views: 1284, featured: false, excerpt: 'Como o Umbra Bot recebe eventos do Telegram e o que cada endpoint faz.' },
  { id: 'a20', cat: 'flows',           title: 'Anatomia do editor visual de fluxos',              readMin: 7, updatedAt: NOW - 6*24*3600*1000, views: 5128, featured: true,  excerpt: 'Nós, conexões, condições e como pensar fluxos que convertem.' },
  { id: 'a21', cat: 'flows',           title: 'Variáveis — {nome}, {produto} e mais',             readMin: 3, updatedAt: NOW - 16*24*3600*1000,views: 2440, featured: false, excerpt: 'Como usar variáveis em mensagens e por que elas turbinam conversão.' },
  { id: 'a22', cat: 'flows',           title: 'Boas práticas: o funil VIP de 7 etapas',           readMin: 9, updatedAt: NOW - 25*24*3600*1000,views: 3128, featured: false, excerpt: 'Modelo passo-a-passo que vende mentoria premium em alta conversão.' },
  { id: 'a30', cat: 'payments',        title: 'Como o split de pagamento funciona',               readMin: 5, updatedAt: NOW - 4*24*3600*1000, views: 4120, featured: true,  excerpt: 'Gateway, comissão Umbra Bot e sua conta — quem retém o quê em cada venda.' },
  { id: 'a31', cat: 'payments',        title: 'Conectando o Pushinpay e configurando Pix',        readMin: 4, updatedAt: NOW - 9*24*3600*1000, views: 2810, featured: false, excerpt: 'Token de API, conta de recebimento e teste de cobrança em 3 cliques.' },
  { id: 'a32', cat: 'payments',        title: 'Taxas, antecipação e prazos de liquidação',        readMin: 6, updatedAt: NOW - 28*24*3600*1000,views: 1840, featured: false, excerpt: 'Tabela comparativa de gateways suportados no Umbra Bot.' },
  { id: 'a40', cat: 'broadcasts',      title: 'Limites de envio do Telegram (30 msgs/s)',         readMin: 4, updatedAt: NOW - 11*24*3600*1000,views: 2240, featured: false, excerpt: 'Por que disparos demoram e como o Umbra Bot enfileira para não dar throttling.' },
  { id: 'a41', cat: 'broadcasts',      title: 'Segmentando sua base com tags',                    readMin: 3, updatedAt: NOW - 18*24*3600*1000,views: 1684, featured: false, excerpt: 'Tag = filtro. Como criar segmentos que tornam cada disparo mais relevante.' },
  { id: 'a42', cat: 'broadcasts',      title: 'Boas práticas de copy para disparos',              readMin: 5, updatedAt: NOW - 30*24*3600*1000,views: 2128, featured: false, excerpt: 'Cabeçalho, gatilho de abertura e CTA: estrutura de mensagens que convertem.' },
  { id: 'a50', cat: 'integrations',    title: 'Pixel da Meta + CAPI no Umbra Bot',                readMin: 6, updatedAt: NOW - 8*24*3600*1000, views: 3284, featured: false, excerpt: 'Configurando rastreamento server-side e melhorando o match rate.' },
  { id: 'a51', cat: 'integrations',    title: 'Verificando a assinatura de webhooks',             readMin: 4, updatedAt: NOW - 22*24*3600*1000,views: 940,  featured: false, excerpt: 'HMAC SHA-256 e o header X-Umbra-Signature. Exemplo em Node/Python.' },
]

const FAQS: FaqItem[] = [
  { id: 'f1', q: 'O Umbra Bot cobra mensalidade ou comissão por venda?',
    a: 'Os dois. Você paga uma assinatura mensal de acordo com o plano (Starter, Pro ou Scale) e o Umbra Bot retém 3% sobre cada venda processada via gateway conectado. A comissão é descontada automaticamente no split — você não precisa nos pagar separadamente.' },
  { id: 'f2', q: 'Posso usar mais de um gateway ao mesmo tempo?',
    a: 'Sim. Conecte quantos gateways quiser e escolha qual é o padrão em cada produto/checkout. Se um gateway cair, o Umbra Bot roteia automaticamente para o secundário (configurável em cada checkout).' },
  { id: 'f3', q: 'O Telegram pode banir meu bot por causa do Umbra Bot?',
    a: 'Não. O Umbra Bot usa a API oficial do Telegram Bots e respeita todos os limites (30 mensagens/s por bot, 1 por segundo por chat). Banimentos acontecem apenas se o conteúdo violar as Políticas do Telegram.' },
  { id: 'f4', q: 'Como funciona o limite de mensagens do meu plano?',
    a: 'Cada plano tem uma cota mensal (ex.: Pro = 10.000 msgs/mês). A cota reseta no dia da renovação. Se você ultrapassar 80%, recebe um alerta automático. Após 100%, disparos pausam até a renovação ou upgrade.' },
  { id: 'f5', q: 'Os dados dos meus clientes ficam onde?',
    a: 'Em data centers brasileiros (AWS São Paulo). O Umbra Bot é compliant com a LGPD — você é o controlador e nós somos o operador. Você pode exportar ou apagar dados pessoais a qualquer momento nas Configurações.' },
  { id: 'f6', q: 'Posso testar antes de pagar?',
    a: 'Sim. Todo plano tem 14 dias gratuitos com acesso completo. Sem cartão de crédito na assinatura inicial — pedimos só quando você converter para um plano pago.' },
  { id: 'f7', q: 'Vocês ajudam na migração de outra ferramenta?',
    a: 'Sim. O time de Sucesso do Cliente faz a migração junto com você nos planos Pro e Scale, incluindo importação de leads, fluxos e templates. Em Starter, use a tela Ferramentas → Importar configurações.' },
]

/* ============================================================
   Shared UI
   ============================================================ */

function Btn({ variant = 'secondary', size = 'sm', icon, onClick, children, className }: {
  variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md'
  icon?: React.ReactNode; onClick?: () => void; children?: React.ReactNode; className?: string
}) {
  const sz = size === 'md' ? 'h-9 px-4 text-[12.5px]' : 'h-8 px-3 text-[12px]'
  const v = variant === 'primary' ? 'bg-primary text-white hover:opacity-90'
    : variant === 'ghost' ? 'text-text-muted hover:bg-surface-2 hover:text-text'
    : 'bg-surface-2 text-text border border-border hover:bg-surface-3'
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none ${sz} ${v} ${className ?? ''}`}>
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
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${cls[tone] ?? cls.muted}`}>{children}</span>
}

/* ============================================================
   HeroSearch
   ============================================================ */

function HeroSearch({ search, setSearch, suggestions }: {
  search: string; setSearch: (s: string) => void; suggestions: string[]
}) {
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
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por palavra-chave, módulo ou erro…"
            className="w-full h-12 pl-11 pr-4 bg-surface border border-border rounded-xl text-[14px] placeholder:text-text-muted text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap text-[11.5px] text-text-muted">
          <span>Populares:</span>
          {suggestions.map(s => (
            <button key={s} onClick={() => setSearch(s)}
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
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: cat.color }}>
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
        style={{ background: cat?.color ?? 'var(--text-muted)' }}>
        <DynIcon name={cat?.icon} size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[13px] font-semibold text-text leading-snug group-hover:text-primary transition-colors">{article.title}</h3>
          {article.featured && <Badge tone="primary">Em destaque</Badge>}
        </div>
        <p className="text-[11.5px] text-text-muted mt-0.5 leading-snug max-w-2xl">{article.excerpt}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-text-muted">
          <span>{cat?.name}</span><span>·</span>
          <span>{article.readMin} min de leitura</span><span>·</span>
          <span>{fmtNum(article.views)} visualizações</span>
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
              {isOpen ? <Minus size={14} className="text-text-muted shrink-0" /> : <Plus size={14} className="text-text-muted shrink-0" />}
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
   Callout & Heading (article body)
   ============================================================ */

const CALLOUT_TONES: Record<string, { bg: string; border: string; text: string }> = {
  info:    { bg: 'bg-primary/5',        border: 'border-primary/20',  text: 'text-primary' },
  warning: { bg: 'bg-warning-soft/40',  border: 'border-warning/20',  text: 'text-warning' },
  success: { bg: 'bg-success-soft/40',  border: 'border-success/20',  text: 'text-success' },
  danger:  { bg: 'bg-danger-soft/40',   border: 'border-danger/20',   text: 'text-danger'  },
}

function Callout({ tone, icon, title, children }: {
  tone: string; icon: string; title: string; children: React.ReactNode
}) {
  const t = CALLOUT_TONES[tone] ?? CALLOUT_TONES.info
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-lg border ${t.bg} ${t.border}`}>
      <DynIcon name={icon} size={15} className={`${t.text} shrink-0 mt-0.5`} />
      <div className={`flex-1 text-[13px] text-text leading-relaxed`}>
        <strong className={t.text}>{title}.</strong> {children}
      </div>
    </div>
  )
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[18px] font-semibold tracking-tight text-text mt-7 mb-1 scroll-mt-20">{children}</h2>
  )
}

/* ============================================================
   ArticleReader
   ============================================================ */

const TOC = [
  { id: 'visao-geral',     label: 'Visão geral' },
  { id: 'passo-a-passo',   label: 'Passo a passo' },
  { id: 'erros-comuns',    label: 'Erros comuns' },
  { id: 'proximos-passos', label: 'Próximos passos' },
]

function ArticleReader({ article, onBack, onOpen }: {
  article: Article; onBack: () => void; onOpen: (a: Article) => void
}) {
  const cat = CATEGORIES.find(c => c.id === article.cat)
  const related = ARTICLES.filter(a => a.cat === article.cat && a.id !== article.id).slice(0, 4)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start max-w-[1100px]">
      <article className="min-w-0">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 h-8 px-2 text-[12px] text-text-muted hover:text-text rounded-md hover:bg-surface-2 focus:outline-none mb-4">
          <ChevronLeft size={13} /> Voltar à central
        </button>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge tone="primary"><DynIcon name={cat?.icon} size={10} /> {cat?.name}</Badge>
          <span className="text-[11px] text-text-muted">{article.readMin} min · atualizado {fmtDate(article.updatedAt)}</span>
        </div>

        <h1 className="text-[26px] font-semibold tracking-tight text-text leading-tight">{article.title}</h1>
        <p className="text-[14px] text-text-muted mt-2 leading-relaxed">{article.excerpt}</p>

        <div className="mt-7 space-y-5 text-[14px] text-text leading-relaxed">
          <p>
            Este artigo cobre o essencial sobre <strong>{article.title.toLowerCase()}</strong>.
            Se você é novo no Umbra Bot, recomendamos começar pelo guia <em>Bem-vindo ao Umbra Bot</em> antes de seguir os passos abaixo.
          </p>

          <Heading id="visao-geral">Visão geral</Heading>
          <p>
            O Umbra Bot foi projetado para que operações de venda no Telegram fluam com pouco atrito.
            Aqui você encontra o caminho recomendado, os atalhos quando você já tem familiaridade e onde checar quando algo dá errado.
          </p>
          <Callout tone="info" icon="info" title="Dica">
            Você pode pressionar <kbd className="bg-surface-2 border border-border rounded px-1 text-[11px] font-mono">⌘K</kbd> em
            qualquer tela para abrir a busca global e pular direto para o módulo desejado.
          </Callout>

          <Heading id="passo-a-passo">Passo a passo</Heading>
          <ol className="list-decimal list-inside space-y-2">
            <li>Abra o módulo correspondente na barra lateral (Bots, Fluxos, Pagamentos, etc.).</li>
            <li>Use o botão principal "Adicionar" / "Criar" no canto superior direito.</li>
            <li>Preencha os campos obrigatórios — todos têm dicas inline para te orientar.</li>
            <li>Antes de publicar, use a "Prévia" para checar a aparência ou o comportamento.</li>
            <li>Acompanhe os resultados em Análises ou na Atividade ao vivo.</li>
          </ol>

          <Heading id="erros-comuns">Erros comuns</Heading>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Bot offline.</strong> Quase sempre é o token revogado no BotFather. Recrie e cole de novo na tela de Bots.</li>
            <li><strong>Pix gerado mas não pago.</strong> Verifique se a conta de recebimento bateu certo no Gateway selecionado.</li>
            <li><strong>Fluxo "trava" no meio.</strong> Procure por uma Condição mal configurada — a saída "Senão" provavelmente não tem nó conectado.</li>
          </ul>

          <Callout tone="warning" icon="alert-triangle" title="Atenção">
            Mudanças em fluxos publicados afetam usuários em execução. Considere clonar e publicar uma nova versão se a alteração for grande.
          </Callout>

          <Heading id="proximos-passos">Próximos passos</Heading>
          <p>
            Se ainda houver dúvidas, fale com nosso time pelo botão de Suporte. O tempo médio de resposta nos planos Pro e Scale é de até <strong>15 minutos</strong> nos dias úteis.
          </p>
        </div>

        <div className="mt-8 pt-5 border-t border-border">
          <div className="text-[12px] text-text-muted mb-2.5">Este artigo foi útil?</div>
          <div className="flex items-center gap-1.5">
            <Btn variant="secondary" size="sm" icon={<ThumbsUp size={13} />}>Sim, ajudou</Btn>
            <Btn variant="secondary" size="sm" icon={<ThumbsDown size={13} />}>Não muito</Btn>
            <Btn variant="ghost" size="sm" icon={<MessageCircle size={13} />} className="ml-auto">Falar com suporte</Btn>
          </div>
        </div>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-[80px]">
        <Card title="Nesta página" subtitle="Sumário">
          <nav className="space-y-1 text-[12px]">
            {TOC.map(s => (
              <a key={s.id} href={`#${s.id}`}
                className="block px-2 py-1 rounded text-text-muted hover:text-text hover:bg-surface-2 focus:outline-none">
                {s.label}
              </a>
            ))}
          </nav>
        </Card>

        <Card title="Artigos relacionados" subtitle={cat?.name}>
          <div className="-mx-1">
            {related.map(r => (
              <button key={r.id} onClick={() => onOpen(r)}
                className="w-full text-left px-2 py-2 rounded hover:bg-surface-2/60 focus:outline-none group">
                <div className="text-[12.5px] font-medium text-text group-hover:text-primary leading-snug">{r.title}</div>
                <div className="text-[10.5px] text-text-muted mt-0.5">{r.readMin} min · {fmtNum(r.views)} views</div>
              </button>
            ))}
            {related.length === 0 && <div className="px-2 py-3 text-[12px] text-text-muted">Nenhum artigo relacionado.</div>}
          </div>
        </Card>
      </aside>
    </div>
  )
}

/* ============================================================
   GuidePage
   ============================================================ */

export default function GuidePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [reading, setReading] = useState<Article | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data } = await sb.from('guide_articles').select('*')
        if (data?.length) {
          /* data would override ARTICLES if available */
        }
      } catch { /* silent fallback to static data */ }
    }
    load()
  }, [])

  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    ARTICLES.forEach(a => { out[a.cat] = (out[a.cat] ?? 0) + 1 })
    return out
  }, [])

  const filtered = useMemo(() => {
    let arr = ARTICLES
    if (category) arr = arr.filter(a => a.cat === category)
    const q = search.trim().toLowerCase()
    if (q) arr = arr.filter(a => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q))
    return arr
  }, [search, category])

  const isFiltering = !!search.trim() || !!category

  if (reading) {
    return (
      <DashboardLayout>
        <PageHeader title="Guia da Plataforma" subtitle="Tudo que você precisa para usar o Umbra Bot no seu potencial máximo." />
        <ArticleReader article={reading} onBack={() => setReading(null)} onOpen={a => setReading(a)} />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Guia da Plataforma"
        subtitle="Tudo que você precisa para usar o Umbra Bot no seu potencial máximo."
        actions={
          <>
            <Btn variant="secondary" size="sm" icon={<MessageCircle size={13} />}>Falar com suporte</Btn>
            <Btn variant="ghost" size="sm" icon={<ExternalLink size={13} />}>Status</Btn>
          </>
        }
      />

      <HeroSearch search={search} setSearch={setSearch}
        suggestions={['conectar bot', 'split de pagamento', 'webhook 502', 'limite Telegram']} />

      {/* Categories */}
      {!isFiltering && (
        <section className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Categorias</h2>
            <span className="text-[10.5px] text-text-muted">{CATEGORIES.length} áreas · {ARTICLES.length} artigos</span>
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
          <span className="text-text-muted ml-1">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</span>
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
            {!isFiltering && ARTICLES.filter(a => a.featured).map(a => (
              <ArticleRow key={a.id} article={a} onOpen={() => setReading(a)} />
            ))}
            {isFiltering && filtered.map(a => (
              <ArticleRow key={a.id} article={a} onOpen={() => setReading(a)} />
            ))}
          </div>
        </Card>
      </section>

      {/* FAQ */}
      {!isFiltering && (
        <section className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Perguntas frequentes</h2>
            <span className="text-[10.5px] text-text-muted">{FAQS.length} respostas</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <FAQ items={FAQS} />
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
              <Btn variant="secondary" size="sm" icon={<Mail size={13} />}>Enviar e-mail</Btn>
              <Btn variant="primary" size="sm" icon={<MessageCircle size={13} />}>Abrir chat</Btn>
            </div>
          </div>
        </section>
      )}
    </DashboardLayout>
  )
}
