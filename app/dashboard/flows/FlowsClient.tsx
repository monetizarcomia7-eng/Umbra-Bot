'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  Search, Plus, BookOpen, ChevronLeft, ChevronDown, Check, X, Trash2,
  ArrowUpRight, Zap, Maximize, Minus, Save, Rocket, Eye, GitBranch,
  MessageSquare, HelpCircle, MousePointerClick, Split, Clock,
  ShoppingBag, Tag, UserRound, Loader2, AlertCircle, AlertTriangle, Bot,
  Flag, Copy, ChevronRight, Undo2, Redo2,
  Image as LucideImage, Link2, Settings, Hash, ShoppingCart, Phone,
  TrendingUp, TrendingDown, PackagePlus, Megaphone, Upload, Video,
} from 'lucide-react'

// ─── Public types (imported by page.tsx) ───────────────────────────────────────

export interface RawFlowRow {
  id: string
  name: string
  bot: string
  bot_color: string
  status: string
  executions: number
  conversion: number
  description: string
  updated_at: string
  // stats injected by page.tsx from parallel queries
  revenue?: number
  sales?: number
  leads?: number
}

export interface RawBotOption {
  id: string
  name: string
  username: string | null
  color: string | null
}

export interface FlowStatsMap {
  [flowId: string]: {
    revenue: number
    sales: number
    leads: number
  }
}

// ─── Internal types ────────────────────────────────────────────────────────────

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
  imageUrl?: string
  videoUrl?: string
  caption?: string
  url?: string
  description?: string
  originalPrice?: number
  discountPrice?: number
  campaignName?: string
  delayAmount?: number
  delayUnit?: string
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

interface FlowMeta {
  id: string
  name: string
  bot: string
  botColor: string
  status: 'published' | 'draft'
  executions: number
  conversion: number
  updatedAt: number
  description: string
  revenue: number
  sales: number
  leads: number
}

interface FlowEditorData extends FlowMeta {
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
  triggerType: 'start' | 'keyword'
  keywords: string[]
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapRawMeta(r: RawFlowRow): FlowMeta {
  return {
    id: r.id,
    name: r.name,
    bot: r.bot ?? '',
    botColor: r.bot_color ?? '#6366f1',
    status: (r.status as FlowMeta['status']) ?? 'draft',
    executions: Number(r.executions ?? 0),
    conversion: Number(r.conversion ?? 0),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    description: r.description ?? '',
    revenue: Number(r.revenue ?? 0),
    sales: Number(r.sales ?? 0),
    leads: Number(r.leads ?? 0),
  }
}

function mapRawFull(r: Record<string, unknown>): FlowEditorData {
  return {
    id: r.id as string,
    name: r.name as string,
    bot: (r.bot as string) ?? '',
    botColor: (r.bot_color as string) ?? '#6366f1',
    status: (r.status as FlowMeta['status']) ?? 'draft',
    executions: Number(r.executions ?? 0),
    conversion: Number(r.conversion ?? 0),
    revenue: Number(r.revenue ?? 0),
    sales: Number(r.sales ?? 0),
    leads: Number(r.leads ?? 0),
    updatedAt: r.updated_at ? new Date(r.updated_at as string).getTime() : Date.now(),
    description: (r.description as string) ?? '',
    nodes: (r.nodes as FlowNodeType[]) ?? [],
    edges: (r.edges as FlowEdgeType[]) ?? [],
    triggerType: ((r.trigger_type as string) === 'keyword' ? 'keyword' : 'start'),
    keywords: (r.keywords as string[]) ?? [],
  }
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRLdec(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' }
function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

// ─── Node definitions ──────────────────────────────────────────────────────────

const NODE_W = 220
const NODE_H = 128

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
  message:   { label: 'Mensagem',    Icon: MessageSquare,     color: 'var(--primary)',         category: 'Conversa',   description: 'Envia uma mensagem de texto ao usuário.',                             defaultData: { text: 'Sua mensagem aqui…' },                                     outputs: 1 },
  question:  { label: 'Pergunta',    Icon: HelpCircle,        color: 'var(--primary)',         category: 'Conversa',   description: 'Faz uma pergunta e captura a resposta numa variável.',                defaultData: { question: 'Qual seu nome?', variable: 'nome' },                   outputs: 1 },
  buttons:   { label: 'Botões',      Icon: MousePointerClick, color: 'var(--primary)',         category: 'Conversa',   description: 'Mostra botões de escolha rápida. Cada botão é uma saída.',           defaultData: { text: 'Escolha uma opção:', options: ['Opção A', 'Opção B'] },    outputs: -1 },
  condition: { label: 'Condição',    Icon: Split,             color: 'var(--warning)',         category: 'Lógica',     description: 'Bifurca o fluxo conforme uma variável (se/senão).',                  defaultData: { variable: 'nome', operator: 'igual', value: '' },                 outputs: 2 },
  delay:     { label: 'Espera',      Icon: Clock,             color: 'oklch(0.58 0.05 280)',   category: 'Lógica',     description: 'Pausa o fluxo por um tempo definido.',                               defaultData: { amount: 1, unit: 'horas' },                                       outputs: 1 },
  offer:     { label: 'Oferta',      Icon: ShoppingBag,       color: 'var(--success)',         category: 'Comercial',  description: 'Apresenta um produto com botão de compra.',                          defaultData: { product: 'Mentoria Premium', price: 1297, cta: 'Comprar agora' }, outputs: 1 },
  tag:       { label: 'Aplicar tag', Icon: Tag,               color: 'oklch(0.60 0.13 200)',   category: 'CRM',        description: 'Adiciona ou remove uma tag do contato.',                             defaultData: { action: 'add', tag: 'VIP' },                                      outputs: 1 },
  handoff:   { label: 'Humano',      Icon: UserRound,         color: 'var(--danger)',          category: 'CRM',        description: 'Encaminha o atendimento para o time humano.',                        defaultData: { team: 'Suporte', message: 'Um humano vai te atender em instantes.' }, outputs: 0 },
  image:     { label: 'Imagem',      Icon: LucideImage,       color: 'oklch(0.55 0.12 280)',   category: 'Mídia',      description: 'Envia uma imagem com legenda opcional.',                             defaultData: { imageUrl: '', caption: '' },                                      outputs: 1 },
  video:     { label: 'Vídeo',       Icon: Video,             color: 'oklch(0.52 0.18 20)',    category: 'Mídia',      description: 'Envia um vídeo (MP4) com legenda opcional.',                         defaultData: { videoUrl: '', caption: '' },                                      outputs: 1 },
  link:      { label: 'Link/Botão',  Icon: Link2,             color: 'oklch(0.52 0.18 250)',   category: 'Mídia',      description: 'Envia um botão inline com URL (Telegram InlineKeyboard).',           defaultData: { text: 'Clique aqui!', url: '' },                                  outputs: 1 },
  checkout:  { label: 'Checkout',    Icon: ShoppingCart,      color: 'var(--success)',          category: 'Comercial',  description: 'Envia link de pagamento como botão inline. Avança automaticamente.', defaultData: { text: 'Clique para comprar:', url: '' },                          outputs: 1 },
  phone:     { label: 'Telefone',    Icon: Phone,             color: 'oklch(0.58 0.12 200)',   category: 'Conversa',   description: 'Pede o número de telefone e salva na variável do contato.',          defaultData: { text: 'Qual é o seu telefone? (ex: 11999998888)', variable: 'telefone' }, outputs: 1 },
  upsell:    { label: 'Upsell',      Icon: TrendingUp,        color: 'oklch(0.55 0.19 145)',   category: 'Comercial',  description: 'Oferece um produto de maior valor após a compra inicial.',           defaultData: { product: 'Produto Premium', originalPrice: 997, discountPrice: 697, description: 'Aproveite essa oferta exclusiva por tempo limitado!', cta: 'Quero o upgrade', url: '' }, outputs: 1 },
  downsell:  { label: 'Downsell',    Icon: TrendingDown,      color: 'oklch(0.58 0.16 30)',    category: 'Comercial',  description: 'Oferece uma alternativa mais acessível quando o lead recusa a oferta principal.', defaultData: { product: 'Produto Básico', originalPrice: 497, discountPrice: 197, description: 'Tudo bem! Tenho uma opção mais em conta para você.', cta: 'Quero essa opção', url: '' }, outputs: 1 },
  orderbump: { label: 'Order Bump',  Icon: PackagePlus,       color: 'oklch(0.58 0.16 200)',   category: 'Comercial',  description: 'Adiciona um produto complementar com desconto na mesma compra.',      defaultData: { product: 'Bônus Especial', price: 97, description: 'Inclua também por apenas:', cta: 'Sim, quero o bônus!' },                                                             outputs: 1 },
  remarketing: { label: 'Remarketing', Icon: Megaphone,       color: 'oklch(0.52 0.18 285)',   category: 'CRM',        description: 'Agenda uma mensagem de follow-up para contatos que não converteram.', defaultData: { text: 'Oi {nome}! Vi que você ainda não finalizou. Posso te ajudar? 😊', delayAmount: 1, delayUnit: 'horas', tag: '' },                                               outputs: 1 },
}

const flowStatusMap: Record<string, { label: string; tone: string }> = {
  published: { label: 'Publicado', tone: 'success' },
  draft:     { label: 'Rascunho',  tone: 'muted'   },
}

// ─── Templates ─────────────────────────────────────────────────────────────────

interface FlowTemplate {
  id: string
  name: string
  description: string
  icon: React.ElementType
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
}

const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'blank',
    name: 'Fluxo em branco',
    description: 'Canvas limpo para começar do zero.',
    icon: Plus,
    nodes: [],
    edges: [],
  },
  {
    id: 'lead-capture',
    name: 'Captura de lead',
    description: 'Boas-vindas → coleta nome e e-mail → aplica tag automaticamente.',
    icon: UserRound,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Olá! 👋 Que bom ter você aqui. Vou fazer algumas perguntas rápidas.' } },
      { id: 'n2', type: 'question', position: { x: 300, y: 240 }, data: { question: 'Qual é o seu nome?', variable: 'nome' } },
      { id: 'n3', type: 'question', position: { x: 300, y: 400 }, data: { question: 'E o seu melhor e-mail?', variable: 'email' } },
      { id: 'n4', type: 'tag',      position: { x: 300, y: 560 }, data: { action: 'add', tag: 'lead' } },
      { id: 'n5', type: 'message',  position: { x: 300, y: 720 }, data: { text: 'Perfeito, {nome}! Em breve você vai receber novidades por aqui. 🚀' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0 },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 0 },
    ],
  },
  {
    id: 'sales',
    name: 'Vendas simples',
    description: 'Apresenta produto com oferta e botões de decisão.',
    icon: ShoppingBag,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Tenho uma oferta especial para você! 🎯' } },
      { id: 'n2', type: 'offer',    position: { x: 300, y: 240 }, data: { product: 'Meu Produto', price: 297, cta: 'Comprar agora' } },
      { id: 'n3', type: 'buttons',  position: { x: 300, y: 400 }, data: { text: 'O que deseja fazer?', options: ['Quero comprar', 'Saber mais', 'Agora não'] } },
      { id: 'n4', type: 'message',  position: { x:  80, y: 580 }, data: { text: 'Ótimo! Clique no botão acima para garantir sua vaga. 🚀' } },
      { id: 'n5', type: 'message',  position: { x: 320, y: 580 }, data: { text: 'Claro! O produto é perfeito para você porque...' } },
      { id: 'n6', type: 'message',  position: { x: 560, y: 580 }, data: { text: 'Sem problemas! Fico à disposição quando quiser. 😊' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0 },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 1 },
      { id: 'e5', source: 'n3', target: 'n6', sourceHandle: 2 },
    ],
  },
]

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function getButtonHandleX(idx: number, count: number): number {
  if (count <= 1) return NODE_W / 2
  if (count === 2) return idx === 0 ? 50 : NODE_W - 50
  const padding = 30
  const spacing = (NODE_W - padding * 2) / (count - 1)
  return padding + idx * spacing
}

function getHandlePos(node: FlowNodeType, handle: 'input' | 'output', outputIdx = 0) {
  if (handle === 'input') return { x: node.position.x + NODE_W / 2, y: node.position.y }
  const t = nodeTypes[node.type]
  if (!t || t.outputs === 0) return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H }
  if (t.outputs === 1) return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H }
  if (node.type === 'buttons') {
    const count = Math.max(2, node.data.options?.length ?? 2)
    return { x: node.position.x + getButtonHandleX(outputIdx, count), y: node.position.y + NODE_H }
  }
  return outputIdx === 0
    ? { x: node.position.x + 50, y: node.position.y + NODE_H }
    : { x: node.position.x + NODE_W - 50, y: node.position.y + NODE_H }
}

function getNodePreview(node: FlowNodeType): string {
  switch (node.type) {
    case 'message':   return node.data.text || 'Mensagem vazia'
    case 'question':  return (node.data.text || node.data.question || '') || 'Pergunta vazia'
    case 'buttons':   return `${node.data.text || 'Botões'} (${node.data.options?.length || 0} opções)`
    case 'condition': return `Se {${node.data.variable}} ${node.data.operator} "${node.data.value || '?'}"`
    case 'delay':     return `Aguardar ${node.data.amount} ${node.data.unit}`
    case 'offer':     return `${node.data.product} · ${fmtBRLdec(node.data.price || 0)}`
    case 'tag':       return `${node.data.action === 'add' ? 'Adicionar' : 'Remover'} tag "${node.data.tag}"`
    case 'handoff':   return `Encaminhar para ${node.data.team}`
    case 'image':    return node.data.caption || (node.data.imageUrl ? 'Imagem com URL' : 'Imagem (sem URL)')
    case 'video':    return node.data.caption || (node.data.videoUrl ? 'Vídeo com URL' : 'Vídeo (sem URL)')
    case 'link':     return `${node.data.text || 'Botão'} → ${node.data.url || 'sem URL'}`
    case 'checkout':    return `🛒 ${node.data.url || 'URL do checkout'}`
    case 'phone':       return (node.data.text as string) || 'Solicitar telefone'
    case 'upsell':      return `${node.data.product || 'Produto'} · ${fmtBRLdec(node.data.discountPrice || 0)}`
    case 'downsell':    return `${node.data.product || 'Alternativa'} · ${fmtBRLdec(node.data.discountPrice || 0)}`
    case 'orderbump':   return `${node.data.product || 'Bônus'} por ${fmtBRLdec(node.data.price || 0)}`
    case 'remarketing': return `Em ${node.data.delayAmount} ${node.data.delayUnit}: "${(node.data.text || '').slice(0, 40)}…"`
    default: return ''
  }
}

const GRID_SIZE = 20
function snapGrid(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE }

function bezierPath(sx: number, sy: number, tx: number, ty: number) {
  const dy = ty - sy
  const off = Math.max(40, Math.abs(dy) * 0.5)
  return `M ${sx},${sy} C ${sx},${sy + off} ${tx},${ty - off} ${tx},${ty}`
}

// ─── UI primitives ─────────────────────────────────────────────────────────────

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>
      {children}
    </span>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '', type = 'button' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'
  onClick?: () => void; disabled?: boolean; className?: string; type?: 'button' | 'submit'
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger border border-danger/20 hover:bg-danger hover:text-white',
  }[variant]
  return <button type={type} className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
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

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-[13px] font-medium animate-in slide-in-from-bottom-2 ${type === 'success' ? 'bg-success-soft text-success border-success/20' : 'bg-danger-soft text-danger border-danger/20'}`}>
      {type === 'error' ? <AlertCircle size={15} /> : <Check size={15} />}
      {msg}
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100"><X size={13} /></button>
    </div>
  )
}

// ─── NoDataState ───────────────────────────────────────────────────────────────

function NoDataState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mb-4">
        <GitBranch size={28} className="text-primary" />
      </div>
      <div className="text-[15px] font-semibold text-text">Nenhum fluxo criado ainda</div>
      <div className="text-[13px] text-text-muted mt-1.5 max-w-xs leading-snug">
        Crie seu primeiro fluxo de venda para automatizar conversas no Telegram e aumentar suas conversões.
      </div>
      <button
        onClick={onCreate}
        disabled={creating}
        className="mt-5 h-9 px-4 bg-primary text-primary-fg text-[13px] font-medium rounded-lg hover:bg-primary/90 inline-flex items-center gap-1.5 disabled:opacity-60 disabled:pointer-events-none"
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Criar primeiro fluxo
      </button>
    </div>
  )
}

// ─── TemplatesModal ────────────────────────────────────────────────────────────

function TemplatesModal({ open, onClose, onSelect }: {
  open: boolean
  onClose: () => void
  onSelect: (tpl: FlowTemplate) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Templates de fluxo" subtitle="Escolha um ponto de partida" size="lg">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FLOW_TEMPLATES.map(tpl => {
          const TplIcon = tpl.icon
          return (
            <button
              key={tpl.id}
              onClick={() => { onSelect(tpl); onClose() }}
              className="group text-left p-4 bg-surface-2/40 border border-border rounded-xl hover:border-primary hover:bg-primary-soft/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center mb-3 group-hover:border-primary group-hover:text-primary text-text-muted transition-colors">
                <TplIcon size={18} />
              </div>
              <div className="text-[13.5px] font-semibold text-text mb-1">{tpl.name}</div>
              <div className="text-[12px] text-text-muted leading-snug">{tpl.description}</div>
              <div className="mt-3 text-[11px] text-text-subtle font-medium">
                {tpl.nodes.length === 0 ? 'Canvas em branco' : `${tpl.nodes.length} nós · ${tpl.edges.length} conexões`}
              </div>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

// ─── FlowCard ──────────────────────────────────────────────────────────────────

function FlowCard({ flow, onOpen, onDelete, onDuplicate }: {
  flow: FlowMeta
  onOpen: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const st = flowStatusMap[flow.status]
  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group relative bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors cursor-pointer"
    >
      {/* Ações de hover no canto superior direito */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={e => { e.stopPropagation(); onDuplicate(flow.id) }}
          title="Duplicar fluxo"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(flow.id) }}
          title="Apagar fluxo"
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-start justify-between gap-3 pr-16">
        <Badge tone={st.tone}>
          {flow.status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />}
          {st.label}
        </Badge>
        <span className="text-[10.5px] text-text-subtle whitespace-nowrap">Editado {fmtDate(flow.updatedAt)}</span>
      </div>

      <h3 className="text-[14.5px] font-semibold text-text leading-snug mt-2.5">{flow.name}</h3>
      <p className="text-[12px] text-text-muted mt-1 leading-snug line-clamp-2 min-h-[32px]">
        {flow.description || <span className="italic text-text-subtle">Sem descrição</span>}
      </p>

      <div className="mt-3.5 flex items-center gap-2 text-[11.5px]">
        {flow.bot ? (
          <span className="inline-flex items-center gap-1.5 text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: flow.botColor }} />
            <span className="truncate max-w-[200px]">{flow.bot}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-text-subtle italic text-[11px]">
            <Bot size={11} />
            Sem bot vinculado
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
        <div>
          <div className="text-[13.5px] font-semibold text-text leading-none tracking-tight truncate">
            {(flow.revenue ?? 0) > 0 ? fmtBRLdec(flow.revenue ?? 0) : '—'}
          </div>
          <div className="text-[10.5px] text-text-muted mt-1">receita</div>
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-text leading-none tracking-tight">
            {fmtNum(flow.leads ?? 0)}
          </div>
          <div className="text-[10.5px] text-text-muted mt-1">leads</div>
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-text leading-none tracking-tight">
            {fmtNum(flow.sales ?? 0)}
          </div>
          <div className="text-[10.5px] text-text-muted mt-1">vendas</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-end text-[11.5px]">
        <span className="inline-flex items-center gap-1 text-text-subtle group-hover:text-primary transition-colors">
          Abrir editor <ArrowUpRight size={11} />
        </span>
      </div>
    </div>
  )
}

// ─── FlowsList ─────────────────────────────────────────────────────────────────

function FlowsList({ flows, onOpen, onCreate, onOpenTemplates, onDelete, onDuplicate, creating }: {
  flows: FlowMeta[]
  onOpen: (id: string) => void
  onCreate: () => void
  onOpenTemplates: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  creating: boolean
}) {
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('Todos')
  const [sortBy, setSortBy]   = useState('Mais recente')

  function sortFlows(arr: FlowMeta[], sort: string): FlowMeta[] {
    const copy = [...arr]
    switch (sort) {
      case 'Mais executado':  return copy.sort((a, b) => (b.executions ?? 0) - (a.executions ?? 0))
      case 'Maior receita':   return copy.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
      case 'Alfabético':      return copy.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      default:                return copy.sort((a, b) => b.updatedAt - a.updatedAt)
    }
  }

  const filtered = useMemo(() => {
    const base = flows.filter(f => {
      const q = search.trim().toLowerCase()
      if (q && !f.name.toLowerCase().includes(q) && !f.bot.toLowerCase().includes(q)) return false
      if (statusF === 'Publicados' && f.status !== 'published') return false
      if (statusF === 'Rascunhos'  && f.status !== 'draft')     return false
      return true
    })
    return sortFlows(base, sortBy)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows, search, statusF, sortBy])

  const counts = {
    total:     flows.length,
    published: flows.filter(f => f.status === 'published').length,
    drafts:    flows.filter(f => f.status === 'draft').length,
  }

  return (
    <>
      <PageHeader
        title="Fluxos de venda"
        subtitle={`${counts.total} ${counts.total === 1 ? 'fluxo' : 'fluxos'} · ${counts.published} publicados · ${counts.drafts} em rascunho`}
        actions={
          <>
            <Btn variant="secondary" onClick={onOpenTemplates}><BookOpen size={14} /> Templates</Btn>
            <Btn variant="primary" onClick={onCreate} disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar fluxo
            </Btn>
          </>
        }
      />

      {flows.length === 0 ? (
        <NoDataState onCreate={onCreate} creating={creating} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou bot…"
                className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                  <X size={13} />
                </button>
              )}
            </div>
            <Dropdown label="Status" value={statusF} options={['Todos', 'Publicados', 'Rascunhos']} onChange={setStatusF} />
            <Dropdown label="Ordenar" value={sortBy} options={['Mais recente', 'Mais executado', 'Maior receita', 'Alfabético']} onChange={setSortBy} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(f => (
              <FlowCard key={f.id} flow={f} onOpen={() => onOpen(f.id)} onDelete={onDelete} onDuplicate={onDuplicate} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-[13px] text-text-muted">
                Nenhum fluxo encontrado para &ldquo;{search}&rdquo;.
              </div>
            )}
            {filtered.length > 0 && (
              <button
                onClick={onCreate}
                disabled={creating}
                className="group min-h-[220px] bg-surface-2/30 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-primary hover:bg-primary-soft/30 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3 group-hover:border-primary group-hover:text-primary transition-colors">
                  {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                </div>
                <div className="text-[13px] font-semibold text-text">Criar novo fluxo</div>
                <div className="text-[11.5px] text-text-muted mt-1 max-w-[220px] leading-snug">Começar do zero ou usar um template pronto.</div>
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ─── Handle ────────────────────────────────────────────────────────────────────

function NodeHandle({ variant, x, y, label, active, highlighted, onClick }: {
  variant: 'input' | 'output'; x: number; y: number; label?: string
  active?: boolean; highlighted?: boolean; onClick: (e: React.MouseEvent) => void
}) {
  return (
    <div className="absolute z-10" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
      <button
        onMouseDown={e => e.stopPropagation()} onClick={onClick}
        className={`w-3 h-3 rounded-full border-2 transition-all bg-surface ${active ? 'border-primary bg-primary scale-125' : highlighted ? 'border-primary hover:bg-primary-soft hover:scale-125' : 'border-border-strong hover:border-primary hover:scale-125'}`}
        title={variant === 'input' ? 'Entrada' : 'Saída'}
      />
      {label && <div className="absolute top-3 left-1/2 -translate-x-1/2 mt-0.5 text-[9.5px] font-medium text-text-muted whitespace-nowrap bg-surface/80 px-1 rounded">{label}</div>}
    </div>
  )
}

// ─── FlowNodeComp ──────────────────────────────────────────────────────────────

function FlowNodeComp({ node, selected, isStart, onMouseDown, onClick, onEdit, onHandleClick, connecting }: {
  node: FlowNodeType; selected: boolean; isStart: boolean
  onMouseDown: (e: React.MouseEvent, id: string) => void
  onClick: (id: string, shift: boolean) => void
  onEdit: (id: string) => void
  onHandleClick: (nodeId: string, type: 'input' | 'output', idx?: number) => void
  connecting: { nodeId: string; handle: number } | null
}) {
  const t = nodeTypes[node.type]
  if (!t) return null
  const NodeIcon = t.Icon
  const preview = getNodePreview(node)
  const buttonOptions = node.type === 'buttons' ? (node.data.options ?? ['Opção A', 'Opção B']) : []

  return (
    <div
      data-node-id={node.id}
      onMouseDown={e => onMouseDown(e, node.id)}
      onClick={e => { e.stopPropagation(); onClick(node.id, e.shiftKey) }}
      className={`absolute select-none rounded-xl border-2 bg-surface cursor-grab active:cursor-grabbing transition-shadow ${selected ? 'border-primary' : 'border-border hover:border-border-strong'}`}
      style={{ left: node.position.x, top: node.position.y, width: NODE_W, boxShadow: selected ? '0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent)' : 'var(--shadow-md)' }}
    >
      {/* Indicador de nó inicial */}
      {isStart && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-warning/90 text-white px-1.5 py-0.5 rounded-md text-[9px] font-semibold whitespace-nowrap" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
          <Flag size={8} /> INÍCIO
        </div>
      )}

      <NodeHandle variant="input" x={NODE_W / 2} y={0}
        highlighted={!!(connecting && connecting.nodeId !== node.id)}
        onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'input') }} />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-[10px] border-b border-border" style={{ background: `color-mix(in oklab, ${t.color} 12%, var(--surface))` }}>
        <div className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0" style={{ background: t.color }}>
          <NodeIcon size={11} />
        </div>
        <div className="text-[11.5px] font-semibold text-text">{t.label}</div>
        <div className="flex-1" />
        <span className="text-[9.5px] text-text-subtle font-mono">#{node.id.slice(-4)}</span>
      </div>

      <div className="px-3 pt-2.5 pb-1 min-h-[44px]">
        <div className="text-[12px] text-text leading-snug line-clamp-2">{preview}</div>
      </div>

      {/* Botão Editar */}
      <div className="px-2 pb-2" style={{ position: 'relative', zIndex: 20 }}>
        <button
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onEdit(node.id) }}
          className="w-full h-6 rounded-md text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          style={{ background: selected ? 'color-mix(in oklab, var(--primary) 15%, transparent)' : 'color-mix(in oklab, var(--border) 60%, transparent)', color: selected ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          ✏️ Editar
        </button>
      </div>

      {t.outputs === 1 && (
        <NodeHandle variant="output" x={NODE_W / 2} y={NODE_H}
          active={connecting?.nodeId === node.id && connecting?.handle === 0}
          onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'output', 0) }} />
      )}

      {node.type === 'condition' && (
        <>
          <NodeHandle variant="output" x={50} y={NODE_H} label="Sim"
            active={connecting?.nodeId === node.id && connecting?.handle === 0}
            onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'output', 0) }} />
          <NodeHandle variant="output" x={NODE_W - 50} y={NODE_H} label="Não"
            active={connecting?.nodeId === node.id && connecting?.handle === 1}
            onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'output', 1) }} />
        </>
      )}

      {node.type === 'buttons' && buttonOptions.map((op, i) => (
        <NodeHandle key={i} variant="output"
          x={getButtonHandleX(i, buttonOptions.length)} y={NODE_H}
          label={op || `Opção ${i + 1}`}
          active={connecting?.nodeId === node.id && connecting?.handle === i}
          onClick={e => { e.stopPropagation(); onHandleClick(node.id, 'output', i) }} />
      ))}
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

// ─── ImageUploadField ──────────────────────────────────────────────────────────

function ImageUploadField({ value, onChange, userId }: {
  value: string | undefined
  onChange: (url: string) => void
  userId?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setUploadError('Apenas imagens são permitidas.'); return }
    if (file.size > 2 * 1024 * 1024) { setUploadError('Imagem muito grande (máx. 2 MB).'); return }
    setUploadError(null)
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const uid = userId ?? 'anon'
      const path = `flow/${uid}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('checkout-images').upload(path, file, { upsert: false })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('checkout-images').getPublicUrl(path)
      onChange(publicUrl)
    } catch {
      setUploadError('Erro ao enviar. Cole a URL direta abaixo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-border bg-surface-2" style={{ height: 110 }}>
          <img src={value} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
          <button
            type="button"
            onClick={() => { onChange(''); if (fileRef.current) fileRef.current.value = '' }}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          ><X size={10} /></button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full h-20 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-lg text-text-muted hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-60"
        >
          {uploading
            ? <><Loader2 size={18} className="animate-spin" /><span className="text-[11px]">Enviando…</span></>
            : <><Upload size={18} /><span className="text-[11px]">Clique para enviar imagem</span><span className="text-[10px] text-text-subtle">JPG, PNG, WebP · máx. 2 MB</span></>
          }
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      <input
        value={value ?? ''}
        onChange={e => { setUploadError(null); onChange(e.target.value) }}
        placeholder="ou cole a URL da imagem…"
        className={inspInput}
      />
      {uploadError && <p className="text-[11px] text-danger leading-tight">{uploadError}</p>}
    </div>
  )
}

function Inspector({ node, onUpdate, onClose, onDelete, userId }: {
  node: FlowNodeType | undefined; onUpdate: (n: FlowNodeType) => void; onClose: () => void; onDelete: (id: string) => void; userId?: string
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
    <aside className="absolute top-3 right-3 z-20 w-[300px] max-h-[calc(100%-24px)] overflow-y-auto bg-surface border border-border rounded-xl" style={{ boxShadow: 'var(--shadow-lg)' }} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
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
            <textarea rows={4} value={node.data.text ?? ''} onChange={e => setData({ text: e.target.value })} className={inspTextarea} />
          </InspField>
        )}
        {node.type === 'question' && (
          <>
            <InspField label="Pergunta"><textarea rows={3} value={(node.data.text ?? node.data.question) ?? ''} onChange={e => setData({ text: e.target.value })} className={inspTextarea} /></InspField>
            <InspField label="Variável de captura">
              <div className="flex items-center bg-surface-2 border border-border rounded-lg overflow-hidden">
                <span className="px-2 text-text-subtle text-[12px] font-mono">{'{'}</span>
                <input value={node.data.variable ?? ''} onChange={e => setData({ variable: e.target.value.replace(/[^a-z0-9_]/gi, '') })} className="flex-1 h-9 bg-transparent text-text font-mono text-[12px] focus:outline-none" />
                <span className="px-2 text-text-subtle text-[12px] font-mono">{'}'}</span>
              </div>
            </InspField>
          </>
        )}
        {node.type === 'buttons' && (
          <>
            <InspField label="Texto"><textarea rows={2} value={node.data.text ?? ''} onChange={e => setData({ text: e.target.value })} className={inspTextarea} /></InspField>
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
            <InspField label="Variável"><input value={node.data.variable ?? ''} onChange={e => setData({ variable: e.target.value })} className={inspInput + ' font-mono'} /></InspField>
            <InspField label="Operador">
              <select value={node.data.operator ?? 'igual'} onChange={e => setData({ operator: e.target.value })} className={inspInput}>
                <option value="igual">é igual a</option><option value="diferente">é diferente de</option>
                <option value="contém">contém</option><option value="começa">começa com</option>
                <option value="maior">é maior que</option><option value="menor">é menor que</option>
              </select>
            </InspField>
            <InspField label="Valor"><input value={node.data.value ?? ''} onChange={e => setData({ value: e.target.value })} className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'delay' && (
          <InspField label="Aguardar">
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={node.data.amount ?? 1} onChange={e => setData({ amount: parseInt(e.target.value, 10) || 1 })} className={inspInput + ' w-20 text-center'} />
              <select value={node.data.unit ?? 'horas'} onChange={e => setData({ unit: e.target.value })} className={inspInput}>
                <option>segundos</option><option>minutos</option><option>horas</option><option>dias</option>
              </select>
            </div>
          </InspField>
        )}
        {node.type === 'offer' && (
          <>
            <InspField label="Produto"><input value={node.data.product ?? ''} onChange={e => setData({ product: e.target.value })} className={inspInput} /></InspField>
            <InspField label="Preço">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">R$</span>
                <input type="number" min="0" step="0.01" value={node.data.price ?? 0} onChange={e => setData({ price: parseFloat(e.target.value) || 0 })} className={inspInput + ' pl-9'} />
              </div>
            </InspField>
            <InspField label="Texto do botão"><input value={node.data.cta ?? ''} onChange={e => setData({ cta: e.target.value })} className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'tag' && (
          <>
            <InspField label="Ação">
              <select value={node.data.action ?? 'add'} onChange={e => setData({ action: e.target.value })} className={inspInput}>
                <option value="add">Adicionar tag</option><option value="remove">Remover tag</option>
              </select>
            </InspField>
            <InspField label="Tag"><input value={node.data.tag ?? ''} onChange={e => setData({ tag: e.target.value })} className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'handoff' && (
          <>
            <InspField label="Time de atendimento">
              <select value={node.data.team ?? 'Suporte'} onChange={e => setData({ team: e.target.value })} className={inspInput}>
                <option>Suporte</option><option>Vendas</option><option>Financeiro</option><option>Sucesso do Cliente</option>
              </select>
            </InspField>
            <InspField label="Mensagem de transição"><textarea rows={3} value={node.data.message ?? ''} onChange={e => setData({ message: e.target.value })} className={inspTextarea} /></InspField>
          </>
        )}
        {node.type === 'image' && (
          <>
            <InspField label="Imagem">
              <ImageUploadField value={node.data.imageUrl} onChange={url => setData({ imageUrl: url })} userId={userId} />
            </InspField>
            <InspField label="Legenda (opcional)">
              <textarea rows={2} value={node.data.caption ?? ''} onChange={e => setData({ caption: e.target.value })} placeholder="Descrição da imagem…" className={inspTextarea} />
            </InspField>
          </>
        )}
        {node.type === 'video' && (
          <>
            <InspField label="URL do vídeo">
              <input value={node.data.videoUrl ?? ''} onChange={e => setData({ videoUrl: e.target.value })} placeholder="https://…/video.mp4" className={inspInput} />
              <p className="text-[11px] text-text-muted mt-1 leading-tight">Use um link direto para arquivo MP4. O Telegram aceita vídeos de até 50 MB.</p>
            </InspField>
            <InspField label="Legenda (opcional)">
              <textarea rows={2} value={node.data.caption ?? ''} onChange={e => setData({ caption: e.target.value })} placeholder="Descrição do vídeo…" className={inspTextarea} />
            </InspField>
          </>
        )}
        {node.type === 'link' && (
          <>
            <InspField label="Texto do botão">
              <input value={node.data.text ?? ''} onChange={e => setData({ text: e.target.value })} className={inspInput} />
            </InspField>
            <InspField label="URL do link">
              <input value={node.data.url ?? ''} onChange={e => setData({ url: e.target.value })} placeholder="https://…" className={inspInput} />
            </InspField>
          </>
        )}
        {node.type === 'checkout' && (
          <>
            <InspField label="Texto do botão">
              <input value={node.data.text ?? '🛒 Comprar agora'} onChange={e => setData({ text: e.target.value })} className={inspInput} />
            </InspField>
            <InspField label="URL do checkout">
              <input value={node.data.url ?? ''} onChange={e => setData({ url: e.target.value })} placeholder="https://umbrabot.com.br/c/…" className={inspInput} />
            </InspField>
          </>
        )}
        {node.type === 'phone' && (
          <>
            <InspField label="Pergunta">
              <textarea rows={3} value={node.data.text ?? 'Qual é o seu telefone?'} onChange={e => setData({ text: e.target.value })} className={inspTextarea} />
            </InspField>
            <InspField label="Variável de captura">
              <div className="flex items-center bg-surface-2 border border-border rounded-lg overflow-hidden">
                <span className="px-2 text-text-subtle text-[12px] font-mono">{'{'}</span>
                <input value={node.data.variable ?? 'telefone'} onChange={e => setData({ variable: e.target.value.replace(/[^a-z0-9_]/gi, '') })} className="flex-1 h-9 bg-transparent text-text font-mono text-[12px] focus:outline-none" />
                <span className="px-2 text-text-subtle text-[12px] font-mono">{'}'}</span>
              </div>
            </InspField>
          </>
        )}
        {node.type === 'upsell' && (
          <>
            <InspField label="Nome do produto"><input value={node.data.product ?? ''} onChange={e => setData({ product: e.target.value })} className={inspInput} /></InspField>
            <InspField label="Preço original (riscado)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">R$</span>
                <input type="number" min="0" step="0.01" value={node.data.originalPrice ?? 0} onChange={e => setData({ originalPrice: parseFloat(e.target.value) || 0 })} className={inspInput + ' pl-9'} />
              </div>
            </InspField>
            <InspField label="Preço com desconto">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">R$</span>
                <input type="number" min="0" step="0.01" value={node.data.discountPrice ?? 0} onChange={e => setData({ discountPrice: parseFloat(e.target.value) || 0 })} className={inspInput + ' pl-9'} />
              </div>
            </InspField>
            <InspField label="Descrição da oferta"><textarea rows={3} value={node.data.description ?? ''} onChange={e => setData({ description: e.target.value })} className={inspTextarea} /></InspField>
            <InspField label="Texto do botão"><input value={node.data.cta ?? 'Quero o upgrade'} onChange={e => setData({ cta: e.target.value })} className={inspInput} /></InspField>
            <InspField label="URL do checkout"><input value={node.data.url ?? ''} onChange={e => setData({ url: e.target.value })} placeholder="https://umbrabot.com.br/c/…" className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'downsell' && (
          <>
            <InspField label="Nome do produto alternativo"><input value={node.data.product ?? ''} onChange={e => setData({ product: e.target.value })} className={inspInput} /></InspField>
            <InspField label="Preço original (riscado)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">R$</span>
                <input type="number" min="0" step="0.01" value={node.data.originalPrice ?? 0} onChange={e => setData({ originalPrice: parseFloat(e.target.value) || 0 })} className={inspInput + ' pl-9'} />
              </div>
            </InspField>
            <InspField label="Preço com desconto">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">R$</span>
                <input type="number" min="0" step="0.01" value={node.data.discountPrice ?? 0} onChange={e => setData({ discountPrice: parseFloat(e.target.value) || 0 })} className={inspInput + ' pl-9'} />
              </div>
            </InspField>
            <InspField label="Descrição da oferta"><textarea rows={3} value={node.data.description ?? ''} onChange={e => setData({ description: e.target.value })} className={inspTextarea} /></InspField>
            <InspField label="Texto do botão"><input value={node.data.cta ?? 'Quero essa opção'} onChange={e => setData({ cta: e.target.value })} className={inspInput} /></InspField>
            <InspField label="URL do checkout"><input value={node.data.url ?? ''} onChange={e => setData({ url: e.target.value })} placeholder="https://umbrabot.com.br/c/…" className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'orderbump' && (
          <>
            <InspField label="Nome do produto bônus"><input value={node.data.product ?? ''} onChange={e => setData({ product: e.target.value })} className={inspInput} /></InspField>
            <InspField label="Preço do bônus">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">R$</span>
                <input type="number" min="0" step="0.01" value={node.data.price ?? 0} onChange={e => setData({ price: parseFloat(e.target.value) || 0 })} className={inspInput + ' pl-9'} />
              </div>
            </InspField>
            <InspField label="Descrição do bônus"><textarea rows={3} value={node.data.description ?? ''} onChange={e => setData({ description: e.target.value })} className={inspTextarea} /></InspField>
            <InspField label="Texto do botão"><input value={node.data.cta ?? 'Sim, quero o bônus!'} onChange={e => setData({ cta: e.target.value })} className={inspInput} /></InspField>
          </>
        )}
        {node.type === 'remarketing' && (
          <>
            <InspField label="Mensagem de follow-up">
              <textarea rows={4} value={node.data.text ?? ''} onChange={e => setData({ text: e.target.value })} placeholder="Oi {nome}! Vi que você ainda não finalizou…" className={inspTextarea} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['{nome}', '{bot}', '{produto}', '{data}'].map(v => (
                  <button key={v} onClick={() => setData({ text: (node.data.text ?? '') + v })} className="px-1.5 py-0.5 rounded text-[10.5px] bg-surface-2 border border-border text-text-subtle hover:text-primary hover:border-primary font-mono">{v}</button>
                ))}
              </div>
            </InspField>
            <InspField label="Enviar após">
              <div className="flex items-center gap-2">
                <input type="number" min="1" value={node.data.delayAmount ?? 1} onChange={e => setData({ delayAmount: parseInt(e.target.value, 10) || 1 })} className={inspInput + ' w-20 text-center'} />
                <select value={node.data.delayUnit ?? 'horas'} onChange={e => setData({ delayUnit: e.target.value })} className={inspInput}>
                  <option>minutos</option><option>horas</option><option>dias</option>
                </select>
              </div>
            </InspField>
            <InspField label="Tag (opcional — aplica ao contato)">
              <input value={node.data.tag ?? ''} onChange={e => setData({ tag: e.target.value })} placeholder="ex: remarketing" className={inspInput} />
            </InspField>
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
          const nt = nodeTypes[n.type]
          return <rect key={n.id} x={(n.position.x + offX) * scale + 8} y={(n.position.y + offY) * scale + 4} width={NODE_W * scale} height={NODE_H * scale} fill={nt?.color ?? 'var(--primary)'} opacity={0.7} rx={1.5} />
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
  selectedIds: Set<string>; selectedEdgeId: string | null
  onSelectNode: (id: string | null, shift?: boolean) => void
  onSelectNodes: (ids: string[]) => void
  onSelectEdge: (id: string | null) => void
  onUpdateNode: (n: FlowNodeType) => void
  onUpdateNodes: (ns: FlowNodeType[]) => void
  onAddEdge: (e: FlowEdgeType) => void
  onDragEnd: () => void
  connecting: { nodeId: string; handle: number } | null
  setConnecting: React.Dispatch<React.SetStateAction<{ nodeId: string; handle: number } | null>>
  containerRef: React.RefObject<HTMLDivElement | null>
  reconnectEdgeId: string | null
  onReconnectEdge: (edgeId: string, targetId: string) => void
}

function Canvas({ nodes, edges, vp, setVp, selectedIds, selectedEdgeId, onSelectNode, onSelectNodes, onSelectEdge, onUpdateNode, onUpdateNodes, onAddEdge, onDragEnd, connecting, setConnecting, containerRef, reconnectEdgeId, onReconnectEdge }: CanvasProps) {
  const [dragging, setDragging] = useState<{
    nodeIds: string[]
    primaryNodeId: string
    startX: number; startY: number
    initialPositions: Record<string, { x: number; y: number }>
    shift: boolean
  } | null>(null)
  const [panning, setPanning] = useState<{ x0: number; y0: number; vpX0: number; vpY0: number } | null>(null)
  const [boxSelect, setBoxSelect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const movedRef    = useRef(false)
  const bgPannedRef = useRef(false) // true quando o mousedown no fundo virou panning real

  const startNodeIds = useMemo(() => {
    const hasIncoming = new Set(edges.map(e => e.target))
    return new Set(nodes.map(n => n.id).filter(id => !hasIncoming.has(id)))
  }, [nodes, edges])

  function onBgMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 && e.button !== 1) return
    if ((e.target as HTMLElement).closest('[data-node-id]')) return
    if (e.shiftKey) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const rx = e.clientX - rect.left, ry = e.clientY - rect.top
        setBoxSelect({ x0: rx, y0: ry, x1: rx, y1: ry })
      }
    } else {
      bgPannedRef.current = false
      setPanning({ x0: e.clientX, y0: e.clientY, vpX0: vp.x, vpY0: vp.y })
      setConnecting(null)
      // Não desseleciona aqui — aguarda o onClick (só dispara se não houver arrasto)
    }
  }

  function onBgClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-node-id]')) return
    if (e.shiftKey) return
    if (bgPannedRef.current) return // foi panning, não clique
    onSelectNode(null); onSelectEdge(null)
  }

  function onNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    movedRef.current = false
    // Seleciona imediatamente no mousedown para abrir o Inspector sem depender do onClick
    if (e.shiftKey) {
      onSelectNode(nodeId, true)
    } else if (!selectedIds.has(nodeId)) {
      onSelectNode(nodeId, false)
      onSelectEdge(null)
    }
    // Se o nó já está selecionado (sem shift), arrasta toda a seleção. Senão, só este nó.
    const dragIds = (selectedIds.has(nodeId) && !e.shiftKey) ? [...selectedIds] : [nodeId]
    const initialPositions: Record<string, { x: number; y: number }> = {}
    dragIds.forEach(id => {
      const n = nodes.find(x => x.id === id)
      if (n) initialPositions[id] = { ...n.position }
    })
    setDragging({ nodeIds: dragIds, primaryNodeId: nodeId, startX: e.clientX, startY: e.clientY, initialPositions, shift: e.shiftKey })
  }

  useEffect(() => {
    function move(e: MouseEvent) {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / vp.zoom
        const dy = (e.clientY - dragging.startY) / vp.zoom
        const movedEnough = Math.abs(e.clientX - dragging.startX) > 6 || Math.abs(e.clientY - dragging.startY) > 6
        if (movedEnough) {
          movedRef.current = true
          const updates = dragging.nodeIds
            .map(id => {
              const n = nodes.find(x => x.id === id)
              const ip = dragging.initialPositions[id]
              if (!n || !ip) return null
              return { ...n, position: { x: ip.x + dx, y: ip.y + dy } }
            })
            .filter((n): n is FlowNodeType => n !== null)
          if (updates.length > 0) onUpdateNodes(updates)
        }
      } else if (panning) {
        if (Math.abs(e.clientX - panning.x0) > 3 || Math.abs(e.clientY - panning.y0) > 3) {
          bgPannedRef.current = true
        }
        setVp(v => ({ ...v, x: panning.vpX0 + (e.clientX - panning.x0), y: panning.vpY0 + (e.clientY - panning.y0) }))
      } else if (boxSelect) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) setBoxSelect(bs => bs ? { ...bs, x1: e.clientX - rect.left, y1: e.clientY - rect.top } : null)
      }
    }
    function up() {
      if (boxSelect) {
        const x0c = (Math.min(boxSelect.x0, boxSelect.x1) - vp.x) / vp.zoom
        const y0c = (Math.min(boxSelect.y0, boxSelect.y1) - vp.y) / vp.zoom
        const x1c = (Math.max(boxSelect.x0, boxSelect.x1) - vp.x) / vp.zoom
        const y1c = (Math.max(boxSelect.y0, boxSelect.y1) - vp.y) / vp.zoom
        const hit = nodes
          .filter(n => n.position.x < x1c && n.position.x + NODE_W > x0c && n.position.y < y1c && n.position.y + NODE_H > y0c)
          .map(n => n.id)
        if (hit.length > 0) onSelectNodes(hit)
        setBoxSelect(null)
      }
      if (dragging) {
        if (movedRef.current) onDragEnd()
        setDragging(null)
      }
      setPanning(null)
    }
    if (dragging || panning || boxSelect) {
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
      return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, panning, boxSelect, vp, nodes, onUpdateNodes, onSelectNodes, onDragEnd, setVp])

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
    } else if (type === 'input') {
      if (reconnectEdgeId) {
        onReconnectEdge(reconnectEdgeId, nodeId)
      } else if (connecting && connecting.nodeId !== nodeId) {
        const exists = edges.some(e => e.source === connecting.nodeId && e.target === nodeId && (e.sourceHandle ?? 0) === connecting.handle)
        if (!exists) onAddEdge({ id: 'e_' + Date.now(), source: connecting.nodeId, target: nodeId, sourceHandle: connecting.handle })
        setConnecting(null)
      }
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={onBgMouseDown} onClick={onBgClick} onWheel={onWheel}
      style={{ backgroundColor: 'var(--bg)', backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: `${22 * vp.zoom}px ${22 * vp.zoom}px`, backgroundPosition: `${vp.x}px ${vp.y}px` }}
    >
      <div className="absolute top-0 left-0" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`, transformOrigin: '0 0', willChange: 'transform' }}>
        <div className="relative" style={{ width: 3000, height: 2000 }}>
          <FlowEdges nodes={nodes} edges={edges} selectedEdgeId={selectedEdgeId} onSelectEdge={id => onSelectEdge(id)} />
          {nodes.map(n => (
            <FlowNodeComp key={n.id} node={n} selected={selectedIds.has(n.id)} isStart={startNodeIds.has(n.id)}
              onMouseDown={onNodeMouseDown}
              onClick={(id, shift) => { if (!movedRef.current) { onSelectNode(id, shift); onSelectEdge(null) } }}
              onEdit={(id) => { onSelectNode(id, false); onSelectEdge(null) }}
              onHandleClick={handleClick} connecting={connecting} />
          ))}
        </div>
      </div>
      {/* Retângulo de seleção por arrasto (Shift+drag) */}
      {boxSelect && (
        <div className="absolute border border-primary bg-primary/10 pointer-events-none rounded-sm" style={{
          zIndex: 25,
          left: Math.min(boxSelect.x0, boxSelect.x1),
          top: Math.min(boxSelect.y0, boxSelect.y1),
          width: Math.abs(boxSelect.x1 - boxSelect.x0),
          height: Math.abs(boxSelect.y1 - boxSelect.y0),
        }} />
      )}
      {/* Banner de redirecionamento de aresta */}
      {reconnectEdgeId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-warning text-white px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-2" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <Link2 size={12} /> Clique na entrada do nó de destino · ESC cancela
        </div>
      )}
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

function PreviewBranch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-border pl-3 ml-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5 flex items-center gap-1">
        <ChevronRight size={10} /> {label}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

type PreviewEntry =
  | { kind: 'bubble'; text: string }
  | { kind: 'offer'; product: string; price: number; cta: string }
  | { kind: 'delay'; amount: number; unit: string }
  | { kind: 'meta'; icon: React.ElementType; text: string }
  | { kind: 'image'; url: string; caption: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'buttons'; text: string; options: string[]; targets: (PreviewEntry[] | null)[] }
  | { kind: 'condition'; label: string; yes: PreviewEntry[] | null; no: PreviewEntry[] | null }

function buildPreviewPath(
  startNode: FlowNodeType,
  nodeById: Map<string, FlowNodeType>,
  edgesBySource: Map<string, FlowEdgeType[]>,
  visited: Set<string>,
  depth: number,
): PreviewEntry[] {
  const result: PreviewEntry[] = []
  let cur: FlowNodeType | undefined = startNode

  while (cur && !visited.has(cur.id) && depth < 30) {
    visited.add(cur.id)
    depth++
    const node: FlowNodeType = cur
    const outEdges: FlowEdgeType[] = edgesBySource.get(node.id) ?? []

    if (node.type === 'message') {
      result.push({ kind: 'bubble', text: node.data.text ?? '' })
    } else if (node.type === 'question') {
      result.push({ kind: 'bubble', text: node.data.question ?? '' })
      result.push({ kind: 'meta', icon: HelpCircle, text: `Captura resposta em {${node.data.variable || 'variavel'}}` })
    } else if (node.type === 'offer') {
      result.push({ kind: 'offer', product: node.data.product ?? '', price: node.data.price ?? 0, cta: node.data.cta ?? '' })
    } else if (node.type === 'delay') {
      result.push({ kind: 'delay', amount: node.data.amount ?? 1, unit: node.data.unit ?? 'horas' })
    } else if (node.type === 'tag') {
      result.push({ kind: 'meta', icon: Tag, text: `${node.data.action === 'add' ? 'Adiciona' : 'Remove'} tag "${node.data.tag}"` })
    } else if (node.type === 'handoff') {
      result.push({ kind: 'meta', icon: UserRound, text: `Encaminha para ${node.data.team}` })
      break
    } else if (node.type === 'image') {
      result.push({ kind: 'image', url: node.data.imageUrl ?? '', caption: node.data.caption ?? '' })
    } else if (node.type === 'link') {
      result.push({ kind: 'link', text: node.data.text ?? 'Botão', url: node.data.url ?? '' })
    } else if (node.type === 'buttons') {
      const options = node.data.options ?? []
      const targets = options.map((_: string, idx: number) => {
        const edge = outEdges.find((e: FlowEdgeType) => (e.sourceHandle ?? 0) === idx)
        if (!edge) return null
        const target = nodeById.get(edge.target)
        if (!target) return null
        return buildPreviewPath(target, nodeById, edgesBySource, new Set(visited), depth)
      })
      result.push({ kind: 'buttons', text: node.data.text ?? '', options, targets })
      break
    } else if (node.type === 'condition') {
      const yesEdge = outEdges.find((e: FlowEdgeType) => (e.sourceHandle ?? 0) === 0)
      const noEdge  = outEdges.find((e: FlowEdgeType) => (e.sourceHandle ?? 0) === 1)
      const yesNode = yesEdge ? nodeById.get(yesEdge.target) : undefined
      const noNode  = noEdge  ? nodeById.get(noEdge.target)  : undefined
      result.push({
        kind: 'condition',
        label: `Se {${node.data.variable}} ${node.data.operator} "${node.data.value}"`,
        yes: yesNode ? buildPreviewPath(yesNode, nodeById, edgesBySource, new Set(visited), depth) : null,
        no:  noNode  ? buildPreviewPath(noNode,  nodeById, edgesBySource, new Set(visited), depth) : null,
      })
      break
    }

    // advance to next single node
    const nextEdge: FlowEdgeType | undefined = outEdges.find((e: FlowEdgeType) => (e.sourceHandle ?? 0) === 0)
    cur = nextEdge ? nodeById.get(nextEdge.target) : undefined
  }

  return result
}

function RenderPreviewEntries({ entries }: { entries: PreviewEntry[] }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (entry.kind === 'bubble') {
          return <ChatBubble key={i} text={entry.text} />
        }
        if (entry.kind === 'offer') {
          return (
            <div key={i} className="ml-2 my-1 bg-surface border border-border rounded-lg p-3 max-w-[280px]">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Oferta</div>
              <div className="text-[13px] font-semibold text-text mt-1">{entry.product}</div>
              <div className="text-[18px] font-semibold text-success mt-1">{fmtBRLdec(entry.price)}</div>
              <button className="w-full mt-2 h-8 bg-primary text-primary-fg text-[12px] font-medium rounded-md">{entry.cta}</button>
            </div>
          )
        }
        if (entry.kind === 'image') {
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[240px]">
                <div className="w-[200px] h-[120px] bg-surface-2 border border-border rounded-lg flex items-center justify-center overflow-hidden">
                  {entry.url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={entry.url} alt={entry.caption} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <LucideImage size={28} className="text-text-subtle" />
                  }
                </div>
                {entry.caption && (
                  <div className="mt-1 text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-bl-sm bg-surface text-text border border-border">{entry.caption}</div>
                )}
              </div>
            </div>
          )
        }
        if (entry.kind === 'link') {
          return (
            <div key={i} className="flex justify-start">
              <a href={entry.url || '#'} target="_blank" rel="noopener noreferrer" onClick={e => e.preventDefault()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-primary/40 rounded-lg text-[12px] text-primary font-medium hover:bg-primary-soft/20">
                <Link2 size={11} /> {entry.text || 'Botão'}
              </a>
            </div>
          )
        }
        if (entry.kind === 'delay') {
          return <div key={i} className="my-2 text-center text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">· Aguarda {entry.amount} {entry.unit} ·</div>
        }
        if (entry.kind === 'meta') {
          const MIcon = entry.icon
          return (
            <div key={i} className="my-1 inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted bg-surface px-2 py-1 rounded border border-border">
              <MIcon size={10} /> {entry.text}
            </div>
          )
        }
        if (entry.kind === 'buttons') {
          return (
            <div key={i}>
              <ChatBubble text={entry.text} />
              <div className="ml-2 mt-1.5 flex flex-wrap gap-1.5 mb-2">
                {entry.options.map((op, j) => <span key={j} className="px-2 py-1 bg-surface border border-border rounded text-[11.5px] text-text">{op}</span>)}
              </div>
              <div className="space-y-3 mt-2">
                {entry.options.map((op, j) => entry.targets[j] && (
                  <PreviewBranch key={j} label={op || `Opção ${j + 1}`}>
                    <RenderPreviewEntries entries={entry.targets[j]!} />
                  </PreviewBranch>
                ))}
              </div>
            </div>
          )
        }
        if (entry.kind === 'condition') {
          return (
            <div key={i}>
              <div className="my-1 inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted bg-surface px-2 py-1 rounded border border-border">
                <Split size={10} /> {entry.label}
              </div>
              <div className="space-y-3 mt-2">
                {entry.yes && <PreviewBranch label="Sim (verdadeiro)"><RenderPreviewEntries entries={entry.yes} /></PreviewBranch>}
                {entry.no  && <PreviewBranch label="Não (falso)"><RenderPreviewEntries entries={entry.no} /></PreviewBranch>}
              </div>
            </div>
          )
        }
        return null
      })}
    </>
  )
}

function PreviewChat({ nodes, edges }: { nodes: FlowNodeType[]; edges: FlowEdgeType[] }) {
  if (nodes.length === 0) return <div className="py-8 text-center text-[13px] text-text-muted">Adicione nós ao fluxo para ver a prévia.</div>

  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const edgesBySource = new Map<string, FlowEdgeType[]>()
  edges.forEach(e => {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, [])
    edgesBySource.get(e.source)!.push(e)
  })

  const hasIncoming = new Set(edges.map(e => e.target))
  const root = nodes.find(n => !hasIncoming.has(n.id)) ?? nodes[0]
  const entries = buildPreviewPath(root, nodeById, edgesBySource, new Set(), 0)

  return (
    <div className="bg-surface-2/40 border border-border rounded-lg p-4 space-y-2 max-h-[480px] overflow-y-auto">
      <RenderPreviewEntries entries={entries} />
    </div>
  )
}

// ─── BotSelector ───────────────────────────────────────────────────────────────

function BotSelector({ bots, value, onChange }: {
  bots: RawBotOption[]
  value: string
  onChange: (bot: string, color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectedBot = bots.find(b => {
    const label = b.username ? `@${b.username}` : b.name
    return label === value
  })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="h-7 px-2 inline-flex items-center gap-1.5 bg-surface-2 border border-border rounded-md text-[11.5px] text-text hover:bg-surface hover:border-border-strong transition-colors"
      >
        {selectedBot ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selectedBot.color || '#6366f1' }} />
            <span className="max-w-[120px] truncate">{value}</span>
          </>
        ) : (
          <>
            <Bot size={11} className="text-text-muted" />
            <span className="text-text-muted">{value || 'Selecionar bot'}</span>
          </>
        )}
        <ChevronDown size={10} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
          {bots.length === 0 ? (
            <div className="px-3 py-2 text-[11.5px] text-text-muted italic">Nenhum bot cadastrado</div>
          ) : (
            bots.map(b => {
              const label = b.username ? `@${b.username}` : b.name
              const isSelected = label === value
              return (
                <button key={b.id} onClick={() => { onChange(label, b.color || '#6366f1'); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-surface-2 flex items-center gap-2 ${isSelected ? 'text-primary font-medium' : 'text-text'}`}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color || '#6366f1' }} />
                  {label}
                  {isSelected && <Check size={11} className="ml-auto" />}
                </button>
              )
            })
          )}
          {value && (
            <button onClick={() => { onChange('', '#6366f1'); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-[12px] text-text-muted hover:bg-surface-2 border-t border-border mt-1 pt-1 flex items-center gap-2">
              <X size={11} /> Remover bot
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── EdgePanel ─────────────────────────────────────────────────────────────────

function EdgePanel({ edge, nodes, reconnecting, onStartReconnect, onCancelReconnect, onDelete }: {
  edge: FlowEdgeType | undefined
  nodes: FlowNodeType[]
  reconnecting: boolean
  onStartReconnect: () => void
  onCancelReconnect: () => void
  onDelete: () => void
}) {
  if (!edge) return null
  const srcNode = nodes.find(n => n.id === edge.source)
  const tgtNode = nodes.find(n => n.id === edge.target)
  const srcLabel = srcNode ? (nodeTypes[srcNode.type]?.label ?? srcNode.type) : `#${edge.source.slice(-4)}`
  const tgtLabel = tgtNode ? (nodeTypes[tgtNode.type]?.label ?? tgtNode.type) : `#${edge.target.slice(-4)}`
  return (
    <aside className="absolute top-3 right-3 z-20 w-[260px] bg-surface border border-border rounded-xl p-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2.5">Conexão selecionada</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="px-2 py-0.5 bg-surface-2 border border-border rounded text-[11.5px] text-text truncate max-w-[95px]">{srcLabel}</span>
        <ArrowUpRight size={11} className="text-text-muted shrink-0" />
        <span className="px-2 py-0.5 bg-surface-2 border border-border rounded text-[11.5px] text-text truncate max-w-[95px]">{tgtLabel}</span>
      </div>
      {reconnecting ? (
        <div className="mt-3 space-y-2">
          <div className="text-[12px] text-primary font-medium leading-snug">Clique no nó de destino para redirecionar a conexão.</div>
          <button onClick={onCancelReconnect} className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-text-muted hover:bg-surface-2 rounded-md border border-border">
            <X size={12} /> Cancelar
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          <button onClick={onStartReconnect} className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-text hover:bg-surface-2 rounded-md border border-border">
            Redirecionar destino
          </button>
          <button onClick={onDelete} className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-danger hover:bg-danger-soft rounded-md">
            <Trash2 size={12} /> Remover conexão
          </button>
        </div>
      )}
    </aside>
  )
}

// ─── FlowEditor ────────────────────────────────────────────────────────────────

function FlowEditor({ flow, bots, onBack, onSave, onPublish, showToast, userId }: {
  flow: FlowEditorData
  bots: RawBotOption[]
  onBack: () => void
  onSave: (f: FlowEditorData) => Promise<boolean>
  onPublish: (f: FlowEditorData) => Promise<boolean>
  showToast: (msg: string, type: 'success' | 'error') => void
  userId?: string
}) {
  const [name, setName]                         = useState(flow.name)
  const [nameError, setNameError]               = useState(false)
  const [description, setDescription]           = useState(flow.description)
  const [triggerType, setTriggerType]           = useState<'start' | 'keyword'>(flow.triggerType ?? 'start')
  const [keywords, setKeywords]                 = useState<string[]>(flow.keywords ?? [])
  const [kwInput, setKwInput]                   = useState('')
  const [bot, setBot]                           = useState(flow.bot)
  const [botColor, setBotColor]                 = useState(flow.botColor)
  const [nodes, setNodes]                       = useState<FlowNodeType[]>(flow.nodes)
  const [edges, setEdges]                       = useState<FlowEdgeType[]>(flow.edges)
  const [vp, setVp]                             = useState({ x: 40, y: 30, zoom: 0.85 })
  const [selectedNodeIds, setSelectedNodeIds]   = useState<Set<string>>(new Set())
  const [selectedEdgeId, setSelectedEdgeId]     = useState<string | null>(null)
  const [reconnectEdgeId, setReconnectEdgeId]   = useState<string | null>(null)
  const [connecting, setConnecting]             = useState<{ nodeId: string; handle: number } | null>(null)
  const [viewportSize, setViewportSize]         = useState({ w: 800, h: 600 })
  const [saving, setSaving]                     = useState(false)
  const [publishing, setPublishing]             = useState(false)
  const [savedAt, setSavedAt]                   = useState<number | null>(null)
  const [previewOpen, setPreviewOpen]           = useState(false)
  const [settingsOpen, setSettingsOpen]         = useState(false)
  const [canUndo, setCanUndo]                   = useState(false)
  const [canRedo, setCanRedo]                   = useState(false)
  const [backConfirmOpen, setBackConfirmOpen]   = useState(false)

  // Snapshot inicial para dirty check
  const initialSnapshotRef = useRef({
    name:  flow.name,
    nodes: JSON.stringify(flow.nodes),
    edges: JSON.stringify(flow.edges),
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const autoSaveRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onSaveRef    = useRef(onSave)
  // eslint-disable-next-line react-hooks/refs
  onSaveRef.current  = onSave

  // Refs para leitura síncrona do estado mais recente
  const nodesRef = useRef(nodes)
  // eslint-disable-next-line react-hooks/refs
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  // eslint-disable-next-line react-hooks/refs
  edgesRef.current = edges
  const selectedNodeIdsRef = useRef(selectedNodeIds)
  // eslint-disable-next-line react-hooks/refs
  selectedNodeIdsRef.current = selectedNodeIds
  const selectedEdgeIdRef = useRef(selectedEdgeId)
  // eslint-disable-next-line react-hooks/refs
  selectedEdgeIdRef.current = selectedEdgeId

  // ── History (Undo/Redo) ────────────────────────────────────────────────────
  const MAX_HISTORY = 50
  const histRef    = useRef<Array<{ nodes: FlowNodeType[]; edges: FlowEdgeType[] }>>([{ nodes: flow.nodes, edges: flow.edges }])
  const histIdxRef = useRef(0)

  function refreshUndoRedo() {
    setCanUndo(histIdxRef.current > 0)
    setCanRedo(histIdxRef.current < histRef.current.length - 1)
  }

  function pushHistory(n: FlowNodeType[], e: FlowEdgeType[]) {
    histRef.current = histRef.current.slice(0, histIdxRef.current + 1)
    histRef.current.push({ nodes: n, edges: e })
    if (histRef.current.length > MAX_HISTORY) histRef.current.shift()
    histIdxRef.current = histRef.current.length - 1
    refreshUndoRedo()
  }

  function undoAction() {
    if (histIdxRef.current <= 0) return
    histIdxRef.current--
    const snap = histRef.current[histIdxRef.current]
    setNodes(snap.nodes)
    setEdges(snap.edges)
    setSelectedNodeIds(new Set())
    refreshUndoRedo()
  }

  function redoAction() {
    if (histIdxRef.current >= histRef.current.length - 1) return
    histIdxRef.current++
    const snap = histRef.current[histIdxRef.current]
    setNodes(snap.nodes)
    setEdges(snap.edges)
    setSelectedNodeIds(new Set())
    refreshUndoRedo()
  }

  // Medição do canvas
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

  // Atalhos de teclado (usa refs para evitar stale closure — deps: [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      if ((e.target as HTMLElement).matches('input, textarea, select')) return

      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undoAction(); return }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redoAction(); return }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = [...selectedNodeIdsRef.current]
        if (ids.length > 0) {
          const nextNodes = nodesRef.current.filter(n => !ids.includes(n.id))
          const nextEdges = edgesRef.current.filter(ed => !ids.includes(ed.source) && !ids.includes(ed.target))
          setNodes(nextNodes); setEdges(nextEdges); setSelectedNodeIds(new Set())
          pushHistory(nextNodes, nextEdges)
        } else if (selectedEdgeIdRef.current) {
          const nextEdges = edgesRef.current.filter(x => x.id !== selectedEdgeIdRef.current)
          setEdges(nextEdges); setSelectedEdgeId(null)
          pushHistory(nodesRef.current, nextEdges)
        }
      } else if (e.key === 'Escape') {
        setSelectedNodeIds(new Set()); setSelectedEdgeId(null); setConnecting(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Limpa modo de reconexão quando a aresta é desmarcada
  useEffect(() => {
    if (!selectedEdgeId) setReconnectEdgeId(null)
  }, [selectedEdgeId])

  // Auto-save 30s após última edição
  useEffect(() => {
    clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(async () => {
      if (!name.trim()) return
      const currentFlow: FlowEditorData = { ...flow, name, description, bot, botColor, nodes, edges, triggerType, keywords }
      const ok = await onSaveRef.current(currentFlow)
      if (ok) setSavedAt(Date.now())
    }, 30_000)
    return () => clearTimeout(autoSaveRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name, description, bot, botColor, triggerType, keywords])

  // ── Seleção múltipla ────────────────────────────────────────────────────────
  function onSelectNode(id: string | null, shift = false) {
    if (!id) { setSelectedNodeIds(new Set()); return }
    if (shift) {
      setSelectedNodeIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      })
    } else {
      setSelectedNodeIds(new Set([id]))
    }
    setSelectedEdgeId(null)
  }

  function onSelectNodes(ids: string[]) {
    setSelectedNodeIds(new Set(ids))
    setSelectedEdgeId(null)
  }

  // ── Ações no canvas ─────────────────────────────────────────────────────────
  const addNode = useCallback((type: string) => {
    const def = nodeTypes[type]
    if (!def) return
    const id = 'n_' + Date.now()
    const cx = (viewportSize.w / 2 - vp.x) / vp.zoom - NODE_W / 2
    const cy = (viewportSize.h / 2 - vp.y) / vp.zoom - NODE_H / 2
    const newNode: FlowNodeType = { id, type, position: { x: cx, y: cy }, data: JSON.parse(JSON.stringify(def.defaultData)) }
    const nextNodes = [...nodesRef.current, newNode]
    setNodes(nextNodes)
    setSelectedNodeIds(new Set([id]))
    pushHistory(nextNodes, edgesRef.current)
  }, [viewportSize, vp]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateNode(updated: FlowNodeType) {
    setNodes(ns => ns.map(n => n.id === updated.id ? updated : n))
  }

  function updateNodes(updates: FlowNodeType[]) {
    setNodes(ns => {
      const map = new Map(updates.map(u => [u.id, { ...u, position: { x: snapGrid(u.position.x), y: snapGrid(u.position.y) } }]))
      return ns.map(n => map.has(n.id) ? map.get(n.id)! : n)
    })
  }

  function handleDragEnd() {
    pushHistory(nodesRef.current, edgesRef.current)
  }

  function onReconnectEdge(edgeId: string, newTargetId: string) {
    const nextEdges = edgesRef.current.map(e => e.id === edgeId ? { ...e, target: newTargetId } : e)
    setEdges(nextEdges)
    pushHistory(nodesRef.current, nextEdges)
    setReconnectEdgeId(null)
    setSelectedEdgeId(null)
  }

  function addEdge(edge: FlowEdgeType) {
    const nextEdges = [...edgesRef.current, edge]
    setEdges(nextEdges)
    pushHistory(nodesRef.current, nextEdges)
  }

  function fitView() {
    if (nodes.length === 0) { setVp({ x: 40, y: 30, zoom: 1 }); return }
    const minX = Math.min(...nodes.map(n => n.position.x)), minY = Math.min(...nodes.map(n => n.position.y))
    const maxX = Math.max(...nodes.map(n => n.position.x + NODE_W)), maxY = Math.max(...nodes.map(n => n.position.y + NODE_H))
    const zoom = Math.min(viewportSize.w / (maxX - minX + 100), viewportSize.h / (maxY - minY + 100), 1.2)
    setVp({ x: viewportSize.w / 2 - (minX + (maxX - minX) / 2) * zoom, y: viewportSize.h / 2 - (minY + (maxY - minY) / 2) * zoom, zoom })
  }

  async function handleSave() {
    if (saving || publishing) return
    if (!name.trim()) {
      setNameError(true)
      showToast('O nome do fluxo não pode ficar vazio.', 'error')
      return
    }
    setNameError(false)
    setSaving(true)
    const ok = await onSave({ ...flow, name, description, bot, botColor, nodes, edges, triggerType, keywords })
    setSaving(false)
    if (ok) {
      setSavedAt(Date.now())
      showToast('Rascunho salvo.', 'success')
      initialSnapshotRef.current = { name, nodes: JSON.stringify(nodesRef.current), edges: JSON.stringify(edgesRef.current) }
    }
  }

  async function handlePublish() {
    if (saving || publishing) return
    if (!name.trim()) {
      setNameError(true)
      showToast('O nome do fluxo não pode ficar vazio.', 'error')
      return
    }
    setNameError(false)
    setPublishing(true)
    const ok = await onPublish({ ...flow, name, description, bot, botColor, nodes, edges, triggerType, keywords, status: 'published' })
    setPublishing(false)
    if (ok) {
      setSavedAt(Date.now())
      initialSnapshotRef.current = { name, nodes: JSON.stringify(nodesRef.current), edges: JSON.stringify(edgesRef.current) }
    }
  }

  // Nó único selecionado (para o inspector)
  const singleSelectedId = selectedNodeIds.size === 1 ? [...selectedNodeIds][0] : null
  const selectedNode = singleSelectedId ? nodes.find(n => n.id === singleSelectedId) : undefined
  const st = flowStatusMap[flow.status] ?? flowStatusMap.draft
  // eslint-disable-next-line react-hooks/purity
  const savedRecently = savedAt && Date.now() - savedAt < 5000

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-7" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Topbar do editor */}
      <div className="h-[60px] bg-surface border-b border-border flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
        <button
          onClick={() => {
            const dirty = name !== initialSnapshotRef.current.name
              || JSON.stringify(nodesRef.current) !== initialSnapshotRef.current.nodes
              || JSON.stringify(edgesRef.current) !== initialSnapshotRef.current.edges
            if (dirty) { setBackConfirmOpen(true) } else { onBack() }
          }}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 shrink-0"
        >
          <ChevronLeft size={14} /> Fluxos
        </button>
        <div className="w-px h-6 bg-border shrink-0" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={undoAction} disabled={!canUndo} title="Desfazer (Ctrl+Z)"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:pointer-events-none">
            <Undo2 size={14} />
          </button>
          <button onClick={redoAction} disabled={!canRedo} title="Refazer (Ctrl+Y)"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:pointer-events-none">
            <Redo2 size={14} />
          </button>
        </div>
        <div className="w-px h-6 bg-border shrink-0" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative">
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(false) }}
              placeholder="Nome do fluxo"
              className={`bg-transparent text-[15px] font-semibold text-text focus:outline-none px-2 py-1 rounded-md min-w-0 max-w-[200px] md:max-w-sm ${nameError ? 'ring-2 ring-danger/50 bg-danger-soft/30' : 'focus:bg-surface-2'}`}
            />
            {nameError && (
              <div className="absolute top-full mt-1 left-0 text-[10.5px] text-danger font-medium whitespace-nowrap">
                Nome obrigatório
              </div>
            )}
          </div>
          <Badge tone={st.tone}>
            {flow.status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)]" />}
            {st.label}
          </Badge>
          <BotSelector bots={bots} value={bot} onChange={(b, c) => { setBot(b); setBotColor(c) }} />
          <span className="hidden lg:inline text-[11px] text-text-subtle">{nodes.length} nós · {edges.length} conexões</span>
          {triggerType === 'keyword' && keywords.length > 0 && (
            <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-warning font-medium">
              <Hash size={10} /> {keywords.length} palavra{keywords.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {savedRecently && (
            <span className="text-[11.5px] text-success flex items-center gap-1 mr-1">
              <Check size={12} /> Salvo
            </span>
          )}
          <button onClick={() => setSettingsOpen(true)} title="Configurações do fluxo"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text">
            <Settings size={14} />
          </button>
          <Btn variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}><Eye size={13} /> Prévia</Btn>
          <Btn variant="secondary" size="sm" onClick={handleSave} disabled={saving || publishing}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar rascunho
          </Btn>
          <Btn variant="primary" size="sm" onClick={handlePublish} disabled={saving || publishing}>
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
            Publicar
          </Btn>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ height: 'calc(100vh - 64px - 60px)' }}>
        <Canvas
          nodes={nodes} edges={edges} vp={vp} setVp={setVp}
          selectedIds={selectedNodeIds} selectedEdgeId={selectedEdgeId}
          onSelectNode={onSelectNode}
          onSelectNodes={onSelectNodes}
          onSelectEdge={id => { setSelectedEdgeId(id); setSelectedNodeIds(new Set()) }}
          onUpdateNode={updateNode}
          onUpdateNodes={updateNodes}
          onAddEdge={addEdge}
          onDragEnd={handleDragEnd}
          connecting={connecting} setConnecting={setConnecting} containerRef={containerRef}
          reconnectEdgeId={reconnectEdgeId}
          onReconnectEdge={onReconnectEdge}
        />

        <Palette onAddNode={addNode} />

        {/* Inspector — só quando 1 nó selecionado (e nenhuma aresta) */}
        {selectedNodeIds.size <= 1 && !selectedEdgeId && (
          <Inspector
            node={selectedNode}
            onUpdate={updateNode}
            onClose={() => setSelectedNodeIds(new Set())}
            onDelete={id => {
              const nextNodes = nodesRef.current.filter(n => n.id !== id)
              const nextEdges = edgesRef.current.filter(e => e.source !== id && e.target !== id)
              setNodes(nextNodes); setEdges(nextEdges); setSelectedNodeIds(new Set())
              pushHistory(nextNodes, nextEdges)
            }}
            userId={userId}
          />
        )}

        {/* EdgePanel — quando uma aresta está selecionada */}
        {selectedEdgeId && selectedNodeIds.size === 0 && (
          <EdgePanel
            edge={edges.find(e => e.id === selectedEdgeId)}
            nodes={nodes}
            reconnecting={reconnectEdgeId === selectedEdgeId}
            onStartReconnect={() => setReconnectEdgeId(selectedEdgeId)}
            onCancelReconnect={() => setReconnectEdgeId(null)}
            onDelete={() => {
              const nextEdges = edgesRef.current.filter(e => e.id !== selectedEdgeId)
              setEdges(nextEdges); setSelectedEdgeId(null); setReconnectEdgeId(null)
              pushHistory(nodesRef.current, nextEdges)
            }}
          />
        )}

        {/* Painel de seleção múltipla */}
        {selectedNodeIds.size > 1 && (
          <aside className="absolute top-3 right-3 z-20 w-[260px] bg-surface border border-border rounded-xl p-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="text-[13px] font-semibold text-text">{selectedNodeIds.size} nós selecionados</div>
            <div className="text-[11.5px] text-text-muted mt-1 leading-snug">
              Arraste para mover o grupo. Use Delete para remover todos. Shift+clique para ajustar a seleção.
            </div>
            <button
              onClick={() => {
                const ids = [...selectedNodeIds]
                const nextNodes = nodesRef.current.filter(n => !ids.includes(n.id))
                const nextEdges = edgesRef.current.filter(e => !ids.includes(e.source) && !ids.includes(e.target))
                setNodes(nextNodes); setEdges(nextEdges); setSelectedNodeIds(new Set())
                pushHistory(nextNodes, nextEdges)
              }}
              className="mt-3 w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-danger hover:bg-danger-soft rounded-md"
            >
              <Trash2 size={12} /> Remover seleção
            </button>
            <button
              onClick={() => setSelectedNodeIds(new Set())}
              className="mt-1.5 w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-text-muted hover:bg-surface-2 rounded-md"
            >
              <X size={12} /> Cancelar seleção
            </button>
          </aside>
        )}

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

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Prévia do fluxo" subtitle="Simulação do caminho no Telegram" size="md"
        footer={<Btn variant="primary" onClick={() => setPreviewOpen(false)}>Fechar</Btn>}>
        <PreviewChat nodes={nodes} edges={edges} />
      </Modal>

      {/* Modal de configurações do fluxo */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Configurações do fluxo" size="md"
        footer={<Btn variant="primary" onClick={() => setSettingsOpen(false)}>Fechar</Btn>}>
        <div className="space-y-5">
          {/* Descrição */}
          <div>
            <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Descrição</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o objetivo deste fluxo…"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-snug"
              maxLength={300}
            />
            <div className="text-[11px] text-text-subtle mt-1 text-right">{description.length}/300</div>
          </div>

          {/* Gatilho */}
          <div>
            <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2">Gatilho de ativação</label>
            <div className="space-y-2.5">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-surface-2 transition-colors" style={{ borderColor: triggerType === 'start' ? 'var(--primary)' : undefined, background: triggerType === 'start' ? 'color-mix(in oklab, var(--primary) 6%, var(--surface))' : undefined }}>
                <input type="radio" value="start" checked={triggerType === 'start'} onChange={() => setTriggerType('start')} className="mt-0.5 accent-[var(--primary)]" />
                <div>
                  <div className="text-[13px] font-semibold text-text">Comando /start</div>
                  <div className="text-[11.5px] text-text-muted mt-0.5">Ativado quando o usuário inicia uma conversa com o bot pela primeira vez ou envia /start.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-surface-2 transition-colors" style={{ borderColor: triggerType === 'keyword' ? 'var(--primary)' : undefined, background: triggerType === 'keyword' ? 'color-mix(in oklab, var(--primary) 6%, var(--surface))' : undefined }}>
                <input type="radio" value="keyword" checked={triggerType === 'keyword'} onChange={() => setTriggerType('keyword')} className="mt-0.5 accent-[var(--primary)]" />
                <div>
                  <div className="text-[13px] font-semibold text-text">Palavra-chave</div>
                  <div className="text-[11.5px] text-text-muted mt-0.5">Ativado quando o usuário envia uma mensagem contendo as palavras definidas abaixo.</div>
                </div>
              </label>
            </div>
          </div>

          {/* Palavras-chave */}
          {triggerType === 'keyword' && (
            <div>
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Palavras-chave</label>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {keywords.map((kw, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-soft text-primary border border-primary/20 rounded-md text-[12px] font-medium">
                      <Hash size={9} /> {kw}
                      <button onClick={() => setKeywords(keywords.filter((_, j) => j !== i))} className="ml-0.5 opacity-60 hover:opacity-100"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && kwInput.trim()) {
                      e.preventDefault()
                      const kw = kwInput.trim().toLowerCase()
                      if (!keywords.includes(kw)) setKeywords(prev => [...prev, kw])
                      setKwInput('')
                    }
                  }}
                  placeholder="Digite e pressione Enter…"
                  className="flex-1 h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
                <button
                  onClick={() => {
                    const kw = kwInput.trim().toLowerCase()
                    if (kw && !keywords.includes(kw)) { setKeywords(prev => [...prev, kw]); setKwInput('') }
                  }}
                  className="h-9 px-3 bg-primary text-primary-fg rounded-lg hover:bg-primary/90 inline-flex items-center justify-center">
                  <Plus size={14} />
                </button>
              </div>
              <div className="text-[11.5px] text-text-muted mt-1.5 leading-snug">
                Ex.: &ldquo;preço&rdquo;, &ldquo;comprar&rdquo;, &ldquo;produto&rdquo;. A correspondência não diferencia maiúsculas de minúsculas.
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal — sair com mudanças não salvas */}
      {backConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--warning-soft)' }}>
                <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-text leading-snug">Sair sem salvar?</h3>
                <p className="text-[12.5px] text-text-muted mt-1 leading-relaxed">Você tem alterações não salvas. Se sair agora, elas serão descartadas.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setBackConfirmOpen(false)}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                Continuar editando
              </button>
              <button
                onClick={onBack}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-danger hover:bg-danger/10 transition-colors"
              >
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FlowsClient (componente principal) ────────────────────────────────────────

export default function FlowsClient({ initialFlows, bots, userId, statsMap }: {
  initialFlows: RawFlowRow[]
  bots: RawBotOption[]
  userId: string
  statsMap: FlowStatsMap
}) {
  const { track } = useAnalytics()
  const [flows, setFlows]             = useState<FlowMeta[]>(
    initialFlows.map(r => mapRawMeta({
      ...r,
      revenue: statsMap[r.id]?.revenue ?? 0,
      sales:   statsMap[r.id]?.sales   ?? 0,
      leads:   statsMap[r.id]?.leads   ?? 0,
    }))
  )
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editorData, setEditorData]   = useState<FlowEditorData | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [creating, setCreating]       = useState(false)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
  }

  // Realtime — sincroniza listagem entre dispositivos
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('flows-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as RawFlowRow
          setFlows(arr => arr.map(f => f.id === updated.id ? mapRawMeta(updated) : f))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const inserted = payload.new as RawFlowRow
          setFlows(arr => arr.some(f => f.id === inserted.id) ? arr : [mapRawMeta(inserted), ...arr])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const deleted = payload.old as { id: string }
          setFlows(arr => arr.filter(f => f.id !== deleted.id))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Carrega nodes+edges ao abrir o editor
  useEffect(() => {
    if (!editingId) { setEditorData(null); return }
    setEditorLoading(true)
    const supabase = createClient()
    supabase
      .from('flows')
      .select('id, name, bot, bot_color, status, executions, conversion, description, updated_at, nodes, edges, trigger_type, keywords')
      .eq('id', editingId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setEditorData(mapRawFull(data as unknown as Record<string, unknown>))
        } else {
          showToast('Erro ao carregar o fluxo.', 'error')
          setEditingId(null)
        }
        setEditorLoading(false)
      })
  }, [editingId])

  async function createFlow(template?: FlowTemplate) {
    if (creating) return
    setCreating(true)
    const supabase = createClient()
    const name = template && template.id !== 'blank' ? template.name : 'Novo fluxo'
    const nodes = template?.nodes ?? []
    const edges = template?.edges ?? []

    const { data, error } = await supabase
      .from('flows')
      .insert({ user_id: userId, name, status: 'draft', description: '', nodes, edges })
      .select('id')
      .single()

    if (error || !data) {
      showToast('Erro ao criar fluxo. Tente novamente.', 'error')
      setCreating(false)
      return
    }

    const newMeta: FlowMeta = {
      id: data.id,
      name,
      bot: '',
      botColor: '#6366f1',
      status: 'draft',
      executions: 0,
      conversion: 0,
      revenue: 0,
      sales: 0,
      leads: 0,
      updatedAt: Date.now(),
      description: '',
    }
    setFlows(arr => [newMeta, ...arr])
    setCreating(false)
    setEditingId(data.id)
    track('flow_created', { flow_name: name })
  }

  async function duplicateFlow(id: string) {
    if (duplicating) return
    setDuplicating(true)
    const supabase = createClient()

    // Busca o fluxo completo (com nodes e edges)
    const { data: src, error: srcErr } = await supabase
      .from('flows')
      .select('name, bot, bot_color, description, nodes, edges, trigger_type, keywords')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (srcErr || !src) {
      showToast('Erro ao duplicar o fluxo.', 'error')
      setDuplicating(false)
      return
    }

    const { data, error } = await supabase
      .from('flows')
      .insert({
        user_id:      userId,
        name:         `${src.name} (cópia)`,
        bot:          src.bot,
        bot_color:    src.bot_color,
        description:  src.description,
        status:       'draft',
        nodes:        src.nodes ?? [],
        edges:        src.edges ?? [],
        trigger_type: (src as Record<string, unknown>).trigger_type ?? 'start',
        keywords:     (src as Record<string, unknown>).keywords ?? [],
      })
      .select('id')
      .single()

    if (error || !data) {
      showToast('Erro ao duplicar o fluxo.', 'error')
      setDuplicating(false)
      return
    }

    const original = flows.find(f => f.id === id)
    const newMeta: FlowMeta = {
      id: data.id,
      name: `${src.name} (cópia)`,
      bot: original?.bot ?? '',
      botColor: original?.botColor ?? '#6366f1',
      status: 'draft',
      executions: 0,
      conversion: 0,
      revenue: 0,
      sales: 0,
      leads: 0,
      updatedAt: Date.now(),
      description: src.description ?? '',
    }
    // (triggerType/keywords vivem em FlowEditorData, não em FlowMeta — não precisam aqui)
    setFlows(arr => [newMeta, ...arr])
    setDuplicating(false)
    showToast('Fluxo duplicado com sucesso.', 'success')
  }

  async function saveFlow(updated: FlowEditorData): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from('flows')
      .update({
        name:         updated.name,
        bot:          updated.bot,
        bot_color:    updated.botColor,
        status:       updated.status,
        description:  updated.description,
        nodes:        updated.nodes,
        edges:        updated.edges,
        trigger_type: updated.triggerType,
        keywords:     updated.keywords,
      })
      .eq('id', updated.id)
      .eq('user_id', userId)

    if (error) {
      showToast('Erro ao salvar. Verifique sua conexão.', 'error')
      return false
    }

    setFlows(arr => arr.map(f => f.id === updated.id
      ? { ...f, name: updated.name, bot: updated.bot, botColor: updated.botColor, status: updated.status, description: updated.description, updatedAt: Date.now() }
      : f
    ))
    return true
  }

  async function publishFlow(updated: FlowEditorData): Promise<boolean> {
    const toPublish = { ...updated, status: 'published' as const }
    const ok = await saveFlow(toPublish)
    if (!ok) return false

    const supabase = createClient()

    // Vincula fluxo como ativo no bot selecionado (fire-and-forget)
    const botEntry = bots.find(b => (b.username ? `@${b.username}` : b.name) === updated.bot)
    if (botEntry) {
      supabase.from('bots').update({ active_flow_id: updated.id }).eq('id', botEntry.id).eq('user_id', userId).then()
    }

    // Registra activity_event (fire-and-forget)
    supabase.from('activity_events').insert({
      user_id:     userId,
      type:        'flowPublished',
      title:       'Fluxo publicado',
      description: `Fluxo "${updated.name}" publicado com ${updated.nodes.length} nós.`,
    }).then()

    track('flow_published', { flow_name: updated.name, node_count: updated.nodes.length })
    showToast(`Fluxo "${updated.name}" publicado!`, 'success')
    return true
  }

  async function deleteFlow(id: string) {
    if (deleting) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('flows')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      showToast('Erro ao apagar o fluxo.', 'error')
      setDeleting(false)
      setDeleteId(null)
      return
    }

    setFlows(arr => arr.filter(f => f.id !== id))
    setDeleting(false)
    setDeleteId(null)
    track('flow_deleted', {})
  }

  // ── Editor carregando ────────────────────────────────────────────────────────
  if (editingId && editorLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  // ── Editor aberto ────────────────────────────────────────────────────────────
  if (editingId && editorData) {
    return (
      <>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <FlowEditor
          flow={editorData}
          bots={bots}
          onBack={() => setEditingId(null)}
          onSave={saveFlow}
          onPublish={publishFlow}
          showToast={showToast}
          userId={userId}
        />
      </>
    )
  }

  // ── Listagem ─────────────────────────────────────────────────────────────────
  const flowToDelete = flows.find(f => f.id === deleteId)

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Modal de templates */}
      <TemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={tpl => createFlow(tpl)}
      />

      {/* Modal de confirmação de exclusão */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Apagar fluxo"
        subtitle={flowToDelete ? `"${flowToDelete.name}"` : undefined}
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deleteId && deleteFlow(deleteId)} disabled={deleting}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Apagar
            </Btn>
          </>
        }
      >
        <p className="text-[13px] text-text-muted leading-relaxed">
          Esta ação não pode ser desfeita. O fluxo será removido permanentemente, incluindo toda a configuração de nós e conexões.
        </p>
        {flowToDelete?.status === 'published' && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-warning-soft border border-warning/20 rounded-lg text-[12px] text-warning">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            Este fluxo está publicado. Bots vinculados a ele perderão a referência.
          </div>
        )}
      </Modal>

      <FlowsList
        flows={flows}
        onOpen={id => setEditingId(id)}
        onCreate={() => createFlow()}
        onOpenTemplates={() => setShowTemplates(true)}
        onDelete={setDeleteId}
        onDuplicate={duplicateFlow}
        creating={creating || duplicating}
      />
    </>
  )
}
