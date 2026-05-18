'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Zap, Clock, ThumbsUp } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

/* ─── Types ─────────────────────────────────────────────────────── */
type RoadmapStatus = 'planned' | 'in-progress' | 'launched'
type RoadmapTag    = 'fundação' | 'mvp' | 'plataforma' | 'crescimento' | 'infra'

interface RoadmapItem {
  id:     string
  title:  string
  desc:   string
  status: RoadmapStatus
  tag:    RoadmapTag
  votes?: number
}

/* ─── Column config ─────────────────────────────────────────────── */
const COLUMNS: { status: RoadmapStatus; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { status: 'planned',     label: 'Planejado',       icon: Clock,        color: 'text-text-muted',  bg: 'bg-surface-2' },
  { status: 'in-progress', label: 'Em desenvolvimento', icon: Zap,       color: 'text-warning',     bg: 'bg-warning-soft/20' },
  { status: 'launched',    label: 'Lançado',          icon: CheckCircle2, color: 'text-success',    bg: 'bg-success-soft/20' },
]

const TAG_COLORS: Record<RoadmapTag, string> = {
  fundação:    'bg-surface-2 text-text-muted border border-border',
  mvp:         'bg-primary-soft text-primary',
  plataforma:  'bg-warning-soft text-warning',
  crescimento: 'bg-success-soft text-success',
  infra:       'bg-danger-soft text-danger',
}

/* ─── Items — estado baseado no código real do repositório ─────── */
const ITEMS: RoadmapItem[] = [

  /* ── Lançado (UI implementada, Supabase schema criado) ──────── */
  { id: 'shell',          title: 'UI Shell completa',              desc: 'Sidebar, topbar, tema claro/escuro, layout responsivo.',                        status: 'launched',    tag: 'mvp'        },
  { id: 'dashboard',      title: 'Dashboard / overview',           desc: 'Métricas, gráfico de receita e tabela de pedidos recentes.',                     status: 'launched',    tag: 'mvp'        },
  { id: 'bots-ui',        title: 'Gerenciar bots',                 desc: 'Grid de bots, conectar por token do BotFather, ativar/desativar.',               status: 'launched',    tag: 'mvp'        },
  { id: 'finance-ui',     title: 'Financeiro',                     desc: 'Saldo, saque, tabela de transações com filtros e status.',                        status: 'launched',    tag: 'mvp'        },
  { id: 'activity-ui',    title: 'Atividade em tempo real',        desc: 'Feed de eventos com filtros por tipo e busca.',                                   status: 'launched',    tag: 'mvp'        },
  { id: 'analytics-ui',   title: 'Análises',                       desc: 'Gráficos e métricas de performance por bot, produto e período.',                  status: 'launched',    tag: 'plataforma' },
  { id: 'customers-ui',   title: 'CRM de clientes',                desc: 'Lista de leads e compradores com filtros, tags e perfil individual.',             status: 'launched',    tag: 'plataforma' },
  { id: 'affiliates-ui',  title: 'Afiliados',                      desc: 'Cadastro de afiliados, link de rastreamento e painel de comissões.',              status: 'launched',    tag: 'crescimento' },
  { id: 'alerts-ui',      title: 'Alertas importantes',            desc: 'Notificações de eventos críticos com prioridade e filtros.',                      status: 'launched',    tag: 'plataforma' },
  { id: 'flows-ui',       title: 'Editor de fluxos de venda',      desc: 'Blocos visuais (mensagem, botões, oferta, condição, delay, tag) e ativação.',    status: 'launched',    tag: 'plataforma' },
  { id: 'remarketing-ui', title: 'Remarketing e campanhas',        desc: '7 gatilhos, sequências de passos, pré-visualização e métricas de campanha.',     status: 'launched',    tag: 'crescimento' },
  { id: 'broadcasts-ui',  title: 'Disparador em massa',            desc: 'Segmentação por tag/status, composição com variáveis e agendamento.',             status: 'launched',    tag: 'crescimento' },
  { id: 'tools-ui',       title: 'Ferramentas',                    desc: 'Mensagem de teste, diagnóstico, gerador de QR Code, importar/exportar dados.',   status: 'launched',    tag: 'plataforma' },
  { id: 'gateways-ui',    title: 'Gateways de pagamento',          desc: 'Conexão de gateways PIX, configuração de split de comissão.',                    status: 'launched',    tag: 'mvp'        },
  { id: 'tracking-ui',    title: 'Trackeamento / pixels',          desc: 'Integração de pixels de conversão e parâmetros UTM.',                             status: 'launched',    tag: 'plataforma' },
  { id: 'checkout-ui',    title: 'Checkout',                       desc: 'Editor visual de páginas de checkout personalizadas.',                             status: 'launched',    tag: 'crescimento' },
  { id: 'biolink-ui',     title: 'Bio Link',                       desc: 'Página de links personalizável para usar na bio de redes sociais.',               status: 'launched',    tag: 'crescimento' },
  { id: 'webhooks-ui',    title: 'Webhooks',                       desc: 'Cadastro de endpoints, seleção de eventos e log de entregas.',                    status: 'launched',    tag: 'plataforma' },
  { id: 'redirects-ui',   title: 'Redirecionadores',               desc: 'Links curtos com rastreamento de cliques e gráfico de acesso.',                   status: 'launched',    tag: 'crescimento' },
  { id: 'profile-ui',     title: 'Perfil e configurações',         desc: 'Dados pessoais, senha, 2FA e preferências de notificação.',                       status: 'launched',    tag: 'mvp'        },
  { id: 'academy-ui',     title: 'Sistema educacional',            desc: 'Módulos de vídeo-aula, progresso e conclusão de cursos.',                         status: 'launched',    tag: 'crescimento' },
  { id: 'guide-ui',       title: 'Guia da plataforma',             desc: 'Checklist de onboarding e visão geral de cada módulo.',                           status: 'launched',    tag: 'mvp'        },
  { id: 'legal-pages',    title: 'Páginas legais',                 desc: 'Termos de Uso, Política de Privacidade e Contato com tema e TOC.',               status: 'launched',    tag: 'fundação'   },
  { id: 'docs-site',      title: 'Documentação pública',           desc: 'Central de docs com sidebar, busca, TOC por artigo e 15 categorias.',             status: 'launched',    tag: 'fundação'   },
  { id: 'status-page',    title: 'Página de Status',               desc: 'Uptime por componente, histórico de incidentes e banner de estado geral.',       status: 'launched',    tag: 'fundação'   },
  { id: 'changelog-page', title: 'Changelog',                      desc: 'Registro de versões com filtro por tipo (novidade, melhoria, correção).',         status: 'launched',    tag: 'fundação'   },
  { id: 'roadmap-page',   title: 'Roadmap público',                desc: 'Três colunas (planejado, em desenvolvimento, lançado) com votação futura.',       status: 'launched',    tag: 'fundação'   },
  { id: 'supabase-schema', title: 'Schema Supabase',               desc: '20 arquivos de migração SQL cobrindo todas as entidades da plataforma.',          status: 'launched',    tag: 'infra'      },

  /* ── Em desenvolvimento ─────────────────────────────────────── */
  { id: 'auth',           title: 'Autenticação real',              desc: 'Login, cadastro e sessão JWT integrados ao Supabase Auth.',                       status: 'in-progress', tag: 'mvp'        },
  { id: 'supabase-wire',  title: 'Integração Supabase live',       desc: 'Substituição de mocks por dados reais do banco em todos os módulos.',             status: 'in-progress', tag: 'infra'      },

  /* ── Planejado ──────────────────────────────────────────────── */
  { id: 'multitenancy',   title: 'Multi-tenancy',                  desc: 'Workspaces isolados por usuário, planos e limites de uso.',                       status: 'planned',     tag: 'infra'      },
  { id: 'telegram-real',  title: 'Integração Telegram real',       desc: 'Webhook por bot, processamento de updates, envio de mensagens via API.',          status: 'planned',     tag: 'mvp'        },
  { id: 'payments-real',  title: 'Pagamentos reais',               desc: 'Processamento PIX, split automático, notificação de aprovação/reembolso.',        status: 'planned',     tag: 'mvp'        },
  { id: 'queue',          title: 'Fila de disparos',               desc: 'BullMQ + Redis para envios em massa com rate limit e retry.',                     status: 'planned',     tag: 'infra'      },
  { id: 'api-routes',     title: 'API Routes',                     desc: 'Endpoints REST/tRPC para todas as operações do painel.',                           status: 'planned',     tag: 'fundação'   },
  { id: 'ci-cd',          title: 'CI/CD e testes',                 desc: 'Pipeline de integração contínua, testes unitários e e2e.',                        status: 'planned',     tag: 'infra'      },
  { id: 'mobile-app',     title: 'App mobile',                     desc: 'Aplicativo nativo para acompanhar vendas e leads em tempo real.',                 status: 'planned',     tag: 'crescimento' },
  { id: 'analytics-real', title: 'Análises ao vivo',               desc: 'Dados reais de conversão, funil e LTV integrados ao banco.',                     status: 'planned',     tag: 'plataforma' },
]

/* ─── Item card ─────────────────────────────────────────────────── */
function ItemCard({ item }: { item: RoadmapItem }) {
  const [voted, setVoted] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-2.5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13.5px] font-semibold text-text leading-snug">{item.title}</p>
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap',
          TAG_COLORS[item.tag],
        )}>
          {item.tag}
        </span>
      </div>
      <p className="text-[12.5px] text-text-muted leading-[1.6]">{item.desc}</p>

      {/* Vote — UI only, marked as "a conectar" */}
      {item.status === 'planned' && (
        <button
          onClick={() => setVoted((v) => !v)}
          title="Votação — integração com backend em breve"
          className={cn(
            'self-start flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-lg border transition-colors',
            voted
              ? 'bg-primary-soft text-primary border-primary/30'
              : 'text-text-muted border-border hover:border-primary/30 hover:text-primary',
          )}
        >
          <ThumbsUp size={12} />
          {voted ? 'Votado!' : 'Quero isso'} · <span className="opacity-60">a conectar</span>
        </button>
      )}
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function RoadmapPage() {
  const [tagFilter, setTagFilter] = useState<RoadmapTag | 'all'>('all')

  const TAGS: (RoadmapTag | 'all')[] = ['all', 'fundação', 'mvp', 'plataforma', 'crescimento', 'infra']

  function colItems(status: RoadmapStatus) {
    return ITEMS.filter(
      (i) => i.status === status && (tagFilter === 'all' || i.tag === tagFilter),
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg,white)] text-text" style={{ colorScheme: 'light dark' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden>
              <rect width="32" height="32" rx="9" fill="var(--primary)" />
              <path d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z" fill="white" />
            </svg>
            <span className="font-semibold text-[14px] text-text">Umbra<span className="text-text-muted font-normal"> Roadmap</span></span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-text-muted">
            <Link href="/docs"      className="hover:text-text transition-colors">Docs</Link>
            <Link href="/status"    className="hover:text-text transition-colors">Status</Link>
            <Link href="/changelog" className="hover:text-text transition-colors">Changelog</Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 md:py-14">

        {/* Page header */}
        <div className="mb-8 pb-8 border-b border-border">
          <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary-soft text-primary text-[10.5px] font-bold uppercase tracking-widest mb-4">
            Roadmap
          </div>
          <h1 className="text-[28px] md:text-[34px] font-semibold text-text mb-2">O que estamos construindo</h1>
          <p className="text-[14px] text-text-muted leading-relaxed max-w-xl">
            Acompanhe o estado real de cada funcionalidade — desde o que já está disponível até o que
            está planejado. Estado baseado diretamente no código do repositório.
          </p>
        </div>

        {/* Tag filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={cn(
                'px-3 py-1 rounded-lg text-[12.5px] font-medium border transition-colors capitalize',
                tagFilter === t
                  ? t === 'all' ? 'bg-text text-surface border-text' : cn(TAG_COLORS[t as RoadmapTag], 'border-transparent')
                  : 'bg-surface border-border text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              {t === 'all' ? 'Tudo' : t}
            </button>
          ))}
        </div>

        {/* Kanban columns */}
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          {COLUMNS.map((col) => {
            const items = colItems(col.status)
            const Icon  = col.icon
            return (
              <div key={col.status} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={cn(
                  'flex items-center justify-between px-4 py-3 rounded-xl border border-border',
                  col.bg,
                )}>
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={col.color} />
                    <span className="text-[13.5px] font-semibold text-text">{col.label}</span>
                  </div>
                  <span className="text-[12px] font-bold text-text-muted bg-surface px-2 py-0.5 rounded-md">
                    {items.length}
                  </span>
                </div>

                {/* Items */}
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-text-subtle">
                    Nenhum item com este filtro.
                  </div>
                ) : (
                  items.map((item) => <ItemCard key={item.id} item={item} />)
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-10 p-4 rounded-xl border border-border bg-surface-2 text-[12.5px] text-text-muted text-center">
          O estado de cada item é atualizado manualmente conforme o progresso no repositório.
          Para sugerir novas funcionalidades,{' '}
          <Link href="/contato" className="text-primary hover:underline">
            fale conosco
          </Link>.
        </div>

        {/* Footer */}
        <footer className="border-t border-border mt-14 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-text-muted">
          <span>© {new Date().getFullYear()} Umbra Bot — Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <Link href="/termos"      className="hover:text-text">Termos</Link>
            <Link href="/privacidade" className="hover:text-text">Privacidade</Link>
            <Link href="/contato"     className="hover:text-text">Contato</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
