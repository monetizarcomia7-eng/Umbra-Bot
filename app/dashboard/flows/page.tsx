'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Plus, BookOpen, ChevronLeft, ChevronDown, Check, X, Trash2,
  ArrowUpRight, Zap, Maximize, Minus, Save, Rocket, Eye, GitBranch,
  MessageSquare, HelpCircle, MousePointerClick, Split, Clock,
  ShoppingBag, Tag, UserRound,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface NodeData {
  text?: string
  question?: string
  variable?: string
  options?: string[]
  operator?: string
  value?: string
  amount?: number
  unit?: string
  product?: string
  price?: number
  cta?: string
  action?: string
  tag?: string
  team?: string
  message?: string
}

interface FlowNodeType {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
}

interface FlowEdgeType {
  id: string
  source: string
  target: string
  sourceHandle?: number
  label?: string
}

interface FlowItem {
  id: string
  name: string
  bot: string
  botColor: string
  status: 'published' | 'draft'
  executions: number
  conversion: number
  updatedAt: number
  description: string
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRLdec(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' }
function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

// ─── Node definitions ──────────────────────────────────────────────────────────

const NODE_W = 220
const NODE_H = 96

interface NodeTypeDef {
  label: string
  Icon: React.ElementType
  color: string
  category: string
  description: string
  defaultData: NodeData
  outputs: number
}

const nodeTypes: Record<string, NodeTypeDef> = {
  message:   { label: 'Mensagem',   Icon: MessageSquare,    color: 'var(--primary)', category: 'Conversa',  description: 'Envia uma mensagem de texto ao usuário.',                         defaultData: { text: 'Sua mensagem aqui…' },                                     outputs: 1 },
  question:  { label: 'Pergunta',   Icon: HelpCircle,       color: 'var(--primary)', category: 'Conversa',  description: 'Faz uma pergunta e captura a resposta numa variável.',             defaultData: { question: 'Qual seu nome?', variable: 'nome' },                   outputs: 1 },
  buttons:   { label: 'Botões',     Icon: MousePointerClick, color: 'var(--primary)', category: 'Conversa', description: 'Mostra botões de escolha rápida. Cada botão é uma saída.',        defaultData: { text: 'Escolha uma opção:', options: ['Opção A', 'Opção B'] },    outputs: 2 },
  condition: { label: 'Condição',   Icon: Split,             color: 'var(--warning)', category: 'Lógica',   description: 'Bifurca o fluxo conforme uma variável (se/senão).',               defaultData: { variable: 'nome', operator: 'igual', value: '' },                 outputs: 2 },
  delay:     { label: 'Espera',     Icon: Clock,             color: 'oklch(0.58 0.05 280)', category: 'Lógica',   description: 'Pausa o fluxo por um tempo definido.',                     defaultData: { amount: 1, unit: 'horas' },                                       outputs: 1 },
  offer:     { label: 'Oferta',     Icon: ShoppingBag,       color: 'var(--success)', category: 'Comercial', description: 'Apresenta um produto com botão de compra.',                     defaultData: { product: 'Mentoria Premium', price: 1297, cta: 'Comprar agora' }, outputs: 1 },
  tag:       { label: 'Aplicar tag', Icon: Tag,              color: 'oklch(0.60 0.13 200)', category: 'CRM',  description: 'Adiciona ou remove uma tag do contato.',                       defaultData: { action: 'add', tag: 'VIP' },                                      outputs: 1 },
  handoff:   { label: 'Humano',     Icon: UserRound,         color: 'var(--danger)', category: 'CRM',       description: 'Encaminha o atendimento para o time humano.',                    defaultData: { team: 'Suporte', message: 'Um humano vai te atender em instantes.' }, outputs: 0 },
}

const flowStatusMap: Record<string, { label: string; tone: string }> = {
  published: { label: 'Publicado', tone: 'success' },
  draft:     { label: 'Rascunho',  tone: 'muted'   },
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_FLOWS: FlowItem[] = [
  {
    id: 'flow_001', name: 'Funil VIP — Lançamento', bot: '@mentoria_vip_bot', botColor: 'var(--primary)',
    status: 'published', executions: 4280, conversion: 9.4, updatedAt: new Date('2026-05-16T11:42:00').getTime(),
    description: 'Captura, qualificação e venda da mentoria premium anual.',
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 280, y: 60  }, data: { text: 'Olá! Bem-vindo à Mentoria VIP.' } },
      { id: 'n2', type: 'question', position: { x: 280, y: 220 }, data: { question: 'Qual seu nome?', variable: 'nome' } },
      { id: 'n3', type: 'message',  position: { x: 280, y: 380 }, data: { text: 'Prazer em te conhecer, {nome}!' } },
      { id: 'n4', type: 'buttons',  position: { x: 280, y: 540 }, data: { text: 'O que você busca hoje?', options: ['Aumentar receita', 'Aprender mais'] } },
      { id: 'n5', type: 'offer',    position: { x: 60,  y: 720 }, data: { product: 'Mentoria Premium Anual', price: 1297, cta: 'Comprar agora' } },
      { id: 'n6', type: 'delay',    position: { x: 500, y: 720 }, data: { amount: 1, unit: 'dias' } },
      { id: 'n7', type: 'tag',      position: { x: 60,  y: 880 }, data: { action: 'add', tag: 'VIP' } },
      { id: 'n8', type: 'message',  position: { x: 500, y: 880 }, data: { text: 'Material gratuito enviado!' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' }, { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 0, label: 'Receita' },
      { id: 'e5', source: 'n4', target: 'n6', sourceHandle: 1, label: 'Aprender' },
      { id: 'e6', source: 'n5', target: 'n7' }, { id: 'e7', source: 'n6', target: 'n8' },
    ],
  },
  {
    id: 'flow_002', name: 'Upsell pós-compra', bot: '@upsell_pos_bot', botColor: 'var(--success)',
    status: 'published', executions: 1284, conversion: 15.4, updatedAt: new Date('2026-05-10T09:14:00').getTime(),
    description: 'Oferta complementar disparada após cada nova venda confirmada.',
    nodes: [
      { id: 'n1', type: 'message', position: { x: 280, y: 80  }, data: { text: 'Obrigado pela compra de {produto}!' } },
      { id: 'n2', type: 'delay',   position: { x: 280, y: 240 }, data: { amount: 2, unit: 'horas' } },
      { id: 'n3', type: 'offer',   position: { x: 280, y: 400 }, data: { product: 'Pack Templates Pro', price: 70, cta: 'Adicionar à compra' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }],
  },
  {
    id: 'flow_003', name: 'Carrinho abandonado 24h', bot: '@vendas_curso_bot', botColor: 'var(--warning)',
    status: 'published', executions: 872, conversion: 5.8, updatedAt: new Date('2026-05-08T16:32:00').getTime(),
    description: 'Lembrete + oferta para quem adicionou e não comprou em 24 h.',
    nodes: [
      { id: 'n1', type: 'delay',   position: { x: 280, y: 80  }, data: { amount: 24, unit: 'horas' } },
      { id: 'n2', type: 'message', position: { x: 280, y: 240 }, data: { text: '{nome}, vi que você quase fechou! Olha só…' } },
      { id: 'n3', type: 'offer',   position: { x: 280, y: 400 }, data: { product: 'Curso Intensivo 90d', price: 147, cta: 'Garantir minha vaga' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }],
  },
  {
    id: 'flow_004', name: 'Remarketing 7 dias', bot: '@vendas_curso_bot', botColor: 'var(--warning)',
    status: 'draft', executions: 0, conversion: 0, updatedAt: new Date('2026-05-17T20:18:00').getTime(),
    description: 'Sequência de 4 mensagens em 7 dias para reativar leads frios.',
    nodes: [{ id: 'n1', type: 'message', position: { x: 280, y: 100 }, data: { text: 'Oi {nome}, está aí?' } }],
    edges: [],
  },
  {
    id: 'flow_005', name: 'Bem-vindo + Oferta', bot: '@mentoria_vip_bot', botColor: 'var(--primary)',
    status: 'published', executions: 3128, conversion: 4.2, updatedAt: new Date('2026-04-22T13:08:00').getTime(),
    description: 'Fluxo padrão de boas-vindas com oferta de entrada.',
    nodes: [], edges: [],
  },
  {
    id: 'flow_006', name: 'Suporte automático', bot: '@suporte_premium_bot', botColor: 'oklch(0.62 0.16 200)',
    status: 'published', executions: 542, conversion: 0, updatedAt: new Date('2026-03-30T10:55:00').getTime(),
    description: 'Atendimento por palavras-chave com escalonamento humano.',
    nodes: [], edges: [],
  },
]

// ─── UI primitives ─────────────────────────────────────────────────────────────

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

type BtnVariant = 'primary' | 'secondary' | 'ghost'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; onClick?: () => void; disabled?: boolean; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = { primary: 'bg-primary text-primary-fg hover:bg-primary/90', secondary: 'bg-surface border border-border text-text hover:bg-surface-2', ghost: 'text-text-muted hover:text-text hover:bg-surface-2' }[variant]
  return <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
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
      <button onClick={() => setOpen(v => !v)} className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2">
        <span className="truncate max-w-[120px]">{value || label}</span><ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
          {options.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }} className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}>
              {o === value && <Check size={12} />}<span className={o !== value ? 'pl-5' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface border border-border rounded-2xl shadow-xl w-full ${w} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            {title && <div className="text-[15px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text shrink-0"><X size={14} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

// ─── FlowCard ──────────────────────────────────────────────────────────────────

function FlowCard({ flow, onOpen }: { flow: FlowItem; onOpen: () => void }) {
  const st = flowStatusMap[flow.status]
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <Badge tone={st.tone}>
          {flow.status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />}
          {st.label}
        </Badge>
        <span className="text-[10.5px] text-text-subtle">Editado {fmtDate(flow.updatedAt)}</span>
      </div>
      <h3 className="text-[14.5px] font-semibold text-text leading-snug mt-2.5">{flow.name}</h3>
      <p className="text-[12px] text-text-muted mt-1 leading-snug line-clamp-2">{flow.description}</p>

      <div className="mt-3.5 flex items-center gap-2 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: flow.botColor }} />
          <span>{flow.bot}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
        <div>
          <div className="text-[16px] font-semibold text-text leading-none tracking-tight">{fmtNum(flow.executions)}</div>
          <div className="text-[10.5px] text-text-muted mt-1">execuções</div>
        </div>
        <div>
          <div className="text-[16px] font-semibold text-text leading-none tracking-tight">{flow.conversion > 0 ? fmtPct(flow.conversion) : '—'}</div>
          <div className="text-[10.5px] text-text-muted mt-1">conversão</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11.5px] text-text-muted">
        <span>{flow.nodes.length} {flow.nodes.length === 1 ? 'nó' : 'nós'}</span>
        <span className="inline-flex items-center gap-1 text-text-subtle group-hover:text-primary transition-colors">
          Abrir editor <ArrowUpRight size={11} />
        </span>
      </div>
    </div>
  )
}

// ─── FlowsList ─────────────────────────────────────────────────────────────────

function FlowsList({ flows, onOpen, onCreate }: { flows: FlowItem[]; onOpen: (id: string) => void; onCreate: () => void }) {
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('Todos')

  const filtered = useMemo(() => flows.filter(f => {
    const q = search.trim().toLowerCase()
    if (q && !f.name.toLowerCase().includes(q) && !f.bot.toLowerCase().includes(q)) return false
    if (statusF === 'Publicados' && f.status !== 'published') return false
    if (statusF === 'Rascunhos'  && f.status !== 'draft')     return false
    return true
  }), [flows, search, statusF])

  const counts = {
    total:     flows.length,
    published: flows.filter(f => f.status === 'published').length,
    drafts:    flows.filter(f => f.status === 'draft').length,
  }

  return (
    <>
      <PageHeader
        title="Fluxos de venda"
        subtitle={`${counts.total} fluxos · ${counts.published} publicados · ${counts.drafts} em rascunho`}
        actions={
          <>
            <Btn variant="secondary"><BookOpen size={14} /> Templates</Btn>
            <Btn variant="primary" onClick={onCreate}><Plus size={14} /> Criar fluxo</Btn>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou bot…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
        </div>
        <Dropdown label="Status" value={statusF} options={['Todos', 'Publicados', 'Rascunhos']} onChange={setStatusF} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(f => <FlowCard key={f.id} flow={f} onOpen={() => onOpen(f.id)} />)}
        <button onClick={onCreate} className="group min-h-[220px] bg-surface-2/30 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-primary hover:bg-primary-soft/30 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3 group-hover:border-primary group-hover:text-primary transition-colors"><Plus size={20} /></div>
          <div className="text-[13px] font-semibold text-text">Criar novo fluxo</div>
          <div className="text-[11.5px] text-text-muted mt-1 max-w-[220px] leading-snug">Começar do zero ou usar um template pronto.</div>
        </button>
      </div>
    </>
  )
}

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function getNodePreview(node: FlowNodeType): string {
  switch (node.type) {
    case 'message':   return node.data.text || 'Mensagem vazia'
    case 'question':  return node.data.question || 'Pergunta vazia'
    case 'buttons':   return `${node.data.text || 'Botões'} (${node.data.options?.length || 0})`
    case 'condition': return `Se {${node.data.variable}} ${node.data.operator} "${node.data.value || '?'}"`
    case 'delay':     return `Aguardar ${node.data.amount} ${node.data.unit}`
    case 'offer':     return `${node.data.product} · ${fmtBRLdec(node.data.price || 0)}`
    case 'tag':       return `${node.data.action === 'add' ? 'Adicionar' : 'Remover'} tag "${node.data.tag}"`
    case 'handoff':   return `Encaminhar para ${node.data.team}`
    default: return ''
  }
}

function getHandlePos(node: FlowNodeType, handle: 'input' | 'output', outputIdx = 0) {
  if (handle === 'input') return { x: node.position.x + NODE_W / 2, y: node.position.y }
  const t = nodeTypes[node.type]
  if (!t) return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H }
  if (t.outputs === 1) return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H }
  return outputIdx === 0
    ? { x: node.position.x + 50, y: node.position.y + NODE_H }
    : { x: node.position.x + NODE_W - 50, y: node.position.y + NODE_H }
}

function bezierPath(sx: number, sy: number, tx: number, ty: number) {
  const dy = ty - sy
  const off = Math.max(40, Math.abs(dy) * 0.5)
  return `M ${sx},${sy} C ${sx},${sy + off} ${tx},${ty - off} ${tx},${ty}`
}

// ─── Handle ────────────────────────────────────────────────────────────────────

function NodeHandle({ variant, x, y, label, active, highlighted, onClick }: {
  variant: 'input' | 'output'; x: number; y: number; label?: string
  active?: boolean; highlighted?: boolean; onClick: (e: React.MouseEvent) => void
}) {
  return (
    <div className="absolute z-10" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
      <button onMouseDown={e => e.stopPropagation()} onClick={onClick}
        className={`w-3 h-3 rounded-full border-2 transition-all bg-surface ${active ? 'border-primary bg-primary scale-125' : highlighted ? 'border-primary hover:bg-primary-soft hover:scale-125' : 'border-border-strong hover:border-primary hover:scale-125'}`}
        title={variant === 'input' ? 'Entrada' : 'Saída'} />
      {label && <div className="absolute top-3 left-1/2 -translate-x-1/2 mt-0.5 text-[9.5px] font-medium text-text-muted whitespace-nowrap">{label}</div>}
    </div>
  )
}

// ─── FlowNodeComp ──────────────────────────────────────────────────────────────

function FlowNodeComp({ node, selected, onMouseDown, onClick, onHandleClick, connecting }: {
  node: FlowNodeType; selected: boolean
  onMouseDown: (e: React.MouseEvent, id: string) => void
  onClick: (id: string) => void
  onHandleClick: (nodeId: string, type: 'input' | 'output', idx?: number) => void
  connecting: { nodeId: string; handle: number } | null
}) {
  const t = nodeTypes[node.type]
  if (!t) return null
  const NodeIcon = t.Icon
  const preview = getNodePreview(node)

  return (
    <div
      data-node-id={node.id}
      onMouseDown={e => onMouseDown(e, node.id)}
      onClick={e => { e.stopPropagation(); onClick(node.id) }}
      className={`absolute select-none rounded-xl border-2 bg-surface cursor-grab active:cursor-grabbing transition-shadow ${selected ? 'border-primary' : 'border-border hover:border-border-strong'}`}
      style={{
        left: node.position.x, top: node.position.y, width: NODE_W,
        boxShadow: selected ? '0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent)' : 'var(--shadow-md)',
      }}
    >
      <NodeHandle variant="input" x={NODE_W / 2} y={0}
        highlighted={!!(connecting && connecting.nodeId !== node.id)}
        onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'input') }} />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-[10px] border-b border-border" style={{ background: `color-mix(in oklab, ${t.color} 12%, var(--surface))` }}>
        <div className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0" style={{ background: t.color }}>
          <NodeIcon size={11} />
        </div>
        <div className="text-[11.5px] font-semibold text-text">{t.label}</div>
        <div className="flex-1" />
        <span className="text-[9.5px] text-text-subtle">#{node.id}</span>
      </div>

      <div className="px-3 py-2.5 min-h-[44px]">
        <div className="text-[12px] text-text leading-snug line-clamp-2">{preview}</div>
      </div>

      {t.outputs === 1 && (
        <NodeHandle variant="output" x={NODE_W / 2} y={NODE_H}
          active={connecting?.nodeId === node.id && connecting?.handle === 0}
          onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'output', 0) }} />
      )}
      {t.outputs === 2 && (
        <>
          <NodeHandle variant="output" x={50} y={NODE_H}
            label={node.type === 'condition' ? 'Sim' : node.data?.options?.[0] || 'Opção 1'}
            active={connecting?.nodeId === node.id && connecting?.handle === 0}
            onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'output', 0) }} />
          <NodeHandle variant="output" x={NODE_W - 50} y={NODE_H}
            label={node.type === 'condition' ? 'Não' : node.data?.options?.[1] || 'Opção 2'}
            active={connecting?.nodeId === node.id && connecting?.handle === 1}
            onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'output', 1) }} />
        </>
      )}
    </div>
  )
}

// ─── FlowEdges ─────────────────────────────────────────────────────────────────

function FlowEdges({ nodes, edges, selectedEdgeId, onSelectEdge }: {
  nodes: FlowNodeType[]; edges: FlowEdgeType[]
  selectedEdgeId: string | null; onSelectEdge: (id: string) => void
}) {
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes])
  return (
    <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ width: '100%', height: '100%' }}>
      <defs>
        <marker id="arrow"        viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="var(--border-strong)" /></marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="var(--primary)" /></marker>
      </defs>
      {edges.map(e => {
        const sn = byId[e.source], tn = byId[e.target]
        if (!sn || !tn) return null
        const s = getHandlePos(sn, 'output', e.sourceHandle ?? 0)
        const t = getHandlePos(tn, 'input')
        const isSel = selectedEdgeId === e.id
        const d = bezierPath(s.x, s.y, t.x, t.y)
        return (
          <g key={e.id}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); onSelectEdge(e.id) }} />
            <path d={d} fill="none" stroke={isSel ? 'var(--primary)' : 'var(--border-strong)'} strokeWidth={isSel ? 2.5 : 1.75} markerEnd={isSel ? 'url(#arrow-active)' : 'url(#arrow)'} style={{ pointerEvents: 'none' }} />
            {e.label && (
              <g pointerEvents="none">
                <rect x={(s.x + t.x) / 2 - 28} y={(s.y + t.y) / 2 - 9} width={56} height={18} rx={4} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
                <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 + 3} fill="var(--text-muted)" fontSize={10} fontWeight={500} textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif' }}>{e.label}</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Palette ───────────────────────────────────────────────────────────────────

function Palette({ onAddNode }: { onAddNode: (type: string) => void }) {
  const groups = useMemo(() => {
    const out: Record<string, Array<{ type: string } & NodeTypeDef>> = {}
    Object.entries(nodeTypes).forEach(([key, t]) => {
      if (!out[t.category]) out[t.category] = []
      out[t.category].push({ type: key, ...t })
    })
    return out
  }, [])

  return (
    <aside className="absolute top-3 left-3 z-20 w-[200px] max-h-[calc(100%-24px)] overflow-y-auto bg-surface border border-border rounded-xl p-2" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle px-2 pt-1 pb-2">Paleta de nós</div>
      <div className="space-y-3">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <div className="px-2 pb-1 text-[10px] font-semibold text-text-muted tracking-wide">{cat}</div>
            <div className="space-y-0.5">
              {items.map(it => {
                const ItIcon = it.Icon
                return (
                  <button key={it.type} onClick={() => onAddNode(it.type)} title={it.description}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-text hover:bg-surface-2 text-left group">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-white shrink-0" style={{ background: it.color }}><ItIcon size={12} /></div>
                    <span className="flex-1 truncate font-medium">{it.label}</span>
                    <Plus size={11} className="text-text-subtle group-hover:text-primary" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border mt-3 pt-2 text-[10.5px] text-text-subtle px-2 pb-1 leading-snug">Clique num tipo para adicionar no centro do canvas.</div>
    </aside>
  )
}

// ─── Inspector ─────────────────────────────────────────────────────────────────

const inspInput    = 'w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
const inspTextarea = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-snug'

function InspField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Inspector({ node, onUpdate, onClose, onDelete }: {
  node: FlowNodeType | undefined; onUpdate: (n: FlowNodeType) => void; onClose: () => void; onDelete: (id: string) => void
}) {
  if (!node) return null
  const t = nodeTypes[node.type]
  if (!t) return null
  const NodeIcon = t.Icon

  function setData(patch: Partial<NodeData>) {
    if (!node) return
    onUpdate({ ...node, data: { ...node.data, ...patch } })
  }

  return (
    <aside className="absolute top-3 right-3 z-20 w-[300px] max-h-[calc(100%-24px)] overflow-y-auto bg-surface border border-border rounded-xl" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: t.color }}><NodeIcon size={14} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{t.category}</div>
          <div className="text-[13px] font-semibold text-text leading-tight">{t.label}</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"><X size={14} /></button>
      </header>

      <div className="p-4 space-y-3.5 text-[12.5px]">
        <div className="text-[11.5px] text-text-muted leading-relaxed">{t.description}</div>

        {node.type === 'message' && (
          <InspField label="Texto da mensagem">
            <textarea rows={4} value={node.data.text} onChange={e => setData({ text: e.target.value })} className={inspTextarea} />
          </InspField>
        )}
        {node.type === 'question' && (
          <>
            <InspField label="Pergunta"><textarea rows={3} value={node.data.question} onChange={e => setData({ question: e.target.value })} className={inspTextarea} /></InspField>
            <InspField label="Variável de captura">
              <div className="flex items-center bg-surface-2 border border-border rounded-lg overflow-hidden">
                <span className="px-2 text-text-subtle text-[12px] font-mono">{'{'}</span>
                <input value={node.data.variable} onChange={e => setData({ variable: e.target.value.replace(/[^a-z0-9_]/gi, '') })} className="flex-1 h-9 bg-transparent text-text font-mono text-[12px] focus:outline-none" />
                <span className="px-2 text-text-subtle text-[12px] font-mono">{'}'}</span>
              </div>
            </InspField>
          </>
        )}
        {node.type === 'buttons' && (
          <>
            <InspField label="Texto"><textarea rows={2} value={node.data.text} onChange={e => setData({ text: e.target.value })} className={inspTextarea} /></InspField>
            <InspField label="Opções (cada uma vira uma saída)">
              <div className="space-y-1.5">
                {node.data.options?.map((op, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-5 text-[10.5px] text-text-subtle text-center">{i + 1}</span>
                    <input value={op} onChange={e => { const next = [...(node.data.options ?? [])]; next[i] = e.target.value; setData({ options: next }) }} className={inspInput} />
                    {(node.data.options?.length ?? 0) > 2 && (
                      <button onClick={() => setData({ options: node.data.options?.filter((_, j) => j !== i) })} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={11} /></button>
                    )}
                  </div>
                ))}
                {(node.data.options?.length ?? 0) < 6 && (
                  <button onClick={() => setData({ options: [...(node.data.options ?? []), `Opção ${(node.data.options?.length ?? 0) + 1}`] })} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1 mt-1">
                    <Plus size={11} /> Adicionar opção
                  </button>
                )}
              </div>
            </InspField>
          </>
        )}
        {node.type === 'condition' && (
          <>
            <InspField label="Variável"><input value={node.data.variable} onChange={e => setData({ variable: e.target.value })} className={inspInput + ' font-mono'} /></InspField>
            <InspField label="Operador">
              <select value={node.data.operator} onChange={e => setData({ operator: e.target.value })} className={inspInput}>
                <option value="igual">é igual a</option><option value="diferente">é diferente de</option>
                <option value="contém">contém</option><option value="começa">começa com</option>
                <option value="maior">é maior que</option><option value="menor">é menor que</option>
              </select>
            </InspField>
            <InspField label="Valor"><input value={node.data.value} onChange={e => setData({ value: e.target.value })} className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'delay' && (
          <InspField label="Aguardar">
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={node.data.amount} onChange={e => setData({ amount: parseInt(e.target.value, 10) || 1 })} className={inspInput + ' w-20 text-center'} />
              <select value={node.data.unit} onChange={e => setData({ unit: e.target.value })} className={inspInput}>
                <option>segundos</option><option>minutos</option><option>horas</option><option>dias</option>
              </select>
            </div>
          </InspField>
        )}
        {node.type === 'offer' && (
          <>
            <InspField label="Produto"><input value={node.data.product} onChange={e => setData({ product: e.target.value })} className={inspInput} /></InspField>
            <InspField label="Preço">
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">R$</span>
                <input type="number" min="0" step="0.01" value={node.data.price} onChange={e => setData({ price: parseFloat(e.target.value) || 0 })} className={inspInput + ' pl-9'} /></div>
            </InspField>
            <InspField label="Texto do botão"><input value={node.data.cta} onChange={e => setData({ cta: e.target.value })} className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'tag' && (
          <>
            <InspField label="Ação">
              <select value={node.data.action} onChange={e => setData({ action: e.target.value })} className={inspInput}>
                <option value="add">Adicionar tag</option><option value="remove">Remover tag</option>
              </select>
            </InspField>
            <InspField label="Tag"><input value={node.data.tag} onChange={e => setData({ tag: e.target.value })} className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'handoff' && (
          <>
            <InspField label="Time de atendimento">
              <select value={node.data.team} onChange={e => setData({ team: e.target.value })} className={inspInput}>
                <option>Suporte</option><option>Vendas</option><option>Financeiro</option><option>Sucesso do Cliente</option>
              </select>
            </InspField>
            <InspField label="Mensagem de transição"><textarea rows={3} value={node.data.message} onChange={e => setData({ message: e.target.value })} className={inspTextarea} /></InspField>
          </>
        )}

        <div className="pt-3 border-t border-border">
          <button onClick={() => onDelete(node.id)} className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-danger hover:bg-danger-soft rounded-md">
            <Trash2 size={12} /> Remover nó
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── MiniMap ───────────────────────────────────────────────────────────────────

function MiniMap({ nodes, vp, viewportSize }: { nodes: FlowNodeType[]; vp: { x: number; y: number; zoom: number }; viewportSize: { w: number; h: number } }) {
  if (nodes.length === 0) return null
  const minX = Math.min(...nodes.map(n => n.position.x), 0)
  const minY = Math.min(...nodes.map(n => n.position.y), 0)
  const maxX = Math.max(...nodes.map(n => n.position.x + NODE_W), 800)
  const maxY = Math.max(...nodes.map(n => n.position.y + NODE_H), 600)
  const w = maxX - minX + 200, h = maxY - minY + 200, padding = 80
  const mmW = 200, mmH = 140
  const scale = Math.min((mmW - 16) / (w + padding * 2), (mmH - 16) / (h + padding * 2))
  const offX = -minX + padding, offY = -minY + padding
  const vpW = viewportSize.w / vp.zoom, vpH = viewportSize.h / vp.zoom
  const vpX = -vp.x / vp.zoom, vpY = -vp.y / vp.zoom

  return (
    <div className="absolute bottom-3 right-3 z-20 bg-surface border border-border rounded-lg overflow-hidden" style={{ width: mmW, height: mmH, boxShadow: 'var(--shadow-md)' }}>
      <div className="px-2 py-1 border-b border-border text-[9.5px] uppercase tracking-wider font-semibold text-text-subtle flex items-center justify-between bg-surface-2/50">
        <span>Mini-mapa</span><span>{Math.round(vp.zoom * 100)}%</span>
      </div>
      <svg width={mmW} height={mmH - 22} viewBox={`0 0 ${mmW} ${mmH - 22}`} className="block">
        {nodes.map(n => {
          const t = nodeTypes[n.type]
          return <rect key={n.id} x={(n.position.x + offX) * scale + 8} y={(n.position.y + offY) * scale + 4} width={NODE_W * scale} height={NODE_H * scale} fill={t?.color ?? 'var(--primary)'} opacity={0.7} rx={1.5} />
        })}
        <rect x={(vpX + offX) * scale + 8} y={(vpY + offY) * scale + 4} width={vpW * scale} height={vpH * scale} fill="none" stroke="var(--primary)" strokeWidth={1.5} rx={2} />
      </svg>
    </div>
  )
}

// ─── ZoomControls ──────────────────────────────────────────────────────────────

function ZoomControls({ vp, setVp, viewportSize, onFit }: {
  vp: { x: number; y: number; zoom: number }
  setVp: React.Dispatch<React.SetStateAction<{ x: number; y: number; zoom: number }>>
  viewportSize: { w: number; h: number }; onFit: () => void
}) {
  function zoomTo(target: number) {
    setVp(v => {
      const ratio = target / v.zoom
      const cx = viewportSize.w / 2, cy = viewportSize.h / 2
      return { x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio, zoom: target }
    })
  }
  return (
    <div className="absolute bottom-3 left-3 z-20 bg-surface border border-border rounded-lg p-1 flex items-center gap-0.5" style={{ boxShadow: 'var(--shadow-md)' }}>
      <button onClick={() => zoomTo(Math.max(0.3, vp.zoom - 0.15))} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"><Minus size={13} /></button>
      <div className="px-2 text-[11.5px] text-text font-medium w-12 text-center">{Math.round(vp.zoom * 100)}%</div>
      <button onClick={() => zoomTo(Math.min(2.0, vp.zoom + 0.15))} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"><Plus size={13} /></button>
      <div className="w-px h-5 bg-border mx-0.5" />
      <button onClick={onFit} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"><Maximize size={12} /></button>
    </div>
  )
}

// ─── Canvas ────────────────────────────────────────────────────────────────────

interface CanvasProps {
  nodes: FlowNodeType[]; edges: FlowEdgeType[]
  vp: { x: number; y: number; zoom: number }
  setVp: React.Dispatch<React.SetStateAction<{ x: number; y: number; zoom: number }>>
  selected: string | null; selectedEdgeId: string | null
  onSelectNode: (id: string | null) => void; onSelectEdge: (id: string | null) => void
  onUpdateNode: (n: FlowNodeType) => void; onAddEdge: (e: FlowEdgeType) => void
  connecting: { nodeId: string; handle: number } | null
  setConnecting: React.Dispatch<React.SetStateAction<{ nodeId: string; handle: number } | null>>
  containerRef: React.RefObject<HTMLDivElement | null>
}

function Canvas({ nodes, edges, vp, setVp, selected, selectedEdgeId, onSelectNode, onSelectEdge, onUpdateNode, onAddEdge, connecting, setConnecting, containerRef }: CanvasProps) {
  const [draggingNode, setDraggingNode] = useState<{ id: string; startX: number; startY: number; x0: number; y0: number } | null>(null)
  const [panning, setPanning] = useState<{ x0: number; y0: number; vpX0: number; vpY0: number } | null>(null)

  function onBgMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 && e.button !== 1) return
    if ((e.target as HTMLElement).closest('[data-node-id]')) return
    setPanning({ x0: e.clientX, y0: e.clientY, vpX0: vp.x, vpY0: vp.y })
    onSelectNode(null); onSelectEdge(null); setConnecting(null)
  }
  function onNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    setDraggingNode({ id: nodeId, startX: e.clientX, startY: e.clientY, x0: node.position.x, y0: node.position.y })
  }

  useEffect(() => {
    function move(e: MouseEvent) {
      if (draggingNode) {
        const dx = (e.clientX - draggingNode.startX) / vp.zoom
        const dy = (e.clientY - draggingNode.startY) / vp.zoom
        const n = nodes.find(n => n.id === draggingNode.id)
        if (n) onUpdateNode({ ...n, position: { x: draggingNode.x0 + dx, y: draggingNode.y0 + dy } })
      } else if (panning) {
        setVp(v => ({ ...v, x: panning.vpX0 + (e.clientX - panning.x0), y: panning.vpY0 + (e.clientY - panning.y0) }))
      }
    }
    function up() { setDraggingNode(null); setPanning(null) }
    if (draggingNode || panning) {
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
      return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    }
  }, [draggingNode, panning, vp.zoom, nodes, onUpdateNode, setVp])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.92 : 1.08
    setVp(v => {
      const newZoom = Math.max(0.3, Math.min(2.0, v.zoom * delta))
      const ratio = newZoom / v.zoom
      return { x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio, zoom: newZoom }
    })
  }

  function handleClick(nodeId: string, type: 'input' | 'output', outIdx = 0) {
    if (type === 'output') {
      setConnecting({ nodeId, handle: outIdx })
    } else if (type === 'input' && connecting && connecting.nodeId !== nodeId) {
      const exists = edges.some(e => e.source === connecting.nodeId && e.target === nodeId && (e.sourceHandle ?? 0) === connecting.handle)
      if (!exists) onAddEdge({ id: 'e_' + Date.now(), source: connecting.nodeId, target: nodeId, sourceHandle: connecting.handle })
      setConnecting(null)
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={onBgMouseDown} onWheel={onWheel}
      style={{ backgroundColor: 'var(--bg)', backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: `${22 * vp.zoom}px ${22 * vp.zoom}px`, backgroundPosition: `${vp.x}px ${vp.y}px` }}
    >
      <div className="absolute top-0 left-0" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`, transformOrigin: '0 0', willChange: 'transform' }}>
        <div className="relative" style={{ width: 3000, height: 2000 }}>
          <FlowEdges nodes={nodes} edges={edges} selectedEdgeId={selectedEdgeId} onSelectEdge={id => onSelectEdge(id)} />
          {nodes.map(n => (
            <FlowNodeComp key={n.id} node={n} selected={selected === n.id}
              onMouseDown={onNodeMouseDown} onClick={id => { onSelectNode(id); onSelectEdge(null) }}
              onHandleClick={handleClick} connecting={connecting} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PreviewChat ───────────────────────────────────────────────────────────────

function ChatBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[280px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-bl-sm bg-surface text-text border border-border whitespace-pre-wrap">
        {text || <span className="italic text-text-muted">Mensagem vazia</span>}
      </div>
    </div>
  )
}

function PreviewChat({ nodes, edges }: { nodes: FlowNodeType[]; edges: FlowEdgeType[] }) {
  if (nodes.length === 0) return <div className="py-8 text-center text-[13px] text-text-muted">Adicione nós ao fluxo para ver a prévia.</div>

  const incomingCount: Record<string, number> = {}
  nodes.forEach(n => (incomingCount[n.id] = 0))
  edges.forEach(e => (incomingCount[e.target] = (incomingCount[e.target] || 0) + 1))
  const root = nodes.find(n => incomingCount[n.id] === 0) || nodes[0]

  const path: FlowNodeType[] = []
  const visited = new Set<string>()
  let cur: FlowNodeType | undefined = root
  while (cur && !visited.has(cur.id) && path.length < 12) {
    visited.add(cur.id); path.push(cur)
    const out = edges.find(e => e.source === cur!.id)
    cur = out ? nodes.find(n => n.id === out.target) : undefined
  }

  return (
    <div className="bg-surface-2/40 border border-border rounded-lg p-4 space-y-2 max-h-[440px] overflow-y-auto">
      {path.map((n, i) => {
        const t = nodeTypes[n.type]
        if (n.type === 'message' || n.type === 'question') {
          return <ChatBubble key={i} text={n.data.text || n.data.question || ''} />
        }
        if (n.type === 'buttons') {
          return (
            <div key={i}>
              <ChatBubble text={n.data.text || ''} />
              <div className="ml-2 mt-1.5 flex flex-wrap gap-1.5">
                {n.data.options?.map((op, j) => <span key={j} className="px-2 py-1 bg-surface border border-border rounded text-[11.5px] text-text">{op}</span>)}
              </div>
            </div>
          )
        }
        if (n.type === 'offer') {
          return (
            <div key={i} className="ml-2 my-1 bg-surface border border-border rounded-lg p-3 max-w-[280px]">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Oferta</div>
              <div className="text-[13px] font-semibold text-text mt-1">{n.data.product}</div>
              <div className="text-[18px] font-semibold text-success mt-1">{fmtBRLdec(n.data.price || 0)}</div>
              <button className="w-full mt-2 h-8 bg-primary text-primary-fg text-[12px] font-medium rounded-md">{n.data.cta}</button>
            </div>
          )
        }
        if (n.type === 'delay') return <div key={i} className="my-2 text-center text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">· Aguarda {n.data.amount} {n.data.unit} ·</div>
        if (t && (n.type === 'condition' || n.type === 'tag' || n.type === 'handoff')) {
          const NodeIc = t.Icon
          return (
            <div key={i} className="my-2 inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted bg-surface px-2 py-1 rounded border border-border">
              <NodeIc size={10} />
              {n.type === 'condition' && `Se {${n.data.variable}} ${n.data.operator} "${n.data.value}"`}
              {n.type === 'tag'       && `${n.data.action === 'add' ? 'Adiciona' : 'Remove'} tag "${n.data.tag}"`}
              {n.type === 'handoff'   && `Encaminha para ${n.data.team}`}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ─── FlowEditor ────────────────────────────────────────────────────────────────

function FlowEditor({ flow, onBack, onSave, onPublish }: {
  flow: FlowItem; onBack: () => void
  onSave: (f: FlowItem) => void; onPublish: (f: FlowItem) => void
}) {
  const [name, setName]               = useState(flow.name)
  const [nodes, setNodes]             = useState<FlowNodeType[]>(flow.nodes)
  const [edges, setEdges]             = useState<FlowEdgeType[]>(flow.edges)
  const [vp, setVp]                   = useState({ x: 40, y: 30, zoom: 0.85 })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [connecting, setConnecting]   = useState<{ nodeId: string; handle: number } | null>(null)
  const [viewportSize, setViewportSize] = useState({ w: 800, h: 600 })
  const [saved, setSaved]             = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect()
        setViewportSize({ w: r.width, h: r.height })
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches('input, textarea, select')) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) deleteNode(selectedNodeId)
        if (selectedEdgeId) { setEdges(es => es.filter(x => x.id !== selectedEdgeId)); setSelectedEdgeId(null) }
      } else if (e.key === 'Escape') { setSelectedNodeId(null); setSelectedEdgeId(null); setConnecting(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNodeId, selectedEdgeId])

  const addNode = useCallback((type: string) => {
    const def = nodeTypes[type]
    if (!def) return
    const id = 'n_' + Date.now()
    const cx = (viewportSize.w / 2 - vp.x) / vp.zoom - NODE_W / 2
    const cy = (viewportSize.h / 2 - vp.y) / vp.zoom - NODE_H / 2
    const newNode: FlowNodeType = { id, type, position: { x: cx, y: cy }, data: JSON.parse(JSON.stringify(def.defaultData)) }
    setNodes(ns => [...ns, newNode])
    setSelectedNodeId(id)
  }, [viewportSize, vp])

  function updateNode(updated: FlowNodeType) { setNodes(ns => ns.map(n => n.id === updated.id ? updated : n)) }
  function deleteNode(id: string) { setNodes(ns => ns.filter(n => n.id !== id)); setEdges(es => es.filter(e => e.source !== id && e.target !== id)); setSelectedNodeId(null) }
  function addEdge(edge: FlowEdgeType) { setEdges(es => [...es, edge]) }

  function fitView() {
    if (nodes.length === 0) { setVp({ x: 40, y: 30, zoom: 1 }); return }
    const minX = Math.min(...nodes.map(n => n.position.x)), minY = Math.min(...nodes.map(n => n.position.y))
    const maxX = Math.max(...nodes.map(n => n.position.x + NODE_W)), maxY = Math.max(...nodes.map(n => n.position.y + NODE_H))
    const zoom = Math.min(viewportSize.w / (maxX - minX + 100), viewportSize.h / (maxY - minY + 100), 1.2)
    setVp({ x: viewportSize.w / 2 - (minX + (maxX - minX) / 2) * zoom, y: viewportSize.h / 2 - (minY + (maxY - minY) / 2) * zoom, zoom })
  }

  function handleSave() { onSave({ ...flow, name, nodes, edges }); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  function handlePublish() { onPublish({ ...flow, name, nodes, edges, status: 'published' }); setSaved(true); setTimeout(() => setSaved(false), 2500) }

  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const st = flowStatusMap[flow.status]

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-7" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="h-[60px] bg-surface border-b border-border flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 h-9 px-2.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2">
          <ChevronLeft size={14} /> Fluxos
        </button>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input value={name} onChange={e => setName(e.target.value)} className="bg-transparent text-[15px] font-semibold text-text focus:outline-none focus:bg-surface-2 px-2 py-1 rounded-md min-w-0 max-w-md" />
          <Badge tone={st.tone}>
            {flow.status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />}
            {st.label}
          </Badge>
          <span className="hidden md:inline text-[11px] text-text-subtle">{nodes.length} nós · {edges.length} conexões</span>
        </div>
        <div className="flex items-center gap-1.5">
          {saved && <span className="text-[11.5px] text-success flex items-center gap-1 mr-1"><Check size={12} /> Salvo</span>}
          <Btn variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}><Eye size={13} /> Prévia</Btn>
          <Btn variant="secondary" size="sm" onClick={handleSave}><Save size={13} /> Salvar rascunho</Btn>
          <Btn variant="primary" size="sm" onClick={handlePublish}><Rocket size={13} /> Publicar</Btn>
        </div>
      </div>

      <div className="relative" style={{ height: 'calc(100vh - 64px - 60px)' }}>
        <Canvas nodes={nodes} edges={edges} vp={vp} setVp={setVp}
          selected={selectedNodeId} selectedEdgeId={selectedEdgeId}
          onSelectNode={id => { setSelectedNodeId(id); setSelectedEdgeId(null) }}
          onSelectEdge={id => { setSelectedEdgeId(id); setSelectedNodeId(null) }}
          onUpdateNode={updateNode} onAddEdge={addEdge}
          connecting={connecting} setConnecting={setConnecting} containerRef={containerRef} />

        <Palette onAddNode={addNode} />
        <Inspector node={selectedNode} onUpdate={updateNode} onClose={() => setSelectedNodeId(null)} onDelete={deleteNode} />

        {connecting && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-fg px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-2" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <Zap size={12} /> Clique numa entrada para conectar · ESC cancela
          </div>
        )}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-surface/80 backdrop-blur border border-dashed border-border rounded-xl px-6 py-5 text-center max-w-sm pointer-events-auto">
              <div className="w-10 h-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center mx-auto mb-3"><GitBranch size={18} /></div>
              <div className="text-[13px] font-semibold text-text">Comece adicionando um nó</div>
              <div className="text-[12px] text-text-muted mt-1">Use a paleta à esquerda para incluir mensagens, perguntas e ofertas.</div>
            </div>
          </div>
        )}

        <ZoomControls vp={vp} setVp={setVp} viewportSize={viewportSize} onFit={fitView} />
        <MiniMap nodes={nodes} vp={vp} viewportSize={viewportSize} />
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Prévia do fluxo" subtitle="Simulação no Telegram"
        footer={<Btn variant="primary" onClick={() => setPreviewOpen(false)}>Fechar</Btn>}>
        <PreviewChat nodes={nodes} edges={edges} />
      </Modal>
    </div>
  )
}

// ─── FlowsPage ─────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const [flows, setFlows]     = useState<FlowItem[]>(MOCK_FLOWS)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('flows').select('*').order('updated_at', { ascending: false })
        if (!error && data && data.length > 0) {
          setFlows(data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            name: r.name as string,
            bot: (r.bot as string) ?? '',
            botColor: (r.bot_color as string) ?? 'var(--primary)',
            status: (r.status as FlowItem['status']) ?? 'draft',
            executions: Number(r.executions ?? 0),
            conversion: Number(r.conversion ?? 0),
            updatedAt: r.updated_at ? new Date(r.updated_at as string).getTime() : Date.now(),
            description: (r.description as string) ?? '',
            nodes: (r.nodes as FlowNodeType[]) ?? [],
            edges: (r.edges as FlowEdgeType[]) ?? [],
          })))
        }
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  const editing = flows.find(f => f.id === editingId)

  function createFlow() {
    const newFlow: FlowItem = {
      id: 'flow_' + Date.now(), name: 'Novo fluxo', bot: '@mentoria_vip_bot', botColor: 'var(--primary)',
      status: 'draft', executions: 0, conversion: 0, updatedAt: Date.now(),
      description: 'Rascunho recém-criado.', nodes: [], edges: [],
    }
    setFlows(arr => [newFlow, ...arr])
    setEditingId(newFlow.id)
  }

  async function saveFlow(updated: FlowItem) {
    setFlows(arr => arr.map(f => f.id === updated.id ? { ...updated, updatedAt: Date.now() } : f))
    try {
      const supabase = createClient()
      await supabase.from('flows').upsert({ id: updated.id, name: updated.name, bot: updated.bot, bot_color: updated.botColor, status: updated.status, executions: updated.executions, conversion: updated.conversion, description: updated.description, nodes: updated.nodes, edges: updated.edges })
    } catch (_) {}
  }

  function publishFlow(updated: FlowItem) { saveFlow({ ...updated, status: 'published' }) }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <span className="inline-block w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (editing) {
    return (
      <DashboardLayout>
        <FlowEditor flow={editing} onBack={() => setEditingId(null)} onSave={saveFlow} onPublish={publishFlow} />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <FlowsList flows={flows} onOpen={setEditingId} onCreate={createFlow} />
    </DashboardLayout>
  )
}
