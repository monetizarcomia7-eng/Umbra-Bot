'use client'

import React, { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot, Search, X, ArrowUpRight, Plus, BookOpen,
  ExternalLink, Settings, GitBranch, Webhook,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { BotData, FlowData, fmtNum, fmtBRLdec, fmtPct, STATUS_CONFIG } from './types'
import { Btn, Badge, Dropdown, CopyButton, BotAvatar, Stat, SummaryChip } from './ui'

// ─── BotCard ───────────────────────────────────────────────────────────────────

function BotCard({ bot, flows, onOpen, onOpenTab }: {
  bot: BotData; flows: FlowData[]; onOpen: () => void; onOpenTab: (tab: string) => void
}) {
  const st = STATUS_CONFIG[bot.status]
  const flow = flows.find(f => f.id === bot.activeFlowId)
  const hasActivity = bot.leads > 0 || bot.sales > 0
  const telegramUrl = bot.username ? `https://t.me/${bot.username}` : null

  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group relative bg-surface border border-border rounded-xl p-5 text-left hover:border-border-strong transition-colors w-full cursor-pointer">

      {/* Header */}
      <div className="flex items-start gap-3.5">
        <BotAvatar bot={bot} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={st.tone}>{st.label}</Badge>
            {bot.username && <span className="text-[10.5px] text-text-subtle">@{bot.username}</span>}
          </div>
          <h3 className="text-[14px] font-semibold text-text leading-snug mt-1.5 truncate">{bot.name}</h3>
        </div>

        {/* Quick actions — visible on hover (#1 + #6) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={e => e.stopPropagation()}>
          {telegramUrl && (
            <>
              <div title="Copiar link t.me"><CopyButton text={telegramUrl} /></div>
              <a href={telegramUrl} target="_blank" rel="noreferrer" title="Abrir no Telegram"
                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text">
                <ExternalLink size={13} />
              </a>
            </>
          )}
          {bot.status === 'offline' && (
            <button type="button" title="Reconectar" onClick={onOpen}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-warning hover:bg-surface-3 hover:text-text">
              <Webhook size={13} />
            </button>
          )}
          <button type="button" title="Configurar" onClick={onOpen}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text">
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Stats 2×2 grid (#4 revenue added) */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-border">
        <Stat label="Leads"     value={fmtNum(bot.leads)} />
        <Stat label="Vendas"    value={fmtNum(bot.sales)} />
        <Stat label="Conversão" value={bot.conversion > 0 ? fmtPct(bot.conversion) : '—'} />
        <Stat label="Receita"   value={bot.revenue > 0 ? fmtBRLdec(bot.revenue) : '—'} />
      </div>

      {/* CTA when no activity (#2) */}
      {!hasActivity && (
        <p className="mt-2 text-[11px] text-text-subtle leading-snug">
          Compartilhe o link do bot para capturar seus primeiros leads.
        </p>
      )}

      {/* Flow footer — clickable (#3) */}
      <div role="button" tabIndex={-1}
        onClick={e => { e.stopPropagation(); onOpenTab('flow') }}
        className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-[11.5px] hover:text-text transition-colors">
        <GitBranch size={12} className="text-text-subtle shrink-0" />
        {flow ? (
          <>
            <span className="text-text-subtle">Fluxo:</span>
            <span className="text-text font-medium truncate">{flow.name}</span>
          </>
        ) : (
          <span className="text-primary font-medium">+ Vincular fluxo</span>
        )}
        <ArrowUpRight size={11} className="ml-auto text-text-subtle group-hover:text-primary transition-colors shrink-0" />
      </div>
    </div>
  )
}

// ─── BotsList ──────────────────────────────────────────────────────────────────

const SORT_OPTIONS = ['Maior receita', 'Mais leads', 'Mais vendas', 'Alfabético', 'Status'] as const
type SortOption = typeof SORT_OPTIONS[number]

function sortBots(bots: BotData[], by: SortOption): BotData[] {
  return [...bots].sort((a, b) => {
    if (by === 'Maior receita') return b.revenue  - a.revenue
    if (by === 'Mais leads')   return b.leads    - a.leads
    if (by === 'Mais vendas')  return b.sales    - a.sales
    if (by === 'Alfabético')   return a.name.localeCompare(b.name, 'pt-BR')
    if (by === 'Status') {
      const order: Record<string, number> = { online: 0, offline: 1, paused: 2, banned: 3 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    }
    return 0
  })
}

export function BotsList({ bots, flows, onOpen, onOpenTab, onAddClick }: {
  bots: BotData[]; flows: FlowData[]
  onOpen: (id: string) => void
  onOpenTab: (id: string, tab: string) => void
  onAddClick: () => void
}) {
  const router = useRouter()
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('Todos os status')
  const [sortBy, setSortBy]   = useState<SortOption>(() => {
    if (typeof window === 'undefined') return 'Maior receita'
    return (localStorage.getItem('umbra_bots_sort') as SortOption | null) ?? 'Maior receita'
  })

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    localStorage.setItem('umbra_bots_sort', sortBy)
  }, [sortBy])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    return bots.filter(b => {
      if (q && !(b.name.toLowerCase().includes(q) || b.username.toLowerCase().includes(q))) return false
      if (statusF === 'Online'   && b.status !== 'online')  return false
      if (statusF === 'Offline'  && b.status !== 'offline') return false
      if (statusF === 'Banidos'  && b.status !== 'banned')  return false
      if (statusF === 'Pausados' && b.status !== 'paused')  return false
      return true
    })
  }, [bots, deferredSearch, statusF])

  const sorted = useMemo(() => sortBots(filtered, sortBy), [filtered, sortBy])

  const totals = useMemo(() => ({
    online:       bots.filter(b => b.status === 'online').length,
    offline:      bots.filter(b => b.status === 'offline').length,
    banned:       bots.filter(b => b.status === 'banned').length,
    totalLeads:   bots.reduce((s, b) => s + b.leads,   0),
    totalSales:   bots.reduce((s, b) => s + b.sales,   0),
    totalRevenue: bots.reduce((s, b) => s + b.revenue, 0),
  }), [bots])

  const hasFilters = search.trim() !== '' || statusF !== 'Todos os status'

  return (
    <>
      <PageHeader
        title="Gerenciar bots"
        subtitle={`${bots.length} ${bots.length === 1 ? 'bot conectado' : 'bots conectados'} · ${fmtNum(totals.totalLeads)} leads · ${fmtBRLdec(totals.totalRevenue)} em receita`}
        actions={
          <>
            <Btn variant="secondary" onClick={() => router.push('/dashboard/docs')}><BookOpen size={14} /> Documentação</Btn>
            <Btn variant="primary" onClick={onAddClick}><Plus size={14} /> Conectar novo bot</Btn>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SummaryChip dot="bg-[color:var(--success)]" label="Online"  count={totals.online}  pulse />
        <SummaryChip dot="bg-[color:var(--warning)]" label="Offline" count={totals.offline} />
        <SummaryChip dot="bg-[color:var(--danger)]"  label="Banidos" count={totals.banned}  />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bot por nome ou @username…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
        <Dropdown label="Status" value={statusF} options={['Todos os status', 'Online', 'Offline', 'Banidos', 'Pausados']} onChange={setStatusF} />
        <Dropdown label="Ordenar" value={sortBy} options={[...SORT_OPTIONS]} onChange={v => setSortBy(v as SortOption)} />
        {hasFilters && (
          <button type="button" onClick={() => { setSearch(''); setStatusF('Todos os status') }}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2">
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {bots.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-xl py-14 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4"><Bot size={20} /></div>
          <div className="text-[14px] font-semibold text-text">Nenhum bot conectado</div>
          <div className="text-[12.5px] text-text-muted mt-1 max-w-sm">Conecte seu primeiro bot do Telegram para começar a receber leads e vendas.</div>
          <Btn variant="primary" onClick={onAddClick} className="mt-4"><Plus size={14} /> Conectar novo bot</Btn>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-xl py-10 px-6 flex flex-col items-center justify-center text-center">
          <div className="text-[14px] font-semibold text-text">Nenhum bot encontrado</div>
          <div className="text-[12.5px] text-text-muted mt-1">Ajuste os filtros ou limpe a busca.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map(b => (
            <BotCard key={b.id} bot={b} flows={flows}
              onOpen={() => onOpen(b.id)}
              onOpenTab={tab => onOpenTab(b.id, tab)}
            />
          ))}
          <button type="button" onClick={onAddClick} className="group min-h-[200px] bg-surface-2/30 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-primary hover:bg-primary-soft/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3 group-hover:border-primary group-hover:text-primary transition-colors"><Plus size={20} /></div>
            <div className="text-[13px] font-semibold text-text">Conectar novo bot</div>
            <div className="text-[11.5px] text-text-muted mt-1 max-w-[200px] leading-snug">Cole o token do BotFather para começar.</div>
          </button>
        </div>
      )}
    </>
  )
}
