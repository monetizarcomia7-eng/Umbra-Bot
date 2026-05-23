'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Sparkles, Wrench, Bug, Filter } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

/* ─── Types ─────────────────────────────────────────────────────── */
type EntryType = 'novidade' | 'melhoria' | 'correcao'

interface ChangeEntry {
  id:      string
  date:    string          // YYYY-MM-DD
  version?: string
  title:   string
  body:    string
  type:    EntryType
  items:   string[]
}

/* ─── Type config ───────────────────────────────────────────────── */
const TYPE_CONFIG: Record<EntryType, {
  label: string; icon: React.ElementType; badge: string; dot: string
}> = {
  novidade:  { label: 'Novidade',  icon: Sparkles, badge: 'bg-primary-soft text-primary',          dot: 'bg-primary' },
  melhoria:  { label: 'Melhoria',  icon: Wrench,   badge: 'bg-success-soft text-success',          dot: 'bg-success' },
  correcao:  { label: 'Correção',  icon: Bug,       badge: 'bg-warning-soft text-warning',          dot: 'bg-warning' },
}

/* ─── Entries (Supabase-ready — substitua por fetch em produção) ─ */
const ENTRIES: ChangeEntry[] = [
  {
    id:      'v0.1.0-launch',
    date:    '2026-05-18',
    version: 'v0.1.0',
    title:   'Lançamento da Plataforma',
    type:    'novidade',
    body:    'Primeira versão pública do Umbra Bot. A plataforma sai do modo privado e está disponível para criação de contas.',
    items: [
      'Painel completo com Dashboard, métricas e gráfico de receita.',
      'Módulo de Gerenciar bots — conecte quantos bots Telegram quiser.',
      'Editor de fluxos de venda com blocos visuais.',
      'Módulo de Remarketing e campanhas automatizadas.',
      'Disparador de mensagens em massa (Broadcasts).',
      'CRM de clientes com filtros e perfil individual.',
      'Programa de Afiliados com link de rastreamento.',
      'Integrações: Gateways de pagamento, Checkout, Bio Link, Webhooks, Trackeamento.',
      'Redirecionadores de links com contagem de cliques.',
      'Sistema Educacional (Academy) com vídeo-aulas.',
      'Ferramentas: mensagem de teste, diagnóstico, gerador de QR Code, importação/exportação.',
      'Financeiro com saldo, extrato e resumo de taxas.',
      'Alertas importantes com priorização por criticidade.',
      'Notificações configuráveis por tipo e canal.',
      'Tema claro e escuro com alternância instantânea.',
      'Páginas legais: Termos de Uso, Política de Privacidade e Contato.',
    ],
  },
]

/* ─── Formatação de data ────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/* ─── Entry card ────────────────────────────────────────────────── */
function EntryCard({ entry }: { entry: ChangeEntry }) {
  const cfg  = TYPE_CONFIG[entry.type]
  const Icon = cfg.icon

  return (
    <div className="relative flex gap-5 md:gap-8 group">
      {/* Timeline line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('w-3 h-3 rounded-full ring-4 ring-[var(--bg,white)] mt-1.5 shrink-0', cfg.dot)} />
        <div className="w-px flex-1 bg-border mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <time className="text-[12.5px] text-text-muted font-medium">{fmtDate(entry.date)}</time>
          {entry.version && (
            <span className="text-[11px] font-mono bg-surface-2 border border-border text-text-muted px-2 py-0.5 rounded-md">
              {entry.version}
            </span>
          )}
          <span className={cn(
            'flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md',
            cfg.badge,
          )}>
            <Icon size={11} />
            {cfg.label}
          </span>
        </div>

        <h2 className="text-[18px] font-semibold text-text mb-2">{entry.title}</h2>
        <p className="text-[14px] text-text-muted leading-[1.8] mb-4">{entry.body}</p>

        {entry.items.length > 0 && (
          <ul className="space-y-1.5">
            {entry.items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] text-text-muted leading-[1.7]">
                <span className={cn('w-1.5 h-1.5 rounded-full mt-[7px] shrink-0', cfg.dot)} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function ChangelogPage() {
  const [filter, setFilter] = useState<EntryType | 'all'>('all')

  const filtered = useMemo(
    () => filter === 'all' ? ENTRIES : ENTRIES.filter((e) => e.type === filter),
    [filter],
  )

  return (
    <div className="min-h-screen bg-[var(--bg,white)] text-text" style={{ colorScheme: 'light dark' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-[800px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <svg viewBox="0 0 100 100" width="24" height="24" aria-hidden>
              <rect width="100" height="100" rx="20" fill="var(--primary)" />
              <path d="M 18 18 V 60 A 32 32 0 0 0 82 60 V 18 H 64 V 60 A 14 14 0 0 1 36 60 V 18 Z" fill="#f4f4f8" />
              <rect x="14" y="42" width="72" height="3.5" rx="2" fill="rgba(0,0,0,0.65)" />
            </svg>
            <span className="font-semibold text-[14px] text-text">Umbra<span className="text-text-muted font-normal"> Changelog</span></span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-text-muted">
            <Link href="/docs"    className="hover:text-text transition-colors">Docs</Link>
            <Link href="/status"  className="hover:text-text transition-colors">Status</Link>
            <Link href="/roadmap" className="hover:text-text transition-colors">Roadmap</Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-[800px] mx-auto px-4 md:px-8 py-10 md:py-14">

        {/* Page header */}
        <div className="mb-10 pb-8 border-b border-border">
          <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary-soft text-primary text-[10.5px] font-bold uppercase tracking-widest mb-4">
            Changelog
          </div>
          <h1 className="text-[28px] md:text-[34px] font-semibold text-text mb-2">Novidades e atualizações</h1>
          <p className="text-[14px] text-text-muted leading-relaxed max-w-lg">
            Registro de todas as versões, melhorias e correções do Umbra Bot, em ordem cronológica reversa.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
            <Filter size={13} /> Filtrar:
          </span>
          {(['all', 'novidade', 'melhoria', 'correcao'] as const).map((t) => {
            const cfg = t === 'all' ? null : TYPE_CONFIG[t]
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12.5px] font-medium border transition-colors',
                  filter === t
                    ? t === 'all'
                      ? 'bg-text text-surface border-text'
                      : cn(cfg!.badge, 'border-transparent')
                    : 'bg-surface border-border text-text-muted hover:border-border-strong hover:text-text',
                )}
              >
                {cfg && <cfg.icon size={12} />}
                {t === 'all' ? 'Todos' : cfg!.label}
              </button>
            )
          })}
          <span className="ml-auto text-[12px] text-text-subtle">
            {filtered.length} {filtered.length === 1 ? 'entrada' : 'entradas'}
          </span>
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-text-muted text-[14px]">
            Nenhuma entrada com este filtro.
          </div>
        ) : (
          <div>
            {filtered.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        <div className="mt-2 p-4 rounded-xl border border-dashed border-border bg-surface-2 text-[12.5px] text-text-muted text-center">
          Novas entradas serão adicionadas a cada lançamento.
          Para sugestões, use o{' '}
          <Link href="/roadmap" className="text-primary hover:underline">Roadmap</Link>{' '}
          ou{' '}
          <Link href="/contato" className="text-primary hover:underline">fale conosco</Link>.
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
