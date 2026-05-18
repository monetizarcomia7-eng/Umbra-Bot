'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Bot, MoreHorizontal, Search, X, ArrowUpRight, Minus, Plus, BookOpen,
  ChevronLeft, ExternalLink, Pause, Play, Settings, MessageSquare, GitBranch,
  Eye, EyeOff, Copy, Check, AlertCircle, ChevronDown, ChevronRight,
  ShieldCheck, Webhook, Trash2, Save, Users, ShoppingBag, Target,
  CircleDollarSign, Info, ArrowLeft, CheckCircle2, Rocket, ArrowUp,
  ShoppingCart, Megaphone, Sparkles, LifeBuoy,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BotFlow {
  id: string
  name: string
  icon: string
  desc: string
}

interface BotData {
  id: string
  name: string
  username: string
  status: 'online' | 'offline' | 'banned' | 'paused'
  leads: number
  sales: number
  conversion: number
  revenue: number
  activeFlowId: string | null
  color: string
  telegramId: string
  token: string
  welcomeMessage: string
  fallbackMessage: string
  description: string
  webhookUrl: string
  lastSync: number
  addedAt: number
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRLdec(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }
function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function fmtDateTime(d: number) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

// ─── Flow icon lookup ──────────────────────────────────────────────────────────

const FLOW_ICON_MAP: Record<string, React.ElementType> = {
  'rocket': Rocket, 'arrow-up': ArrowUp, 'shopping-cart': ShoppingCart,
  'megaphone': Megaphone, 'sparkles': Sparkles, 'life-buoy': LifeBuoy, 'minus': Minus,
}
function FlowIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Ic = FLOW_ICON_MAP[name] ?? Minus
  return <Ic size={size} />
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const NOW_BOTS = new Date('2026-05-18T15:30:00').getTime()

const FLOWS: BotFlow[] = [
  { id: 'flow_001', name: 'Funil VIP — Lançamento',   icon: 'rocket',        desc: 'Captura de leads, qualificação e venda da mentoria anual.' },
  { id: 'flow_002', name: 'Upsell pós-compra',         icon: 'arrow-up',      desc: 'Oferta de produtos complementares após a primeira venda.' },
  { id: 'flow_003', name: 'Carrinho abandonado 24h',   icon: 'shopping-cart', desc: 'Recupera leads que iniciaram o checkout mas não concluíram.' },
  { id: 'flow_004', name: 'Remarketing 7 dias',        icon: 'megaphone',     desc: 'Sequência de mensagens para reativar quem não comprou em 7 dias.' },
  { id: 'flow_005', name: 'Bem-vindo + Oferta',        icon: 'sparkles',      desc: 'Fluxo padrão de boas-vindas com oferta de entrada.' },
  { id: 'flow_006', name: 'Suporte automático',        icon: 'life-buoy',     desc: 'Atendimento por palavras-chave + escalonamento humano.' },
]

const MOCK_BOTS: BotData[] = [
  {
    id: 'bot_001', name: 'Mentoria VIP Premium', username: '@mentoria_vip_bot', status: 'online',
    leads: 8420, sales: 487, conversion: 5.78, revenue: 142480,
    activeFlowId: 'flow_001', color: 'var(--primary)', telegramId: '7234567890',
    token: '7234567890:ABCdefGHIjklMNOpqrSTUVwxyz0123456789',
    welcomeMessage: 'Olá {nome}! Bem-vindo à Mentoria VIP Premium. Estamos felizes em ter você aqui. Digite /menu para ver as opções disponíveis.',
    fallbackMessage: 'Não entendi sua mensagem. Você pode escolher uma das opções do menu ou digitar /menu para ver tudo.',
    description: 'Bot principal de vendas da mentoria premium anual.',
    webhookUrl: 'umbra.bot/webhook/mentoria-vip-3a2f1b',
    lastSync: NOW_BOTS - 2 * 60 * 1000, addedAt: new Date('2025-09-12').getTime(),
  },
  {
    id: 'bot_002', name: 'Lançamento Black Friday', username: '@lancamento_black_bot', status: 'banned',
    leads: 4280, sales: 312, conversion: 7.29, revenue: 92616,
    activeFlowId: 'flow_005', color: 'var(--danger)', telegramId: '8234567891',
    token: '8234567891:DEFghiJKLmnoPQRstuVWXyz0123456789ABCDE',
    welcomeMessage: 'Bem-vindo ao lançamento exclusivo! Vagas limitadas, garanta a sua antes que esgote.',
    fallbackMessage: 'Por favor, escolha uma das opções acima.',
    description: 'Bot temporário para a campanha Black Friday 2025.',
    webhookUrl: 'umbra.bot/webhook/lancamento-black-9c8e7f',
    lastSync: NOW_BOTS - 65 * 60 * 1000, addedAt: new Date('2025-11-08').getTime(),
  },
  {
    id: 'bot_003', name: 'Upsell Pós-compra', username: '@upsell_pos_bot', status: 'online',
    leads: 1284, sales: 198, conversion: 15.42, revenue: 38606,
    activeFlowId: 'flow_002', color: 'var(--success)', telegramId: '9234567892',
    token: '9234567892:GHIjklMNOpqrSTUVwxyz0123456789ABCDEFGH',
    welcomeMessage: 'Olá novamente, {nome}! Vimos que você adquiriu {produto} recentemente. Temos uma oferta especial pra você.',
    fallbackMessage: 'Não entendi. Toque em uma das opções para continuar.',
    description: 'Dispara fluxos de upsell automaticamente após cada nova venda.',
    webhookUrl: 'umbra.bot/webhook/upsell-pos-5d4c3b',
    lastSync: NOW_BOTS - 30 * 1000, addedAt: new Date('2025-10-20').getTime(),
  },
  {
    id: 'bot_004', name: 'Vendas Curso 90 dias', username: '@vendas_curso_bot', status: 'online',
    leads: 6720, sales: 412, conversion: 6.13, revenue: 60564,
    activeFlowId: 'flow_003', color: 'var(--warning)', telegramId: '1034567893',
    token: '1034567893:JKLmnoPQRstuVWXyz0123456789ABCDEFGHIJK',
    welcomeMessage: 'Que bom te ver por aqui, {nome}! Quer transformar sua rotina em 90 dias? Digite COMEÇAR para iniciar.',
    fallbackMessage: 'Digite COMEÇAR para iniciar ou /menu para ver as opções.',
    description: 'Vendas do curso intensivo de 90 dias.',
    webhookUrl: 'umbra.bot/webhook/vendas-curso-1f2g3h',
    lastSync: NOW_BOTS - 5 * 60 * 1000, addedAt: new Date('2025-08-15').getTime(),
  },
  {
    id: 'bot_005', name: 'Suporte Premium', username: '@suporte_premium_bot', status: 'offline',
    leads: 542, sales: 0, conversion: 0, revenue: 0,
    activeFlowId: 'flow_006', color: 'oklch(0.62 0.16 200)', telegramId: '1134567894',
    token: '1134567894:MNOpqrSTUVwxyz0123456789ABCDEFGHIJKLMN',
    welcomeMessage: 'Olá, {nome}! Sou o assistente de suporte. Em que posso te ajudar hoje?',
    fallbackMessage: 'Em alguns instantes um humano vai te atender. Sua mensagem foi registrada.',
    description: 'Atendimento automático com escalonamento para o time.',
    webhookUrl: 'umbra.bot/webhook/suporte-prem-7h8i9j',
    lastSync: NOW_BOTS - 14 * 60 * 1000, addedAt: new Date('2026-01-22').getTime(),
  },
]

const STATUS_CONFIG = {
  online:  { label: 'Online',   tone: 'success', dot: 'bg-[color:var(--success)]', pulse: true  },
  offline: { label: 'Offline',  tone: 'warning', dot: 'bg-[color:var(--warning)]', pulse: false },
  banned:  { label: 'Banido',   tone: 'danger',  dot: 'bg-[color:var(--danger)]',  pulse: false },
  paused:  { label: 'Pausado',  tone: 'muted',   dot: 'bg-text-subtle',            pulse: false },
} as const

const MESSAGE_VARS = ['nome', 'bot', 'produto', 'valor', 'data']

// ─── UI primitives ─────────────────────────────────────────────────────────────

function Card({ children, title, subtitle, noPadding }: { children: React.ReactNode; title?: string; subtitle?: string; noPadding?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-xl">
      {(title) && (
        <div className="px-5 py-4 border-b border-border">
          {title && <div className="text-[14px] font-semibold text-text">{title}</div>}
          {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; onClick?: () => void; disabled?: boolean; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger hover:bg-danger/20',
  }[variant]
  return <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}
function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>{children}</span>
}

function Spinner() {
  return <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
}

function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <span className="truncate max-w-[140px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[170px]">
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }} className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}>
              {o === value && <Check size={12} />}
              <span className={o !== value ? 'pl-5' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title?: string | null; subtitle?: string | null
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface border border-border rounded-2xl shadow-xl w-full ${w} max-h-[90vh] flex flex-col`}>
        {title !== null && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
            <div>
              {title && <div className="text-[15px] font-semibold text-text">{title}</div>}
              {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text shrink-0">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; Icon: React.ElementType }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-0.5 border-b border-border">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none border-b-2 -mb-px ${
            active === t.id ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text hover:border-border'
          }`}>
          <t.Icon size={14} />
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function doCopy() {
    try { navigator.clipboard?.writeText(text) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={doCopy} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text" title="Copiar">
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  )
}

// ─── ReadOnlyRow ───────────────────────────────────────────────────────────────

function ReadOnlyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{label}</div>
      <div className={`text-[12.5px] text-text mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

// ─── Bot Avatar ────────────────────────────────────────────────────────────────

function BotAvatar({ bot, size = 48 }: { bot: BotData; size?: number }) {
  const st = STATUS_CONFIG[bot.status]
  const dotSize = Math.round(size * 0.28)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-xl flex items-center justify-center text-white" style={{ background: bot.color }}>
        <Bot size={Math.round(size * 0.45)} />
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-surface ${st.dot}`} style={{ width: dotSize, height: dotSize }}>
        {st.pulse && <span className={`absolute inset-0 rounded-full ${st.dot} animate-ping opacity-50`} />}
      </span>
    </div>
  )
}

// ─── Stat ──────────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[16px] font-semibold text-text leading-none tracking-tight">{value}</div>
      <div className="text-[10.5px] text-text-muted mt-1 leading-tight">{label}</div>
    </div>
  )
}

// ─── SummaryChip ───────────────────────────────────────────────────────────────

function SummaryChip({ dot, label, count, pulse }: { dot: string; label: string; count: number; pulse?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 h-8 px-2.5 bg-surface border border-border rounded-lg text-[12px]">
      <span className={`relative w-2 h-2 rounded-full ${dot}`}>
        {pulse && count > 0 && <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-60`} />}
      </span>
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text">{count}</span>
    </div>
  )
}

// ─── BotCard ───────────────────────────────────────────────────────────────────

function BotCard({ bot, onOpen }: { bot: BotData; onOpen: () => void }) {
  const st = STATUS_CONFIG[bot.status]
  const flow = FLOWS.find(f => f.id === bot.activeFlowId)
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group relative bg-surface border border-border rounded-xl p-5 text-left hover:border-border-strong transition-colors w-full cursor-pointer"
    >
      <div className="flex items-start gap-3.5">
        <BotAvatar bot={bot} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={st.tone}>{st.label}</Badge>
            <span className="text-[10.5px] text-text-subtle">{bot.username}</span>
          </div>
          <h3 className="text-[14px] font-semibold text-text leading-snug mt-1.5 truncate">{bot.name}</h3>
        </div>
        <button onClick={e => e.stopPropagation()} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
        <Stat label="Leads"     value={fmtNum(bot.leads)} />
        <Stat label="Vendas"    value={fmtNum(bot.sales)} />
        <Stat label="Conversão" value={bot.conversion > 0 ? fmtPct(bot.conversion) : '—'} />
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-[11.5px] text-text-muted">
        <span className="text-text-subtle shrink-0"><FlowIcon name={flow ? flow.icon : 'minus'} size={12} /></span>
        <span className="text-text-subtle">Fluxo:</span>
        {flow ? <span className="text-text font-medium truncate">{flow.name}</span> : <span className="text-text-subtle italic">nenhum</span>}
        <ArrowUpRight size={11} className="ml-auto text-text-subtle group-hover:text-primary transition-colors" />
      </div>
    </div>
  )
}

// ─── BotsList ──────────────────────────────────────────────────────────────────

function BotsList({ bots, onOpen, onAddClick }: { bots: BotData[]; onOpen: (id: string) => void; onAddClick: () => void }) {
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('Todos os status')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bots.filter(b => {
      if (q && !(b.name.toLowerCase().includes(q) || b.username.toLowerCase().includes(q))) return false
      if (statusF === 'Online'   && b.status !== 'online')  return false
      if (statusF === 'Offline'  && b.status !== 'offline') return false
      if (statusF === 'Banidos'  && b.status !== 'banned')  return false
      if (statusF === 'Pausados' && b.status !== 'paused')  return false
      return true
    })
  }, [bots, search, statusF])

  const totals = useMemo(() => ({
    online:     bots.filter(b => b.status === 'online').length,
    offline:    bots.filter(b => b.status === 'offline').length,
    banned:     bots.filter(b => b.status === 'banned').length,
    totalLeads: bots.reduce((s, b) => s + b.leads, 0),
    totalSales: bots.reduce((s, b) => s + b.sales, 0),
  }), [bots])

  return (
    <>
      <PageHeader
        title="Gerenciar bots"
        subtitle={`${bots.length} bots conectados · ${fmtNum(totals.totalLeads)} leads · ${fmtNum(totals.totalSales)} vendas`}
        actions={
          <>
            <Btn variant="secondary" onClick={() => {}}><BookOpen size={14} /> Documentação</Btn>
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
        {(search || statusF !== 'Todos os status') && (
          <button onClick={() => { setSearch(''); setStatusF('Todos os status') }} className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2">
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-xl py-14 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4"><Bot size={20} /></div>
          <div className="text-[14px] font-semibold text-text">Nenhum bot encontrado</div>
          <div className="text-[12.5px] text-text-muted mt-1 max-w-sm">Conecte seu primeiro bot ou ajuste os filtros.</div>
          <Btn variant="primary" onClick={onAddClick} className="mt-4"><Plus size={14} /> Conectar novo bot</Btn>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(b => <BotCard key={b.id} bot={b} onOpen={() => onOpen(b.id)} />)}
          <button onClick={onAddClick} className="group min-h-[200px] bg-surface-2/30 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-primary hover:bg-primary-soft/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3 group-hover:border-primary group-hover:text-primary transition-colors"><Plus size={20} /></div>
            <div className="text-[13px] font-semibold text-text">Conectar novo bot</div>
            <div className="text-[11.5px] text-text-muted mt-1 max-w-[200px] leading-snug">Cole o token do BotFather para começar.</div>
          </button>
        </div>
      )}
    </>
  )
}

// ─── Add Bot Modal ─────────────────────────────────────────────────────────────

function AddBotModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (bot: BotData) => void }) {
  const [step, setStep]           = useState<'token' | 'confirm' | 'success'>('token')
  const [token, setToken]         = useState('')
  const [error, setError]         = useState('')
  const [validating, setValidating] = useState(false)
  const [foundBot, setFoundBot]   = useState<{ username: string; firstName: string; telegramId: string } | null>(null)
  const [editedName, setEditedName] = useState('')
  const [linkFlow, setLinkFlow]   = useState('Nenhum')
  const [showHelp, setShowHelp]   = useState(false)
  const [adding, setAdding]       = useState(false)

  useEffect(() => {
    if (open) { setStep('token'); setToken(''); setError(''); setValidating(false); setFoundBot(null); setEditedName(''); setLinkFlow('Nenhum'); setShowHelp(false); setAdding(false) }
  }, [open])

  function validate() {
    setError('')
    if (!/^\d{8,12}:[A-Za-z0-9_-]{30,}$/.test(token.trim())) { setError('Formato do token inválido. Verifique se copiou o token completo do BotFather.'); return }
    setValidating(true)
    setTimeout(() => {
      const fakeUsernames = ['@meu_bot_oficial', '@vendas_promo_bot', '@conteudo_pro_bot', '@black_2026_bot']
      const fakeNames     = ['Meu Bot Oficial', 'Vendas Promo', 'Conteúdo Pro', 'Black 2026']
      const idx = Math.abs(token.charCodeAt(token.length - 1)) % fakeUsernames.length
      setFoundBot({ username: fakeUsernames[idx], firstName: fakeNames[idx], telegramId: token.split(':')[0] })
      setEditedName(fakeNames[idx])
      setValidating(false)
      setStep('confirm')
    }, 1100)
  }

  function addBot() {
    if (!foundBot) return
    setAdding(true)
    setTimeout(async () => {
      const flowId = linkFlow === 'Nenhum' ? null : (FLOWS.find(f => f.name === linkFlow)?.id ?? null)
      const slug = editedName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const newBot: BotData = {
        id: 'bot_' + Date.now(),
        name: editedName,
        username: foundBot.username,
        status: 'online',
        leads: 0, sales: 0, conversion: 0, revenue: 0,
        activeFlowId: flowId,
        color: 'var(--primary)',
        telegramId: foundBot.telegramId,
        token,
        welcomeMessage: 'Olá {nome}! Bem-vindo. Em que posso te ajudar?',
        fallbackMessage: 'Não entendi sua mensagem. Digite /menu para ver as opções.',
        description: '',
        webhookUrl: 'umbra.bot/webhook/' + slug + '-' + Math.random().toString(36).slice(2, 8),
        lastSync: Date.now(),
        addedAt: Date.now(),
      }

      try {
        const supabase = createClient()
        await supabase.from('bots').insert({
          name: newBot.name, username: newBot.username, status: newBot.status, leads: 0, sales: 0,
          conversion: 0, revenue: 0, color: newBot.color, telegram_id: newBot.telegramId,
          webhook_url: newBot.webhookUrl, description: '', welcome_message: newBot.welcomeMessage,
          fallback_message: newBot.fallbackMessage,
        })
      } catch (_) {}

      onAdded(newBot)
      setAdding(false)
      setStep('success')
    }, 900)
  }

  const tokenValidShape = /^\d{8,12}:[A-Za-z0-9_-]{30,}$/.test(token.trim())
  const webhookPreview = foundBot ? `umbra.bot/webhook/${foundBot.username.replace('@', '')}-${Math.random().toString(36).slice(2, 8)}` : ''

  return (
    <Modal open={open} onClose={onClose}
      title={step === 'success' ? null : 'Conectar novo bot'}
      subtitle={step === 'token' ? 'Cole o token gerado pelo BotFather no Telegram.' : null}
      footer={
        step === 'token' ? (
          <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" disabled={!tokenValidShape || validating} onClick={validate}>
              {validating ? <><Spinner /> Validando…</> : 'Validar token'}
            </Btn></>
        ) : step === 'confirm' ? (
          <><Btn variant="secondary" onClick={() => setStep('token')}><ArrowLeft size={14} /> Voltar</Btn>
            <Btn variant="primary" onClick={addBot} disabled={adding || !editedName.trim()}>
              {adding ? <><Spinner /> Conectando…</> : 'Adicionar bot'}
            </Btn></>
        ) : (
          <Btn variant="primary" onClick={onClose}>Concluir</Btn>
        )
      }
    >
      {step === 'token' && (
        <div className="space-y-3.5">
          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Token do bot</label>
            <input type="text" value={token} onChange={e => setToken(e.target.value)}
              placeholder="7234567890:ABCdefGHIjklMNOpqrSTU..." autoFocus
              className={`w-full h-11 px-3 bg-surface border rounded-lg text-[12.5px] font-mono text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 ${error ? 'border-danger focus:ring-danger/25' : 'border-border focus:ring-primary/30 focus:border-primary/50'}`}
            />
            {error && (
              <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-danger">
                <AlertCircle size={12} /><span>{error}</span>
              </div>
            )}
          </div>

          <button onClick={() => setShowHelp(s => !s)} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1">
            {showHelp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Como obter o token do BotFather?
          </button>

          {showHelp && (
            <div className="bg-surface-2/50 border border-border rounded-lg p-3.5 text-[12px] text-text-muted leading-relaxed">
              <ol className="space-y-2 list-decimal list-inside marker:text-text-subtle">
                <li>Abra o <strong className="text-text">@BotFather</strong> no Telegram.</li>
                <li>Envie <code className="bg-surface-3 px-1 rounded font-mono text-[11px]">/newbot</code> e siga as instruções para criar o bot.</li>
                <li>Copie o token completo (formato <code className="bg-surface-3 px-1 rounded font-mono text-[11px]">12345:ABCDEF...</code>) e cole acima.</li>
                <li>O Umbra Bot configura o webhook automaticamente — você não precisa fazer mais nada no BotFather.</li>
              </ol>
            </div>
          )}

          <div className="flex items-start gap-2 bg-surface-2/40 border border-border rounded-lg p-3 text-[11.5px] text-text-muted">
            <ShieldCheck size={14} className="text-success mt-0.5 shrink-0" />
            <span>Seu token é armazenado criptografado. Você pode revogá-lo a qualquer momento pelo BotFather.</span>
          </div>
        </div>
      )}

      {step === 'confirm' && foundBot && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-success-soft border border-success/30 rounded-lg">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0"><Bot size={20} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-success flex items-center gap-1">
                <Check size={11} /> Bot encontrado
              </div>
              <div className="text-[13.5px] font-semibold text-text mt-0.5">{foundBot.firstName}</div>
              <div className="text-[11.5px] text-text-muted">{foundBot.username} · ID {foundBot.telegramId}</div>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome no Umbra Bot</label>
            <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
            <div className="text-[11px] text-text-muted mt-1">Usado apenas internamente — não muda o nome do bot no Telegram.</div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Vincular a um fluxo (opcional)</label>
            <Dropdown label="Fluxo" value={linkFlow} options={['Nenhum', ...FLOWS.map(f => f.name)]} onChange={setLinkFlow} />
          </div>

          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-text">
              <Webhook size={13} className="text-success" /> Webhook será configurado automaticamente
            </div>
            <div className="text-[11px] text-text-muted mt-1.5 font-mono">{webhookPreview}</div>
          </div>
        </div>
      )}

      {step === 'success' && foundBot && (
        <div className="text-center py-6">
          <div className="relative w-14 h-14 mx-auto rounded-full bg-success-soft text-success flex items-center justify-center mb-4">
            <Check size={26} />
            <span className="absolute inset-0 rounded-full border border-success/40 animate-ping opacity-50" />
          </div>
          <h3 className="text-[16px] font-semibold text-text">Bot conectado</h3>
          <p className="text-[12.5px] text-text-muted mt-1.5">
            <span className="text-text font-medium">{foundBot.username}</span> está online e pronto para receber mensagens.
          </p>
        </div>
      )}
    </Modal>
  )
}

// ─── TextareaWithVars ─────────────────────────────────────────────────────────

function TextareaWithVars({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  function insertVar(v: string) {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart ?? value.length
    const end   = ta.selectionEnd   ?? value.length
    const insert = `{${v}}`
    const next = value.substring(0, start) + insert + value.substring(end)
    onChange(next)
    requestAnimationFrame(() => { ta.focus(); const pos = start + insert.length; ta.setSelectionRange(pos, pos) })
  }
  return (
    <>
      <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed" />
      <div className="mt-2 flex flex-wrap gap-1 items-center text-[11px]">
        <span className="text-text-muted">Inserir variável:</span>
        {MESSAGE_VARS.map(v => (
          <button key={v} onClick={() => insertVar(v)} type="button"
            className="px-1.5 h-5 bg-surface-2 border border-border rounded font-mono text-[10.5px] text-text-muted hover:text-text hover:bg-surface-3">
            {`{${v}}`}
          </button>
        ))}
      </div>
    </>
  )
}

// ─── ChatBubble ────────────────────────────────────────────────────────────────

function ChatBubble({ text, incoming, placeholder }: { text: string; incoming?: boolean; placeholder?: boolean }) {
  return (
    <div className={`flex ${incoming ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[260px] text-[12px] leading-snug px-3 py-2 rounded-2xl whitespace-pre-wrap ${incoming ? 'bg-primary text-primary-fg rounded-br-sm' : 'bg-surface-2 text-text rounded-bl-sm'} ${placeholder ? 'opacity-50 italic' : ''}`}>
        {text}
      </div>
    </div>
  )
}

// ─── GeneralTab ────────────────────────────────────────────────────────────────

function GeneralTab({ bot, onUpdate, onDelete }: { bot: BotData; onUpdate: (p: Partial<BotData>) => void; onDelete: (id: string) => void }) {
  const [name, setName]           = useState(bot.name)
  const [description, setDesc]    = useState(bot.description || '')
  const [showToken, setShowToken] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const dirty = name !== bot.name || description !== (bot.description || '')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="space-y-4">
        <Card title="Informações básicas" subtitle="Dados internos do bot no Umbra Bot">
          <div className="space-y-3.5 mt-1">
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Descrição (interno)</label>
              <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="Curta descrição do propósito deste bot…"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px] pt-2 border-t border-border">
              <ReadOnlyRow label="@Username" value={bot.username} mono />
              <ReadOnlyRow label="Telegram ID" value={bot.telegramId} mono />
              <ReadOnlyRow label="Adicionado em" value={fmtDate(bot.addedAt)} />
              <ReadOnlyRow label="Última sincronização" value={fmtDateTime(bot.lastSync)} />
            </div>
            {dirty && (
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Btn variant="ghost" size="sm" onClick={() => { setName(bot.name); setDesc(bot.description || '') }}>Descartar</Btn>
                <Btn variant="primary" size="sm" onClick={() => onUpdate({ name, description })}><Save size={13} /> Salvar alterações</Btn>
              </div>
            )}
          </div>
        </Card>

        <Card title="Token & Webhook" subtitle="Credenciais técnicas do bot">
          <div className="space-y-3.5 mt-1">
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Token do BotFather</label>
              <div className="relative">
                <input type={showToken ? 'text' : 'password'} value={bot.token} readOnly
                  className="w-full h-10 pl-3 pr-20 bg-surface-2 border border-border rounded-lg text-[12px] font-mono text-text-muted" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button onClick={() => setShowToken(s => !s)} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text">
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <CopyButton text={bot.token} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Webhook URL</label>
              <div className="relative">
                <input type="text" value={'https://' + bot.webhookUrl} readOnly
                  className="w-full h-10 pl-3 pr-12 bg-surface-2 border border-border rounded-lg text-[12px] font-mono text-text-muted" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2"><CopyButton text={'https://' + bot.webhookUrl} /></div>
              </div>
              <div className="text-[11px] text-text-muted mt-1">Atualizado automaticamente quando você reconecta o bot.</div>
            </div>
          </div>
        </Card>

        <div className="bg-surface border-2 border-danger/30 rounded-xl p-5">
          <div className="text-[14px] font-semibold text-danger">Zona de perigo</div>
          <div className="text-[12px] text-text-muted mt-1 max-w-md">Remover o bot desconecta o webhook e arquiva todas as mensagens em fila. Esta ação não pode ser desfeita.</div>
          <div className="mt-4">
            {confirmDel ? (
              <div className="flex items-center gap-2">
                <Btn variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Btn>
                <Btn variant="danger" size="sm" onClick={() => onDelete(bot.id)}><Trash2 size={13} /> Sim, remover bot</Btn>
              </div>
            ) : (
              <Btn variant="secondary" size="sm" onClick={() => setConfirmDel(true)}><Trash2 size={13} /> Remover este bot</Btn>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Card title="Status" subtitle="Controle a operação do bot">
          <div className="space-y-3 mt-1">
            <div className={`p-3 rounded-lg border ${bot.status === 'online' ? 'bg-success-soft border-success/20' : bot.status === 'banned' ? 'bg-danger-soft border-danger/20' : 'bg-surface-2 border-border'}`}>
              <div className="flex items-center gap-2">
                <span className={`relative w-2 h-2 rounded-full ${STATUS_CONFIG[bot.status].dot}`}>
                  {STATUS_CONFIG[bot.status].pulse && <span className={`absolute inset-0 rounded-full ${STATUS_CONFIG[bot.status].dot} animate-ping opacity-60`} />}
                </span>
                <span className="text-[13px] font-semibold text-text">{STATUS_CONFIG[bot.status].label}</span>
              </div>
              <div className="text-[11.5px] text-text-muted mt-1.5">
                {bot.status === 'online'  && 'Recebendo e respondendo mensagens normalmente.'}
                {bot.status === 'offline' && 'Sem heartbeat há alguns minutos. Tentando reconectar.'}
                {bot.status === 'banned'  && 'Bot banido pelo Telegram. Substitua para retomar a operação.'}
                {bot.status === 'paused'  && 'Pausado manualmente. Mensagens em fila não estão sendo entregues.'}
              </div>
            </div>
            <div className="text-[11.5px] text-text-muted">Última sincronização: <span className="text-text">{fmtDateTime(bot.lastSync)}</span></div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── MessagesTab ───────────────────────────────────────────────────────────────

function MessagesTab({ bot, onUpdate }: { bot: BotData; onUpdate: (p: Partial<BotData>) => void }) {
  const [welcome,  setWelcome]  = useState(bot.welcomeMessage  || '')
  const [fallback, setFallback] = useState(bot.fallbackMessage || '')
  const dirty = welcome !== bot.welcomeMessage || fallback !== bot.fallbackMessage

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="space-y-4">
        <Card title="Mensagem de boas-vindas" subtitle="Enviada automaticamente quando um usuário inicia conversa com o bot pela primeira vez.">
          <TextareaWithVars value={welcome} onChange={setWelcome} rows={5} placeholder="Olá {nome}! Bem-vindo…" />
        </Card>
        <Card title="Mensagem fallback" subtitle="Resposta automática quando o bot não entende a mensagem do usuário.">
          <TextareaWithVars value={fallback} onChange={setFallback} rows={4} placeholder="Não entendi sua mensagem…" />
        </Card>
        {dirty && (
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => { setWelcome(bot.welcomeMessage || ''); setFallback(bot.fallbackMessage || '') }}>Descartar</Btn>
            <Btn variant="primary" onClick={() => onUpdate({ welcomeMessage: welcome, fallbackMessage: fallback })}><Save size={13} /> Salvar alterações</Btn>
          </div>
        )}
      </div>

      <div>
        <Card title="Pré-visualização" subtitle="Como aparece no Telegram">
          <div className="mt-2 space-y-2.5">
            <ChatBubble text={welcome.replace(/\{nome\}/g, 'João').replace(/\{bot\}/g, bot.name) || 'Mensagem de boas-vindas aparece aqui…'} placeholder={!welcome} />
          </div>
          <div className="mt-4 pt-3 border-t border-border space-y-2.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Quando não entende</div>
            <ChatBubble incoming text="?? quanto custa" />
            <ChatBubble text={fallback.replace(/\{nome\}/g, 'João') || 'Mensagem de fallback aparece aqui…'} placeholder={!fallback} />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── FlowTab ───────────────────────────────────────────────────────────────────

function FlowTab({ bot, onUpdate }: { bot: BotData; onUpdate: (p: Partial<BotData>) => void }) {
  const current = FLOWS.find(f => f.id === bot.activeFlowId)
  const others  = FLOWS.filter(f => f.id !== bot.activeFlowId)

  return (
    <div className="space-y-4">
      <Card title="Fluxo ativo" subtitle="Fluxo de mensagens executado quando o usuário interage com o bot">
        {current ? (
          <div className="mt-2 flex items-start gap-4 p-4 bg-primary-soft/40 border border-primary/20 rounded-lg">
            <div className="w-11 h-11 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
              <FlowIcon name={current.icon} size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-text">{current.name}</div>
              <div className="text-[12px] text-text-muted mt-0.5 leading-relaxed">{current.desc}</div>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1"><Users size={11} /> {fmtNum(bot.leads)} leads</span>
                <span className="inline-flex items-center gap-1"><ShoppingBag size={11} /> {fmtNum(bot.sales)} vendas</span>
                <span className="inline-flex items-center gap-1"><Target size={11} /> conv. {fmtPct(bot.conversion)}</span>
                <span className="inline-flex items-center gap-1"><CircleDollarSign size={11} /> {fmtBRLdec(bot.revenue)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Btn variant="secondary" size="sm"><ExternalLink size={13} /> Abrir editor</Btn>
              <Btn variant="ghost" size="sm" onClick={() => onUpdate({ activeFlowId: null })}><X size={13} /> Desvincular</Btn>
            </div>
          </div>
        ) : (
          <div className="mt-2 p-4 bg-surface-2/40 border border-dashed border-border rounded-lg flex items-center gap-3 text-[12.5px] text-text-muted">
            <Info size={14} /> Nenhum fluxo vinculado a este bot. Selecione um abaixo para começar.
          </div>
        )}
      </Card>

      <Card title="Outros fluxos disponíveis" subtitle="Clique para vincular ao bot">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {others.map(f => (
            <button key={f.id} onClick={() => onUpdate({ activeFlowId: f.id })}
              className="text-left p-3 bg-surface border border-border rounded-lg hover:border-primary hover:bg-primary-soft/20 transition-colors group">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-surface-2 text-text-muted group-hover:bg-primary-soft group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                  <FlowIcon name={f.icon} size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-text truncate">{f.name}</div>
                  <div className="text-[11px] text-text-muted truncate">{f.desc}</div>
                </div>
                <ArrowUpRight size={12} className="text-text-subtle group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── BotConfig ─────────────────────────────────────────────────────────────────

function BotConfig({ bot, onBack, onUpdate, onDelete }: { bot: BotData; onBack: () => void; onUpdate: (p: Partial<BotData>) => void; onDelete: (id: string) => void }) {
  const [tab, setTab] = useState('geral')
  const TABS = [
    { id: 'geral',    label: 'Geral',            Icon: Settings     },
    { id: 'messages', label: 'Mensagens padrão', Icon: MessageSquare },
    { id: 'flow',     label: 'Fluxo vinculado',  Icon: GitBranch     },
  ]

  return (
    <>
      <div className="-mt-1 mb-5">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text mb-4 px-1">
          <ChevronLeft size={14} /> Voltar para todos os bots
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <BotAvatar bot={bot} size={56} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight text-text leading-tight">{bot.name}</h1>
                <Badge tone={STATUS_CONFIG[bot.status].tone}>{STATUS_CONFIG[bot.status].label}</Badge>
              </div>
              <div className="text-[12.5px] text-text-muted mt-0.5">{bot.username} · ID {bot.telegramId} · Adicionado {fmtDate(bot.addedAt)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="secondary"><ExternalLink size={13} /> Ver no Telegram</Btn>
            {bot.status === 'online'  && <Btn variant="secondary" onClick={() => onUpdate({ status: 'paused' })}><Pause size={13} /> Pausar</Btn>}
            {bot.status === 'paused'  && <Btn variant="primary"   onClick={() => onUpdate({ status: 'online' })}><Play  size={13} /> Retomar</Btn>}
          </div>
        </div>
      </div>

      <div className="mb-5"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>

      {tab === 'geral'    && <GeneralTab  bot={bot} onUpdate={onUpdate} onDelete={onDelete} />}
      {tab === 'messages' && <MessagesTab bot={bot} onUpdate={onUpdate} />}
      {tab === 'flow'     && <FlowTab     bot={bot} onUpdate={onUpdate} />}
    </>
  )
}

// ─── BotsPage ──────────────────────────────────────────────────────────────────

export default function BotsPage() {
  const [bots, setBots]         = useState<BotData[]>(MOCK_BOTS)
  const [selectedId, setSelected] = useState<string | null>(null)
  const [addOpen, setAddOpen]   = useState(false)
  const [toast, setToast]       = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('bots').select('*').order('added_at', { ascending: false })
        if (!error && data && data.length > 0) {
          setBots(data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            name: r.name as string,
            username: r.username as string,
            status: (r.status as BotData['status']) ?? 'offline',
            leads: Number(r.leads ?? 0),
            sales: Number(r.sales ?? 0),
            conversion: Number(r.conversion ?? 0),
            revenue: Number(r.revenue ?? 0),
            activeFlowId: r.active_flow_id as string | null,
            color: (r.color as string) ?? 'var(--primary)',
            telegramId: r.telegram_id as string,
            token: r.token as string ?? '',
            welcomeMessage: (r.welcome_message as string) ?? '',
            fallbackMessage: (r.fallback_message as string) ?? '',
            description: (r.description as string) ?? '',
            webhookUrl: (r.webhook_url as string) ?? '',
            lastSync: r.last_sync ? new Date(r.last_sync as string).getTime() : Date.now(),
            addedAt: r.added_at ? new Date(r.added_at as string).getTime() : Date.now(),
          })))
        }
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const selected = bots.find(b => b.id === selectedId)

  async function updateBot(patch: Partial<BotData>) {
    if (!selectedId) return
    setBots(arr => arr.map(b => b.id === selectedId ? { ...b, ...patch } : b))
    setToast('Alterações salvas.')
    try {
      const supabase = createClient()
      const dbPatch: Record<string, unknown> = {}
      if (patch.name !== undefined) dbPatch.name = patch.name
      if (patch.description !== undefined) dbPatch.description = patch.description
      if (patch.status !== undefined) dbPatch.status = patch.status
      if (patch.welcomeMessage !== undefined) dbPatch.welcome_message = patch.welcomeMessage
      if (patch.fallbackMessage !== undefined) dbPatch.fallback_message = patch.fallbackMessage
      if (patch.activeFlowId !== undefined) dbPatch.active_flow_id = patch.activeFlowId
      if (Object.keys(dbPatch).length > 0) await supabase.from('bots').update(dbPatch).eq('id', selectedId)
    } catch (_) {}
  }

  async function deleteBot(id: string) {
    setBots(arr => arr.filter(b => b.id !== id))
    setSelected(null)
    setToast('Bot removido.')
    try { const supabase = createClient(); await supabase.from('bots').delete().eq('id', id) } catch (_) {}
  }

  function addBot(bot: BotData) {
    setBots(arr => [bot, ...arr])
    setToast(`Bot ${bot.username} conectado com sucesso.`)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <span className="inline-block w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {toast && (
        <div className="mb-3 flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3.5 py-2" style={{ boxShadow: 'var(--shadow-md)' }}>
          <CheckCircle2 size={15} className="text-success" />
          <div className="text-[12.5px] text-text">{toast}</div>
        </div>
      )}

      {selected ? (
        <BotConfig bot={selected} onBack={() => setSelected(null)} onUpdate={updateBot} onDelete={deleteBot} />
      ) : (
        <BotsList bots={bots} onOpen={setSelected} onAddClick={() => setAddOpen(true)} />
      )}

      <AddBotModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={addBot} />
    </DashboardLayout>
  )
}
