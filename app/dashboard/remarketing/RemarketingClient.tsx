'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, CheckCircle2, Snowflake, LogOut, Gift, Moon, Tag,
  Play, Users, CircleDollarSign, Target, Search, ArrowUpRight, ArrowDownRight,
  Layers, ChevronUp, ChevronDown, Trash2, ShoppingBag, X, Plus,
  ChevronLeft, Check, Eye, Save, Pause, ArrowDown, MessageSquarePlus,
  HelpCircle, Copy, Loader2, Bot, FileDown, History, Clock,
  Image as ImageIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'
import { listBotFlowButtonsAction } from '@/app/actions/flows'
import type { FlowWithButtons } from '@/app/dashboard/flows/_shared/types'
import MediaLibraryModal from '@/app/dashboard/flows/_editor/MediaLibraryModal'
import type { MediaItem } from '@/app/actions/media'

/* ── Raw types (from Supabase) ───────────────────────────────── */

export interface RawCampaign {
  id: string
  name: string
  description: string
  trigger_type: string
  audience: string
  trigger_config: Record<string, string | number>
  status: 'active' | 'paused' | 'draft' | 'finished'
  leads_recovered: number
  revenue_recovered: number
  leads_triggered: number
  conversion: number
  steps: CampaignStep[]
  step_stats?: number[]  // omitido na listagem SSR; lazy-load ao abrir editor
  bot_id: string | null
  created_at: string
  updated_at: string
}

export interface RawBotOption {
  id: string
  name: string
  username: string | null
  color: string | null
}

interface RawExecution {
  id: string
  step_index: number
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  message_sent: string | null
  error_message: string | null
  scheduled_at: string
  executed_at: string | null
}

/* ── App types ───────────────────────────────────────────────── */

interface TriggerInfo {
  label: string
  icon: string
  color: string
  desc: string
  configFields?: Array<{ key: string; label: string; placeholder: string; type?: string }>
}

interface StatusInfo {
  label: string
  tone: 'success' | 'warning' | 'muted' | 'primary'
  dot: boolean
}

interface StepOffer {
  product: string
  price: number
  cta: string
}

interface StepButton {
  label: string
  url: string
}

interface StepDelay {
  amount: number
  unit: string
}

interface StepFlowRef {
  flowId: string
  nodeId: string
  flowName: string
  options: string[]
}

interface StepMedia {
  kind: 'image' | 'video'
  fileId?: string   // da Biblioteca de Mídia (file_id por-bot)
  url?: string      // alternativa por URL pública
}

export interface CampaignStep {
  id: string
  delay: StepDelay
  message: string
  offer: StepOffer | null
  buttons?: StepButton[]
  flowRef?: StepFlowRef | null   // reusar botões de um nó de fluxo para continuar o fluxo
  media?: StepMedia[]            // imagens/vídeos enviados com a mensagem (até 10 = álbum)
}

type CampaignStatus = 'active' | 'paused' | 'draft' | 'finished'

interface Campaign {
  id: string
  name: string
  description: string
  trigger: string
  audience: string
  triggerConfig: Record<string, string | number>
  status: CampaignStatus
  botId: string | null
  leadsRecovered: number
  revenueRecovered: number
  leadsTriggered: number
  conversion: number
  steps: CampaignStep[]
  stepStats: number[]
  createdAt: number
  updatedAt: number
}

/* ── Constants ───────────────────────────────────────────────── */

const TRIGGERS: Record<string, TriggerInfo> = {
  carrinho_abandonado: {
    label: 'Carrinho abandonado', icon: 'shopping-cart', color: 'var(--warning)',
    desc: 'Dispara quando o lead inicia o checkout mas não conclui o pagamento.',
  },
  compra_concluida: {
    label: 'Após compra', icon: 'check-circle-2', color: 'var(--success)',
    desc: 'Dispara imediatamente após uma venda confirmada.',
  },
  nao_comprou_72h: {
    label: 'Lead frio', icon: 'snowflake', color: 'oklch(0.62 0.10 240)',
    desc: 'Lead sem compra após X horas do primeiro contato.',
    configFields: [{ key: 'hours', label: 'Horas sem compra', placeholder: 'Ex: 72', type: 'number' }],
  },
  abandonou_funil: {
    label: 'Abandonou funil', icon: 'log-out', color: 'var(--danger)',
    desc: 'Saiu do funil sem chegar até a etapa final.',
  },
  aniversario: {
    label: 'Aniversário', icon: 'gift', color: 'oklch(0.66 0.18 320)',
    desc: 'Dispara no aniversário do cliente.',
  },
  inatividade: {
    label: 'Inatividade', icon: 'moon', color: 'oklch(0.58 0.05 280)',
    desc: 'Cliente sem interagir há mais de N dias.',
    configFields: [{ key: 'days', label: 'Dias de inatividade', placeholder: 'Ex: 30', type: 'number' }],
  },
  nao_respondeu: {
    label: 'Não respondeu', icon: 'clock', color: 'oklch(0.60 0.16 25)',
    desc: 'Envia quando o lead para de responder o bot por um tempo. Você escolhe os dias e o horário.',
    // Configuração (tempo sem resposta + dias + horário) via UI de agenda customizada.
  },
  tag_adicionada: {
    label: 'Tag adicionada', icon: 'tag', color: 'var(--primary)',
    desc: 'Quando uma tag específica é adicionada ao contato.',
    configFields: [{ key: 'tag', label: 'Tag gatilho', placeholder: 'Ex: Carrinho, Black25…' }],
  },
}

const AUDIENCES: Record<string, string> = {
  all:        'Todos os contatos',
  leads:      'Apenas leads (não compradores)',
  buyers:     'Apenas compradores',
  recent:     'Contatos recentes (≤ 30 dias)',
  with_tag:   'Com tag específica',
  by_product: 'Compraram um produto específico',
}

const STATUS_MAP: Record<CampaignStatus, StatusInfo> = {
  active:   { label: 'Ativa',      tone: 'success', dot: true  },
  paused:   { label: 'Pausada',    tone: 'warning', dot: false },
  draft:    { label: 'Rascunho',   tone: 'muted',   dot: false },
  finished: { label: 'Finalizada', tone: 'primary', dot: false },
}

const STEP_UNITS = ['minutos', 'horas', 'dias']
const DELAY_PRESETS = [
  { label: 'Imediato', amount: 0,  unit: 'minutos' },
  { label: '30 min',   amount: 30, unit: 'minutos' },
  { label: '1 h',      amount: 1,  unit: 'horas'   },
  { label: '24 h',     amount: 24, unit: 'horas'   },
  { label: '72 h',     amount: 72, unit: 'horas'   },
  { label: '7 dias',   amount: 7,  unit: 'dias'    },
]

const WEEKDAYS = [
  { d: 0, label: 'Dom' }, { d: 1, label: 'Seg' }, { d: 2, label: 'Ter' },
  { d: 3, label: 'Qua' }, { d: 4, label: 'Qui' }, { d: 5, label: 'Sex' }, { d: 6, label: 'Sáb' },
]
const FIELD_CLS = 'w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30'
const SUBLABEL_CLS = 'block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5'

// Configuração do gatilho "Não respondeu": tempo sem resposta + dias + horário.
function NoReplyScheduleConfig({ config, onChange }: {
  config: Record<string, string | number>
  onChange: (patch: Record<string, string | number>) => void
}) {
  const amount = Number(config.amount ?? 24)
  const unit   = String(config.unit ?? 'horas')
  const selectedDays: number[] =
    config.days === undefined || config.days === ''
      ? [0, 1, 2, 3, 4, 5, 6]
      : String(config.days).split(',').map(Number).filter((n) => n >= 0 && n <= 6)
  const startHour = Number(config.startHour ?? 9)
  const endHour   = Number(config.endHour ?? 21)

  const toggleDay = (d: number) => {
    const set = new Set(selectedDays)
    if (set.has(d)) set.delete(d); else set.add(d)
    onChange({ days: [...set].sort((a, b) => a - b).join(',') })
  }

  return (
    <div className="md:col-span-2 space-y-3 rounded-xl border border-border bg-surface/40 p-3">
      <div>
        <label className={SUBLABEL_CLS}>Tempo sem resposta</label>
        <div className="flex gap-2">
          <input type="number" min={1} value={amount}
            onChange={(e) => onChange({ amount: Math.max(1, Number(e.target.value)) })}
            className={FIELD_CLS + ' max-w-[110px]'} />
          <select value={unit} onChange={(e) => onChange({ unit: e.target.value })} className={FIELD_CLS}>
            <option value="minutos">minutos</option>
            <option value="horas">horas</option>
            <option value="dias">dias</option>
          </select>
        </div>
        <p className="text-[10.5px] text-text-muted mt-1">Depois desse tempo sem o lead responder, a mensagem é enviada (respeitando os dias e o horário abaixo).</p>
      </div>

      <div>
        <label className={SUBLABEL_CLS}>Dias de envio</label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => {
            const on = selectedDays.includes(w.d)
            return (
              <button key={w.d} type="button" onClick={() => toggleDay(w.d)}
                className="px-2.5 h-8 rounded-lg text-[11.5px] font-medium border transition-colors"
                style={{
                  background:  on ? 'var(--primary)' : 'var(--surface)',
                  color:       on ? '#fff' : 'var(--text-muted)',
                  borderColor: on ? 'var(--primary)' : 'var(--border)',
                }}>
                {w.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className={SUBLABEL_CLS}>Horário de envio (fuso de São Paulo)</label>
        <div className="flex items-center gap-2">
          <select value={startHour} onChange={(e) => onChange({ startHour: Number(e.target.value) })} className={FIELD_CLS + ' max-w-[110px]'}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
          </select>
          <span className="text-text-muted text-[12px]">até</span>
          <select value={endHour} onChange={(e) => onChange({ endHour: Number(e.target.value) })} className={FIELD_CLS + ' max-w-[110px]'}>
            {Array.from({ length: 24 }, (_, i) => { const h = i + 1; return <option key={h} value={h}>{String(h).padStart(2, '0')}h</option> })}
          </select>
        </div>
        <p className="text-[10.5px] text-text-muted mt-1">Fora dessa janela, o envio espera o próximo horário permitido.</p>
      </div>
    </div>
  )
}

const TEMPLATES: Array<{ id: string; name: string; trigger: string; audience: string; steps: CampaignStep[] }> = [
  {
    id: 't1', name: 'Carrinho abandonado 24h', trigger: 'carrinho_abandonado', audience: 'leads',
    steps: [
      { id: 's1', delay: { amount: 1,  unit: 'horas' }, message: 'Oi {nome}! Vi que você quase fechou {produto}. Posso te ajudar com algo?', offer: null },
      { id: 's2', delay: { amount: 24, unit: 'horas' }, message: 'Última chance! Seu cupom de 10% expira em 24 h. Vamos finalizar?', offer: { product: 'Seu produto', price: 97, cta: 'Garantir minha vaga' } },
      { id: 's3', delay: { amount: 48, unit: 'horas' }, message: 'Tudo bem se não foi o momento. Quando estiver pronto, é só responder esta mensagem.', offer: null },
    ],
  },
  {
    id: 't2', name: 'Boas-vindas + Oferta de entrada', trigger: 'tag_adicionada', audience: 'recent',
    steps: [
      { id: 's1', delay: { amount: 5,  unit: 'minutos' }, message: 'Olá {nome}, bem-vindo! Fico feliz em te ter aqui. Tenho um conteúdo especial pra você.', offer: null },
      { id: 's2', delay: { amount: 2,  unit: 'horas'   }, message: 'Você tem alguns minutos? Posso te enviar um material gratuito que vai mudar sua perspectiva.', offer: null },
      { id: 's3', delay: { amount: 24, unit: 'horas'   }, message: 'Que tal dar o próximo passo? Tenho uma oferta especial pra você hoje.', offer: { product: 'Produto de entrada', price: 47, cta: 'Quero aproveitar' } },
    ],
  },
  {
    id: 't3', name: 'Reativação 30 dias', trigger: 'inatividade', audience: 'all',
    steps: [
      { id: 's1', delay: { amount: 0,  unit: 'minutos' }, message: 'Faz um tempo, {nome}! Senti sua falta por aqui. Posso te mostrar o que mudou?', offer: null },
      { id: 's2', delay: { amount: 72, unit: 'horas'   }, message: 'Só pra ter certeza que você está bem. Se precisar de algo, é só me chamar.', offer: null },
    ],
  },
  {
    id: 't4', name: 'Upsell pós-compra', trigger: 'compra_concluida', audience: 'buyers',
    steps: [
      { id: 's1', delay: { amount: 2,  unit: 'horas' }, message: 'Parabéns pela compra, {nome}! Antes de começar, separei algo que vai potencializar seu resultado.', offer: { product: 'Produto complementar', price: 67, cta: 'Adicionar ao plano' } },
      { id: 's2', delay: { amount: 48, unit: 'horas' }, message: 'Tudo certo com seu acesso? Se precisar, eu estou aqui.', offer: null },
    ],
  },
]

/* ── Helpers ─────────────────────────────────────────────────── */

function mapRaw(r: RawCampaign): Campaign {
  return {
    id:               r.id,
    name:             r.name,
    description:      r.description ?? '',
    trigger:          r.trigger_type ?? 'carrinho_abandonado',
    audience:         r.audience ?? 'all',
    triggerConfig:    r.trigger_config ?? {},
    status:           r.status ?? 'draft',
    botId:            r.bot_id ?? null,
    leadsRecovered:   Number(r.leads_recovered  ?? 0),
    revenueRecovered: Number(r.revenue_recovered ?? 0),
    leadsTriggered:   Number(r.leads_triggered   ?? 0),
    conversion:       Number(r.conversion        ?? 0),
    steps:            Array.isArray(r.steps)      ? r.steps      : [],
    stepStats:        Array.isArray(r.step_stats) ? r.step_stats : [],
    createdAt:        new Date(r.created_at).getTime() || Date.now(),
    updatedAt:        new Date(r.updated_at).getTime() || Date.now(),
  }
}

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRL(n: number) { return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function fmtPct(n: number) { return `${n.toFixed(1)}%` }
function fmtDate(ts: number) { return new Date(ts).toLocaleDateString('pt-BR') }
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function exportCSV(campaigns: Campaign[]) {
  const rows: string[][] = [
    ['Nome', 'Gatilho', 'Público', 'Status', 'Etapas', 'Leads recuperados', 'Receita recuperada (R$)', 'Conversão (%)', 'Criado em'],
    ...campaigns.map((c) => [
      c.name,
      TRIGGERS[c.trigger]?.label ?? c.trigger,
      AUDIENCES[c.audience] ?? c.audience,
      STATUS_MAP[c.status].label,
      String(c.steps.length),
      String(c.leadsRecovered),
      c.revenueRecovered.toFixed(2),
      c.conversion.toFixed(1),
      fmtDate(c.createdAt),
    ]),
  ]
  const bom = '﻿'
  const content = bom + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `remarketing_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Icon system ─────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  'shopping-cart': ShoppingCart, 'check-circle-2': CheckCircle2, 'snowflake': Snowflake,
  'log-out': LogOut, 'gift': Gift, 'moon': Moon, 'tag': Tag, 'play': Play,
  'users': Users, 'circle-dollar-sign': CircleDollarSign, 'target': Target,
  'search': Search, 'arrow-up-right': ArrowUpRight, 'arrow-down-right': ArrowDownRight,
  'layers': Layers, 'chevron-up': ChevronUp, 'chevron-down': ChevronDown,
  'trash-2': Trash2, 'shopping-bag': ShoppingBag, 'x': X, 'plus': Plus,
  'chevron-left': ChevronLeft, 'check': Check, 'eye': Eye, 'save': Save,
  'pause': Pause, 'arrow-down': ArrowDown, 'message-square-plus': MessageSquarePlus,
  'copy': Copy, 'bot': Bot, 'file-down': FileDown, 'history': History, 'clock': Clock,
  'image': ImageIcon,
}

function Icon({ name, size = 16, className, style }: {
  name: string; size?: number; className?: string; style?: React.CSSProperties
}) {
  const I = ICON_MAP[name] ?? HelpCircle
  return <I size={size} className={className} style={style} />
}

/* ── Base UI ─────────────────────────────────────────────────── */

type BadgeTone = 'success' | 'warning' | 'muted' | 'primary' | 'danger'
const BADGE_CLS: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  muted:   'bg-surface-2 text-text-muted',
  primary: 'bg-primary-soft text-primary',
  danger:  'bg-danger-soft text-danger',
}

function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10.5px] font-semibold ${BADGE_CLS[tone]}`}>
      {children}
    </span>
  )
}

function Btn({ children, variant = 'secondary', size = 'md', icon, disabled, loading, onClick, className = '' }: {
  children?: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'; icon?: string; disabled?: boolean; loading?: boolean
  onClick?: () => void; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-colors'
  const sz   = size === 'sm' ? 'h-8 px-2.5 text-[12px]' : 'h-9 px-3.5 text-[13px]'
  const vr   = variant === 'primary' ? 'bg-primary text-primary-fg hover:opacity-90' :
               variant === 'ghost'   ? 'text-text-muted hover:bg-surface-2 hover:text-text' :
               variant === 'danger'  ? 'bg-danger-soft text-danger hover:bg-danger/20 border border-danger/20' :
                                       'bg-surface-2 border border-border text-text hover:bg-surface-3'
  return (
    <button className={`${base} ${sz} ${vr} ${className}`} disabled={disabled || loading} onClick={onClick}>
      {loading ? <Loader2 size={size === 'sm' ? 12 : 13} className="animate-spin" /> : icon && <Icon name={icon} size={size === 'sm' ? 13 : 14} />}
      {children}
    </button>
  )
}

function Card({ children, title, subtitle, action, noPadding }: {
  children: React.ReactNode; title?: string; subtitle?: string
  action?: React.ReactNode; noPadding?: boolean
}) {
  return (
    <div className="bg-surface border border-border rounded-xl">
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-0">
          <div>
            {title    && <div className="text-[14px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[11.5px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

function Modal({ open, onClose, title, subtitle, size = 'md', footer, children }: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  size?: 'sm' | 'md' | 'lg'; footer?: React.ReactNode; children: React.ReactNode
}) {
  if (!open) return null
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${w} bg-surface border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]`}>
        {(title || subtitle) && (
          <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            {title    && <div className="text-[15px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function SelDrop({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div className="relative inline-flex items-center w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-3 pr-8 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none w-full"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <Icon name="chevron-down" size={13} className="absolute right-2.5 pointer-events-none text-text-muted" />
    </div>
  )
}

/* ── Toast ───────────────────────────────────────────────────── */

interface ToastState { msg: string; type: 'success' | 'error' }

function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null
  return (
    <div className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium border ${
      toast.type === 'success'
        ? 'bg-success-soft text-success border-success/20'
        : 'bg-danger-soft text-danger border-danger/20'
    }`}>
      <Icon name={toast.type === 'success' ? 'check' : 'x'} size={14} />
      {toast.msg}
    </div>
  )
}

/* ── KPI Card ────────────────────────────────────────────────── */

function KPI({ label, value, icon, delta, tone, highlight }: {
  label: string; value: string; icon: string
  delta?: number | null; tone?: string; highlight?: boolean
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tone === 'primary' ? 'bg-primary-soft text-primary' : highlight ? 'bg-success-soft text-success' : 'bg-surface-2 text-text-muted'}`}>
          <Icon name={icon} size={14} />
        </div>
      </div>
      <div className={`text-[24px] font-semibold tracking-tight leading-none ${highlight ? 'text-success' : 'text-text'}`}>{value}</div>
      {delta != null && (
        <div className="mt-2.5">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium text-[11px] ${positive ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
            <Icon name={positive ? 'arrow-up-right' : 'arrow-down-right'} size={11} />
            {fmtPct(Math.abs(delta))}
          </span>
          <span className="text-[11.5px] text-text-muted ml-1.5">vs. anterior</span>
        </div>
      )}
    </div>
  )
}

/* ── NoDataState ─────────────────────────────────────────────── */

function NoDataState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mb-4">
        <Icon name="layers" size={28} />
      </div>
      <h3 className="text-[16px] font-semibold text-text">Nenhuma campanha ainda</h3>
      <p className="text-[13px] text-text-muted mt-1.5 max-w-xs leading-snug">
        Crie sua primeira sequência de remarketing para recuperar leads e impulsionar recompras.
      </p>
      <div className="flex items-center gap-2 mt-5">
        <Btn variant="secondary" icon="eye" onClick={onCreate}>Usar template</Btn>
        <Btn variant="primary" icon="plus" onClick={onCreate}>Nova campanha</Btn>
      </div>
    </div>
  )
}

/* ── Campaign Card ───────────────────────────────────────────── */

function CardStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-[15px] font-semibold leading-none tracking-tight ${highlight ? 'text-success' : 'text-text'}`}>{value}</div>
      <div className="text-[10.5px] text-text-muted mt-1 leading-tight">{label}</div>
    </div>
  )
}

function CampaignCard({ campaign, onOpen, onDuplicate, onDelete }: {
  campaign: Campaign
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const st = STATUS_MAP[campaign.status]
  const tr = TRIGGERS[campaign.trigger]

  return (
    <div className="group relative bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors">
      <div
        role="button" tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
        className="cursor-pointer focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={st.tone}>
              {st.dot && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
              {st.label}
            </Badge>
            <div className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-surface-2 border border-border text-[10.5px] font-medium" style={{ color: tr?.color }}>
              <Icon name={tr?.icon ?? 'layers'} size={10} />
              {tr?.label ?? campaign.trigger}
            </div>
          </div>
          <span className="text-[10.5px] text-text-subtle shrink-0">{fmtDate(campaign.updatedAt)}</span>
        </div>

        <h3 className="text-[14.5px] font-semibold text-text leading-snug mt-2.5">{campaign.name}</h3>
        <p className="text-[12px] text-text-muted mt-1 leading-snug line-clamp-2 max-w-md">{campaign.description}</p>

        <div className="mt-3 flex items-center gap-3 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1"><Icon name="users" size={11} /> {(AUDIENCES[campaign.audience] ?? '').split('(')[0].trim()}</span>
          <span className="inline-flex items-center gap-1"><Icon name="layers" size={11} /> {campaign.steps.length} {campaign.steps.length === 1 ? 'etapa' : 'etapas'}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
          <CardStat label="Leads"     value={fmtNum(campaign.leadsRecovered)} />
          <CardStat label="Receita"   value={campaign.revenueRecovered > 0 ? fmtBRL(campaign.revenueRecovered) : '—'} highlight={campaign.revenueRecovered > 0} />
          <CardStat label="Conversão" value={campaign.conversion > 0 ? fmtPct(campaign.conversion) : '—'} />
        </div>
      </div>

      {/* Ações rápidas no hover */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          className="w-7 h-7 rounded-md bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-2 flex items-center justify-center focus:outline-none"
        >
          <Icon name="chevron-down" size={13} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-8 right-0 z-20 bg-surface border border-border rounded-xl shadow-xl py-1 w-44">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpen() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text hover:bg-surface-2 text-left">
                <Icon name="eye" size={13} /> Abrir editor
              </button>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text hover:bg-surface-2 text-left">
                <Icon name="copy" size={13} /> Duplicar
              </button>
              <div className="my-1 border-t border-border" />
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-danger hover:bg-danger-soft text-left">
                <Icon name="trash-2" size={13} /> Apagar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Templates Modal ─────────────────────────────────────────── */

function TemplatesModal({ open, onClose, onCreate }: {
  open: boolean
  onClose: () => void
  onCreate: (tpl: typeof TEMPLATES[0]) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Templates de campanha" subtitle="Escolha um ponto de partida" size="lg"
      footer={<Btn variant="secondary" onClick={onClose}>Fechar</Btn>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TEMPLATES.map((tpl) => {
          const tr = TRIGGERS[tpl.trigger]
          return (
            <button
              key={tpl.id}
              onClick={() => { onCreate(tpl); onClose() }}
              className="text-left p-4 bg-surface-2/50 border border-border rounded-xl hover:border-primary hover:bg-primary-soft/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: tr?.color + '22', color: tr?.color }}>
                  <Icon name={tr?.icon ?? 'layers'} size={13} />
                </div>
                <span className="text-[10.5px] font-semibold text-text-muted">{tr?.label}</span>
              </div>
              <div className="text-[13px] font-semibold text-text">{tpl.name}</div>
              <div className="text-[11.5px] text-text-muted mt-1">{tpl.steps.length} etapas · {AUDIENCES[tpl.audience]?.split(' ')[0]}</div>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

/* ── Delete Confirm Modal ────────────────────────────────────── */

function DeleteModal({ open, name, loading, onClose, onConfirm }: {
  open: boolean; name: string; loading: boolean; onClose: () => void; onConfirm: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Apagar campanha" size="sm"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Btn>
          <Btn variant="danger" icon="trash-2" loading={loading} onClick={onConfirm}>Apagar</Btn>
        </>
      }
    >
      <p className="text-[13px] text-text-muted">
        Tem certeza que deseja apagar a campanha <strong className="text-text">{name}</strong>? Esta ação não pode ser desfeita.
      </p>
    </Modal>
  )
}

/* ── Step Card ───────────────────────────────────────────────── */

const INPUT_CLS = 'w-full h-8 px-2 bg-surface border border-border rounded-md text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'

// Picker de fluxo + nó de botões (Remarketing → continuar fluxo).
function FlowButtonPicker({ flows, onPick }: {
  flows: FlowWithButtons[]
  onPick: (ref: { flowId: string; nodeId: string; flowName: string; options: string[] }) => void
}) {
  const [flowId, setFlowId] = useState('')
  const flow = flows.find((f) => f.flowId === flowId)
  return (
    <div className="space-y-2">
      <select className={INPUT_CLS} value={flowId} onChange={(e) => setFlowId(e.target.value)}>
        <option value="">Escolha um fluxo…</option>
        {flows.map((f) => <option key={f.flowId} value={f.flowId}>{f.flowName}</option>)}
      </select>
      {flow && (
        <div className="space-y-1.5">
          <p className="text-[10.5px] text-text-muted">Escolha o grupo de botões para reusar:</p>
          {flow.nodes.map((n) => (
            <button key={n.nodeId} type="button"
              onClick={() => onPick({ flowId: flow.flowId, nodeId: n.nodeId, flowName: flow.flowName, options: n.options })}
              className="w-full text-left px-2.5 py-1.5 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors focus:outline-none">
              <div className="flex flex-wrap gap-1">
                {n.options.map((o, i) => (
                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-surface border border-primary/30 text-primary">{o}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StepCard({ step, index, total, onUpdate, onDelete, onMoveUp, onMoveDown, flowButtons, botId }: {
  step: CampaignStep; index: number; total: number
  flowButtons: FlowWithButtons[]
  botId: string | null
  onUpdate: (s: CampaignStep) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [libOpen, setLibOpen] = useState<null | 'image' | 'video'>(null)

  function setDelay(patch: Partial<StepDelay>) { onUpdate({ ...step, delay: { ...step.delay, ...patch } }) }
  function setMessage(v: string) { onUpdate({ ...step, message: v }) }
  function setOffer(patch: Partial<StepOffer>) { onUpdate({ ...step, offer: { ...(step.offer ?? { product: '', price: 0, cta: '' }), ...patch } }) }
  function removeOffer() { onUpdate({ ...step, offer: null }) }
  function addOffer() { onUpdate({ ...step, offer: { product: 'Novo produto', price: 100, cta: 'Comprar agora' } }) }

  const media = step.media ?? []
  function addMediaFromLibrary(item: MediaItem) {
    if (media.length >= 10) return
    onUpdate({ ...step, media: [...media, { kind: item.media_type, fileId: item.file_id }] })
  }
  function addMediaUrl() {
    if (media.length >= 10) return
    const url = window.prompt('Cole a URL da imagem ou vídeo:')?.trim()
    if (!url) return
    const kind = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) ? 'video' : 'image'
    onUpdate({ ...step, media: [...media, { kind, url }] })
  }
  function removeMedia(i: number) { onUpdate({ ...step, media: media.filter((_, idx) => idx !== i) }) }

  const buttons = step.buttons ?? []
  function addButton() {
    if (buttons.length >= 3) return
    onUpdate({ ...step, buttons: [...buttons, { label: 'Clique aqui', url: '' }] })
  }
  function updateButton(i: number, patch: Partial<StepButton>) {
    onUpdate({ ...step, buttons: buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b) })
  }
  function removeButton(i: number) {
    onUpdate({ ...step, buttons: buttons.filter((_, idx) => idx !== i) })
  }

  function insertVar(v: string) {
    const ta = messageRef.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const insert = `{${v}}`
    const next = step.message.substring(0, s) + insert + step.message.substring(e)
    setMessage(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = s + insert.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const activePreset = DELAY_PRESETS.find((p) => p.amount === step.delay.amount && p.unit === step.delay.unit)
  const isFirst = step.delay.amount === 0

  return (
    <div className="bg-surface border border-border rounded-xl">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-6 h-6 rounded-md bg-primary-soft text-primary text-[11px] font-semibold flex items-center justify-center">{index + 1}</span>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-text">
              {isFirst ? 'Disparo imediato' : `Após ${step.delay.amount} ${step.delay.unit}`}
            </div>
            <div className="text-[10.5px] text-text-muted">
              {step.message.length > 0 ? `${step.message.length} caracteres` : 'Mensagem vazia'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onMoveUp(step.id)} disabled={index === 0}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 focus:outline-none">
            <Icon name="chevron-up" size={13} />
          </button>
          <button onClick={() => onMoveDown(step.id)} disabled={index === total - 1}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 focus:outline-none">
            <Icon name="chevron-down" size={13} />
          </button>
          <button onClick={() => onDelete(step.id)}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger focus:outline-none">
            <Icon name="trash-2" size={13} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">
            Atraso a partir {index === 0 ? 'do gatilho' : 'da etapa anterior'}
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DELAY_PRESETS.map((p) => {
              const isActive = activePreset?.label === p.label
              return (
                <button
                  key={p.label}
                  onClick={() => onUpdate({ ...step, delay: { amount: p.amount, unit: p.unit } })}
                  className={`h-7 px-2.5 text-[11.5px] font-medium rounded-md border focus:outline-none transition-colors ${
                    isActive ? 'bg-primary-soft text-primary border-primary/30' : 'bg-surface text-text-muted border-border hover:bg-surface-2 hover:text-text'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
            <div className="flex items-center gap-1 bg-surface border border-border rounded-md ml-1">
              <input
                type="number" min="0" value={step.delay.amount}
                onChange={(e) => setDelay({ amount: parseInt(e.target.value, 10) || 0 })}
                className="w-14 h-7 px-2 bg-transparent text-[12px] font-medium text-text focus:outline-none text-center"
              />
              <select
                value={step.delay.unit} onChange={(e) => setDelay({ unit: e.target.value })}
                className="h-7 pr-1 bg-transparent text-[11.5px] text-text-muted focus:outline-none"
              >
                {STEP_UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Mensagem</label>
          <textarea
            ref={messageRef} value={step.message} onChange={(e) => setMessage(e.target.value)}
            rows={3} placeholder="Sua mensagem aqui…"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[12.5px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed"
          />
          <div className="mt-1.5 flex flex-wrap gap-1 items-center text-[11px]">
            <span className="text-text-muted">Inserir:</span>
            {['nome', 'produto', 'valor', 'bot', 'data'].map((v) => (
              <button key={v} onClick={() => insertVar(v)} type="button"
                className="px-1.5 h-5 bg-surface-2 border border-border rounded font-mono text-[10.5px] text-text-muted hover:text-text hover:bg-surface-3 focus:outline-none">
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>

        {step.offer ? (
          <div className="bg-success-soft/40 border border-success/20 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-success">
                <Icon name="shopping-bag" size={11} /> Oferta anexada
              </div>
              <button onClick={removeOffer} className="text-[10.5px] text-text-muted hover:text-text inline-flex items-center gap-1 focus:outline-none rounded px-1">
                <Icon name="x" size={11} /> remover
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-text-subtle mb-1">Produto</label>
                <input value={step.offer.product} onChange={(e) => setOffer({ product: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-subtle mb-1">Preço (R$)</label>
                <input type="number" step="0.01" value={step.offer.price} onChange={(e) => setOffer({ price: parseFloat(e.target.value) || 0 })} className={INPUT_CLS} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-medium text-text-subtle mb-1">Texto do botão</label>
                <input value={step.offer.cta} onChange={(e) => setOffer({ cta: e.target.value })} className={INPUT_CLS} />
              </div>
            </div>
          </div>
        ) : (
          <button onClick={addOffer}
            className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-text-muted hover:text-success rounded-md border border-dashed border-border hover:border-success/50 focus:outline-none transition-colors">
            <Icon name="plus" size={11} /> Adicionar oferta nesta etapa
          </button>
        )}

        {/* Mídia — imagens/vídeos da Biblioteca (ou URL), até 10 = álbum */}
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2">
            <Icon name="image" size={11} /> Mídia (opcional)
          </div>
          {media.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {media.map((m, i) => (
                <div key={i} className="flex items-center gap-2 h-8 px-2 rounded-md bg-surface border border-border">
                  <Icon name={m.kind === 'video' ? 'play' : 'image'} size={12} />
                  <span className="text-[11.5px] text-text flex-1 min-w-0 truncate">
                    {m.kind === 'video' ? 'Vídeo' : 'Imagem'} · {m.fileId ? 'da biblioteca' : m.url}
                  </span>
                  <button onClick={() => removeMedia(i)}
                    className="w-6 h-6 inline-flex items-center justify-center rounded text-text-muted hover:bg-danger-soft hover:text-danger transition-colors focus:outline-none">
                    <Icon name="trash-2" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {media.length < 10 ? (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setLibOpen('image')}
                className="text-[11px] inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-text hover:bg-surface-2 transition-colors focus:outline-none">
                <Icon name="image" size={11} /> Imagem da biblioteca
              </button>
              <button onClick={() => setLibOpen('video')}
                className="text-[11px] inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-text hover:bg-surface-2 transition-colors focus:outline-none">
                <Icon name="play" size={11} /> Vídeo da biblioteca
              </button>
              <button onClick={addMediaUrl}
                className="text-[11px] inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-text-muted hover:bg-surface-2 transition-colors focus:outline-none">
                <Icon name="plus" size={11} /> Por URL
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Limite de 10 mídias por etapa atingido.</p>
          )}
          <p className="text-[11px] text-text-muted mt-1.5">Envie até 10 imagens/vídeos com a mensagem (2 ou mais viram um álbum).</p>
        </div>

        {/* Botões personalizados (inline com link) */}
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">
              <Icon name="arrow-up-right" size={11} /> Botões (opcional)
            </div>
            {buttons.length < 3 && (
              <button onClick={addButton} className="text-[10.5px] text-primary hover:underline inline-flex items-center gap-1 focus:outline-none rounded px-1">
                <Icon name="plus" size={10} /> Adicionar botão
              </button>
            )}
          </div>
          {buttons.length === 0 ? (
            <p className="text-[11px] text-text-muted">Adicione até 3 botões clicáveis com link (ex: “Comprar agora”, “Falar no WhatsApp”).</p>
          ) : (
            <div className="space-y-2">
              {buttons.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={b.label} onChange={(e) => updateButton(i, { label: e.target.value })}
                    placeholder="Texto do botão" className={`${INPUT_CLS} flex-1 min-w-0`} />
                  <input value={b.url} onChange={(e) => updateButton(i, { url: e.target.value })}
                    placeholder="https://…" inputMode="url" className={`${INPUT_CLS} flex-1 min-w-0`} />
                  <button onClick={() => removeButton(i)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger shrink-0 focus:outline-none">
                    <Icon name="trash-2" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Continuar fluxo — reusa os botões de um nó do fluxo */}
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">
              <Icon name="bot" size={11} /> Continuar fluxo (opcional)
            </div>
            {step.flowRef && (
              <button onClick={() => onUpdate({ ...step, flowRef: null })}
                className="text-[10.5px] text-text-muted hover:text-text inline-flex items-center gap-1 focus:outline-none rounded px-1">
                <Icon name="x" size={11} /> remover
              </button>
            )}
          </div>
          {step.flowRef ? (
            <div>
              <div className="text-[11.5px] text-text mb-1.5">Fluxo: <b>{step.flowRef.flowName}</b></div>
              <div className="flex flex-wrap gap-1">
                {step.flowRef.options.map((o, i) => (
                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-surface border border-primary/30 text-primary">{o}</span>
                ))}
              </div>
              <p className="text-[10.5px] text-text-muted mt-1.5">Ao clicar num botão, o lead volta pro fluxo neste ponto e segue a ramificação. (Substitui os botões de link acima.)</p>
            </div>
          ) : flowButtons.length === 0 ? (
            <p className="text-[11px] text-text-muted">Nenhum fluxo publicado com botões para este bot. Crie/publique um fluxo com um nó “Botões” vinculado a este bot.</p>
          ) : (
            <FlowButtonPicker flows={flowButtons} onPick={(ref) => onUpdate({ ...step, flowRef: ref })} />
          )}
        </div>

        <MediaLibraryModal
          open={libOpen !== null}
          onClose={() => setLibOpen(null)}
          botId={botId}
          mediaType={libOpen ?? 'image'}
          onSelect={addMediaFromLibrary}
        />
      </div>
    </div>
  )
}

/* ── Trigger Card ────────────────────────────────────────────── */

function TriggerCard({ campaign, bots, onUpdate }: {
  campaign: Campaign
  bots: RawBotOption[]
  onUpdate: (patch: Partial<Campaign>) => void
}) {
  const tr = TRIGGERS[campaign.trigger]
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: tr?.color }}>
          <Icon name={tr?.icon ?? 'layers'} size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Gatilho</div>
          <div className="text-[14px] font-semibold text-text mt-0.5">{tr?.label ?? campaign.trigger}</div>
          <p className="text-[11.5px] text-text-muted mt-1 leading-snug">{tr?.desc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
        <div>
          <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Tipo de gatilho</label>
          <SelDrop
            value={tr?.label ?? ''}
            options={Object.values(TRIGGERS).map((t) => t.label)}
            onChange={(v) => {
              const newKey = Object.entries(TRIGGERS).find(([, t]) => t.label === v)?.[0]
              if (newKey) {
                const initCfg: Record<string, string | number> = newKey === 'nao_respondeu'
                  ? { amount: 24, unit: 'horas', days: '', startHour: 9, endHour: 21 }
                  : {}
                onUpdate({ trigger: newKey, triggerConfig: initCfg })
              }
            }}
          />
        </div>
        <div>
          <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Público-alvo</label>
          <SelDrop
            value={AUDIENCES[campaign.audience] ?? ''}
            options={Object.values(AUDIENCES)}
            onChange={(v) => {
              const newKey = Object.entries(AUDIENCES).find(([, l]) => l === v)?.[0]
              if (newKey) onUpdate({ audience: newKey })
            }}
          />
        </div>

        {/* Campos extras por tipo de gatilho */}
        {tr?.configFields?.map((field) => (
          <div key={field.key} className="md:col-span-2">
            <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">{field.label}</label>
            <input
              type={field.type ?? 'text'}
              value={String(campaign.triggerConfig[field.key] ?? '')}
              placeholder={field.placeholder}
              onChange={(e) => onUpdate({ triggerConfig: { ...campaign.triggerConfig, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value } })}
              className="w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        ))}

        {/* Agenda do gatilho "Não respondeu" (tempo sem resposta + dias + horário) */}
        {campaign.trigger === 'nao_respondeu' && (
          <NoReplyScheduleConfig
            config={campaign.triggerConfig}
            onChange={(patch) => onUpdate({ triggerConfig: { ...campaign.triggerConfig, ...patch } })}
          />
        )}

        {/* Bot vinculado */}
        {bots.length > 0 && (
          <div className="md:col-span-2">
            <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Bot vinculado</label>
            <div className="relative">
              <select
                value={campaign.botId ?? ''}
                onChange={(e) => onUpdate({ botId: e.target.value || null })}
                className="w-full h-9 pl-3 pr-8 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
              >
                <option value="">Nenhum bot vinculado</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.username ? ` (@${b.username})` : ''}</option>
                ))}
              </select>
              <Icon name="chevron-down" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ── Preview Sequence ────────────────────────────────────────── */

function PreviewBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[260px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-bl-sm bg-surface text-text border border-border whitespace-pre-wrap">
        {text || <span className="italic text-text-subtle">Mensagem vazia</span>}
      </div>
    </div>
  )
}

function PreviewSequence({ campaign }: { campaign: Campaign }) {
  const tr = TRIGGERS[campaign.trigger]
  return (
    <Card title="Prévia da sequência" subtitle="Como o lead recebe a campanha">
      <div className="bg-surface-2/30 border border-border rounded-lg p-4 max-h-[560px] overflow-y-auto space-y-2 mt-1">
        <div className="text-center">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-surface border border-border rounded-full text-[10px] uppercase tracking-wider font-semibold text-text-muted">
            <Icon name={tr?.icon ?? 'layers'} size={10} style={{ color: tr?.color }} />
            {tr?.label ?? campaign.trigger}
          </span>
        </div>

        {campaign.steps.map((step) => (
          <React.Fragment key={step.id}>
            {step.delay.amount > 0 && (
              <div className="text-center py-1">
                <span className="text-[10px] uppercase tracking-wider text-text-subtle font-medium">
                  · aguarda {step.delay.amount} {step.delay.unit} ·
                </span>
              </div>
            )}
            {(step.media ?? []).length > 0 && (
              <div className="flex justify-start">
                <div className="ml-2 flex flex-wrap gap-1 max-w-[260px]">
                  {(step.media ?? []).slice(0, 6).map((m, i) => (
                    <div key={i} className="w-12 h-12 rounded-md bg-surface border border-border flex items-center justify-center text-text-muted">
                      <Icon name={m.kind === 'video' ? 'play' : 'image'} size={14} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <PreviewBubble text={step.message.replace(/\{nome\}/g, 'João').replace(/\{produto\}/g, 'Mentoria Premium').replace(/\{valor\}/g, 'R$ 197')} />
            {step.offer && (
              <div className="flex justify-start">
                <div className="ml-2 max-w-[260px] bg-surface border border-border rounded-2xl rounded-bl-sm p-3">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Oferta</div>
                  <div className="text-[12.5px] font-semibold text-text mt-1">{step.offer.product}</div>
                  <div className="text-[16px] font-semibold text-success mt-0.5">{fmtBRL(step.offer.price)}</div>
                  <button className="w-full mt-2 h-7 bg-primary text-primary-fg text-[11.5px] font-medium rounded-md">{step.offer.cta}</button>
                </div>
              </div>
            )}
            {step.flowRef && step.flowRef.options.length > 0 ? (
              <div className="flex justify-start">
                <div className="ml-2 w-[260px] space-y-1.5">
                  {step.flowRef.options.map((o, i) => (
                    <div key={i} className="w-full h-7 flex items-center justify-center gap-1 bg-surface border border-primary/30 text-primary text-[11.5px] font-medium rounded-md">
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            ) : (step.buttons ?? []).filter((b) => b.label.trim()).length > 0 && (
              <div className="flex justify-start">
                <div className="ml-2 w-[260px] space-y-1.5">
                  {(step.buttons ?? []).filter((b) => b.label.trim()).map((b, i) => (
                    <div key={i} className="w-full h-7 flex items-center justify-center gap-1 bg-surface border border-primary/30 text-primary text-[11.5px] font-medium rounded-md">
                      {b.label}<Icon name="arrow-up-right" size={11} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {campaign.steps.length === 0 && (
          <div className="py-8 text-center text-[12px] text-text-muted">Adicione etapas para ver a prévia.</div>
        )}

        {campaign.steps.length > 0 && (
          <div className="text-center pt-2">
            <span className="text-[10px] uppercase tracking-wider text-text-subtle font-medium">· final da sequência ·</span>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ── Performance Card ────────────────────────────────────────── */

function PerfStat({ label, value, tone, big }: { label: string; value: string; tone?: string; big?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{label}</div>
      <div className={`font-semibold tracking-tight mt-1 ${big ? 'text-[18px]' : 'text-[15px]'} ${tone === 'success' ? 'text-success' : 'text-text'}`}>{value}</div>
    </div>
  )
}

function PerformanceCard({ campaign }: { campaign: Campaign }) {
  if (campaign.leadsTriggered === 0) return null
  const totalRecovered = campaign.stepStats.reduce((s, n) => s + n, 0)
  const drops = campaign.steps.map((_, i) => {
    if (i === 0) return campaign.leadsTriggered
    return campaign.leadsTriggered - campaign.stepStats.slice(0, i).reduce((s, n) => s + n, 0)
  })

  return (
    <Card
      title="Desempenho por etapa"
      subtitle={`${fmtNum(campaign.leadsTriggered)} leads atingidos · ${fmtNum(totalRecovered)} recuperados · ${fmtPct(campaign.conversion)} conversão`}
    >
      <div className="mt-3 space-y-3">
        {campaign.steps.map((step, i) => {
          const reachedLeads = drops[i]
          const recovered    = campaign.stepStats[i] || 0
          const dropOff      = i > 0 ? drops[i - 1] - drops[i] : 0
          const reachPct     = (reachedLeads / campaign.leadsTriggered) * 100
          return (
            <div key={step.id}>
              <div className="flex items-center justify-between gap-2 text-[11.5px] mb-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-primary-soft text-primary text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                  <span className="text-text font-medium truncate">
                    {step.delay.amount === 0 ? 'Imediato' : `Após ${step.delay.amount} ${step.delay.unit}`}
                  </span>
                </span>
                <span className="text-text-muted shrink-0">
                  <span className="text-text font-semibold">{fmtNum(reachedLeads)}</span> alcançaram ·{' '}
                  <span className="text-success font-semibold">+{fmtNum(recovered)}</span> recuperados
                </span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${reachPct}%` }} />
              </div>
              {dropOff > 0 && i > 0 && (
                <div className="text-[10.5px] text-text-muted mt-1">
                  Drop-off: <span className="text-danger">−{fmtNum(dropOff)}</span>{' '}
                  (<span>{fmtPct((dropOff / drops[i - 1]) * 100)}</span>)
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        <PerfStat label="Receita recuperada"  value={fmtBRL(campaign.revenueRecovered)} tone="success" big />
        <PerfStat label="Ticket médio recup." value={totalRecovered > 0 ? fmtBRL(campaign.revenueRecovered / totalRecovered) : '—'} />
        <PerfStat label="Conversão"           value={fmtPct(campaign.conversion)} />
      </div>
    </Card>
  )
}

/* ── Execution History Card ──────────────────────────────────── */

const EXEC_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  sent:    { label: 'Enviado',  tone: 'success' },
  failed:  { label: 'Falhou',   tone: 'danger'  },
  pending: { label: 'Pendente', tone: 'warning' },
  skipped: { label: 'Pulado',   tone: 'muted'   },
}

function ExecutionHistoryCard({ campaignId }: { campaignId: string }) {
  const supabase = createClient()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [execs,   setExecs]   = useState<RawExecution[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset,  setOffset]  = useState(0)
  const loaded = useRef(false)

  async function load(off = 0) {
    setLoading(true)
    const { data } = await supabase
      .from('remarketing_executions')
      .select('id, step_index, status, message_sent, error_message, scheduled_at, executed_at')
      .eq('campaign_id', campaignId)
      .order('scheduled_at', { ascending: false })
      .range(off, off + 19)
    setLoading(false)
    const rows = (data ?? []) as RawExecution[]
    if (off === 0) setExecs(rows)
    else setExecs((prev) => [...prev, ...rows])
    setHasMore(rows.length === 20)
    setOffset(off + rows.length)
    loaded.current = true
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded.current) load(0)
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/40 focus:outline-none transition-colors"
      >
        <div className="flex items-center gap-2">
          <History size={14} className="text-text-muted" />
          <span className="text-[13px] font-semibold text-text">Histórico de execuções</span>
          {execs.length > 0 && (
            <span className="text-[10.5px] bg-surface-2 border border-border px-1.5 py-0.5 rounded-md text-text-muted font-medium">
              {execs.length}{hasMore ? '+' : ''}
            </span>
          )}
        </div>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} className="text-text-muted" />
      </button>

      {open && (
        <div className="border-t border-border">
          {loading && execs.length === 0 ? (
            <div className="flex items-center justify-center py-8 gap-2 text-[12.5px] text-text-muted">
              <Loader2 size={14} className="animate-spin" /> Carregando…
            </div>
          ) : execs.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-surface-2 text-text-muted flex items-center justify-center mx-auto mb-2">
                <Clock size={18} />
              </div>
              <p className="text-[12.5px] text-text-muted">Nenhuma execução registrada ainda.</p>
              <p className="text-[11.5px] text-text-subtle mt-0.5">As execuções aparecerão aqui quando a campanha disparar.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {execs.map((ex) => {
                const es = EXEC_STATUS[ex.status] ?? { label: ex.status, tone: 'muted' as BadgeTone }
                return (
                  <div key={ex.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="shrink-0 pt-0.5">
                      <Badge tone={es.tone}>{es.label}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11.5px] font-medium text-text">Etapa {ex.step_index + 1}</span>
                        <span className="text-[11px] text-text-muted">
                          {ex.executed_at ? fmtDateTime(ex.executed_at) : fmtDateTime(ex.scheduled_at)}
                        </span>
                      </div>
                      {ex.message_sent && (
                        <p className="text-[11.5px] text-text-muted mt-0.5 line-clamp-2 leading-snug">{ex.message_sent}</p>
                      )}
                      {ex.error_message && (
                        <p className="text-[11px] text-danger mt-0.5 leading-snug">{ex.error_message}</p>
                      )}
                    </div>
                  </div>
                )
              })}
              {hasMore && (
                <div className="px-5 py-3">
                  <Btn variant="ghost" size="sm" loading={loading} onClick={() => load(offset)}>
                    Carregar mais
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Campaign Editor ─────────────────────────────────────────── */

function CampaignEditor({ campaign, bots, saving, onBack, onSave, onActivate, onPause }: {
  campaign: Campaign
  bots: RawBotOption[]
  saving: boolean
  onBack: () => void
  onSave: (updated: Campaign) => Promise<void>
  onActivate: (id: string) => Promise<void>
  onPause: (id: string) => Promise<void>
}) {
  const [name,     setName]     = useState(campaign.name)
  const [desc,     setDesc]     = useState(campaign.description)
  const [trigger,  setTrigger]  = useState(campaign.trigger)
  const [audience, setAudience] = useState(campaign.audience)
  const [triggerConfig, setTriggerConfig] = useState(campaign.triggerConfig)
  const [botId,    setBotId]    = useState(campaign.botId)
  const [steps,    setSteps]    = useState<CampaignStep[]>(campaign.steps)
  const [flowButtons, setFlowButtons] = useState<FlowWithButtons[]>([])

  useEffect(() => {
    let cancelled = false
    if (!botId) { setFlowButtons([]); return }
    listBotFlowButtonsAction(botId).then((res) => {
      if (!cancelled && res.ok) setFlowButtons(res.flows)
    })
    return () => { cancelled = true }
  }, [botId])
  const [saved,            setSaved]            = useState(false)
  const [previewOpen,      setPreviewOpen]      = useState(false)
  const [nameError,        setNameError]        = useState(false)
  const [backConfirmOpen,  setBackConfirmOpen]  = useState(false)

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const campaignRef      = useRef(campaign)
  // eslint-disable-next-line react-hooks/refs
  campaignRef.current    = campaign
  const stateRef = useRef({ name, desc: '', trigger, audience, triggerConfig, botId, steps })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { name, desc, trigger, audience, triggerConfig, botId, steps }

  const dirty = name !== campaign.name
    || desc !== campaign.description
    || trigger !== campaign.trigger
    || audience !== campaign.audience
    || JSON.stringify(triggerConfig) !== JSON.stringify(campaign.triggerConfig)
    || botId !== campaign.botId
    || JSON.stringify(steps) !== JSON.stringify(campaign.steps)

  // Auto-save: debounce 30 s após a última alteração (pula se nome vazio)
  useEffect(() => {
    if (!dirty || !name.trim()) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      const s = stateRef.current
      if (!s.name.trim()) return
      await onSave({
        ...campaignRef.current,
        name: s.name, description: s.desc,
        trigger: s.trigger, audience: s.audience,
        triggerConfig: s.triggerConfig, botId: s.botId, steps: s.steps,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 30_000)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, desc, trigger, audience, botId,
      // Objetos: serializar para detectar mudanças profundas
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(triggerConfig), JSON.stringify(steps)])

  function updateStep(updated: CampaignStep) { setSteps((arr) => arr.map((s) => s.id === updated.id ? updated : s)) }
  function deleteStep(id: string)            { setSteps((arr) => arr.filter((s) => s.id !== id)) }
  function addStep() {
    setSteps((arr) => [...arr, { id: 's_' + Date.now(), delay: { amount: 24, unit: 'horas' }, message: '', offer: null }])
  }
  function moveStep(id: string, dir: -1 | 1) {
    setSteps((arr) => {
      const idx = arr.findIndex((s) => s.id === id)
      if (idx < 0) return arr
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= arr.length) return arr
      const next = [...arr]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return next
    })
  }

  async function save() {
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    await onSave({ ...campaign, name, description: desc, trigger, audience, triggerConfig, botId, steps })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleTriggerUpdate(patch: Partial<Campaign>) {
    if (patch.trigger  !== undefined) setTrigger(patch.trigger)
    if (patch.audience !== undefined) setAudience(patch.audience)
    if (patch.triggerConfig !== undefined) setTriggerConfig(patch.triggerConfig)
    if (patch.botId !== undefined) setBotId(patch.botId ?? null)
  }

  const editedCampaign: Campaign = { ...campaign, name, description: desc, trigger, audience, triggerConfig, botId, steps }
  const st = STATUS_MAP[campaign.status]

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-7" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="h-[60px] bg-surface border-b border-border flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
        <button onClick={() => dirty ? setBackConfirmOpen(true) : onBack()}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus:outline-none">
          <Icon name="chevron-left" size={14} /> Campanhas
        </button>
        <div className="w-px h-6 bg-border" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input
            value={name} onChange={(e) => { setName(e.target.value); setNameError(false) }}
            className={`bg-transparent text-[15px] font-semibold text-text focus:outline-none focus:bg-surface-2 px-2 py-1 rounded-md min-w-0 max-w-md ${nameError ? 'ring-2 ring-danger/50' : ''}`}
          />
          <Badge tone={st.tone}>
            {st.dot && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
            {st.label}
          </Badge>
          <span className="hidden md:inline text-[11px] text-text-subtle">
            {steps.length} {steps.length === 1 ? 'etapa' : 'etapas'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {saved && (
            <span className="text-[11.5px] text-success flex items-center gap-1 mr-1">
              <Icon name="check" size={12} /> Salvo
            </span>
          )}
          {dirty && !saved && (
            <span className="hidden sm:inline text-[10.5px] text-text-subtle mr-1">Auto-save em 30 s</span>
          )}
          <Btn variant="ghost" size="sm" icon="eye" className="xl:hidden" onClick={() => setPreviewOpen(true)}>Prévia</Btn>
          <Btn variant="secondary" size="sm" icon="save" loading={saving} disabled={!dirty} onClick={save}>Salvar</Btn>
          {campaign.status === 'active'
            ? <Btn variant="secondary" size="sm" icon="pause" loading={saving} onClick={() => onPause(campaign.id)}>Pausar</Btn>
            : <Btn variant="primary"   size="sm" icon="play"  loading={saving} onClick={() => onActivate(campaign.id)}>Ativar</Btn>
          }
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            <Card>
              <div>
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Descrição interna</label>
                <textarea
                  value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
                  placeholder="Pequena descrição para identificar esta campanha…"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-snug"
                />
              </div>
            </Card>

            <TriggerCard campaign={editedCampaign} bots={bots} onUpdate={handleTriggerUpdate} />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-semibold text-text">Sequência</h2>
                <span className="text-[11.5px] text-text-muted">{steps.length} {steps.length === 1 ? 'etapa' : 'etapas'}</span>
              </div>
              <div className="space-y-3">
                {steps.length === 0 && (
                  <div className="bg-surface border border-dashed border-border rounded-xl py-10 px-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-3">
                      <Icon name="message-square-plus" size={20} />
                    </div>
                    <div className="text-[13px] font-semibold text-text">Adicione a primeira etapa</div>
                    <div className="text-[11.5px] text-text-muted mt-1 max-w-xs">Cada etapa envia uma mensagem após o atraso configurado.</div>
                  </div>
                )}
                {steps.map((step, i) => (
                  <React.Fragment key={step.id}>
                    <StepCard
                      step={step} index={i} total={steps.length}
                      onUpdate={updateStep} onDelete={deleteStep}
                      onMoveUp={() => moveStep(step.id, -1)}
                      onMoveDown={() => moveStep(step.id, 1)}
                      flowButtons={flowButtons}
                      botId={botId}
                    />
                    {i < steps.length - 1 && (
                      <div className="flex justify-center text-text-subtle">
                        <Icon name="arrow-down" size={14} />
                      </div>
                    )}
                  </React.Fragment>
                ))}
                <button
                  onClick={addStep}
                  className="w-full h-10 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-text-muted hover:text-primary rounded-xl border border-dashed border-border hover:border-primary/50 focus:outline-none transition-colors">
                  <Icon name="plus" size={13} /> Adicionar próxima etapa
                </button>
              </div>
            </div>

            {campaign.leadsTriggered > 0 && <PerformanceCard campaign={campaign} />}
            <ExecutionHistoryCard campaignId={campaign.id} />
          </div>

          <div className="xl:sticky xl:top-[80px]">
            <PreviewSequence campaign={editedCampaign} />
          </div>
        </div>
      </div>

      <Modal
        open={previewOpen} onClose={() => setPreviewOpen(false)}
        title="Prévia da sequência" size="md"
        footer={<Btn variant="primary" onClick={() => setPreviewOpen(false)}>Fechar</Btn>}
      >
        <PreviewSequence campaign={editedCampaign} />
      </Modal>

      <Modal
        open={backConfirmOpen} onClose={() => setBackConfirmOpen(false)}
        title="Mudanças não salvas" size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setBackConfirmOpen(false)}>Continuar editando</Btn>
            <Btn variant="danger" onClick={() => { setBackConfirmOpen(false); onBack() }}>Descartar mudanças</Btn>
          </>
        }
      >
        <p className="text-[13px] text-text-muted leading-relaxed">
          Você tem alterações não salvas nesta campanha. Deseja descartá-las e voltar para a lista?
        </p>
      </Modal>
    </div>
  )
}

/* ── Campaign List ───────────────────────────────────────────── */

function CampaignList({ campaigns, onOpen, onCreate, onDuplicate, onDelete, onShowTemplates, hasMore, loadingMore, onLoadMore }: {
  campaigns: Campaign[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onShowTemplates: () => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const { track } = useAnalytics()
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('Todos')

  const filtered = useMemo(() => campaigns.filter((c) => {
    const q = search.trim().toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !(TRIGGERS[c.trigger]?.label ?? '').toLowerCase().includes(q)) return false
    if (statusF === 'Ativas'      && c.status !== 'active')   return false
    if (statusF === 'Pausadas'    && c.status !== 'paused')   return false
    if (statusF === 'Rascunhos'   && c.status !== 'draft')    return false
    if (statusF === 'Finalizadas' && c.status !== 'finished') return false
    return true
  }), [campaigns, search, statusF])

  const totals = useMemo(() => ({
    active:        campaigns.filter((c) => c.status === 'active').length,
    totalLeads:    campaigns.reduce((s, c) => s + c.leadsRecovered, 0),
    totalRevenue:  campaigns.reduce((s, c) => s + c.revenueRecovered, 0),
    avgConversion: (() => {
      const arr = campaigns.filter((c) => c.conversion > 0)
      return arr.length > 0 ? arr.reduce((s, c) => s + c.conversion, 0) / arr.length : 0
    })(),
  }), [campaigns])

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Remarketing</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Sequências automáticas para recuperar leads e impulsionar recompras.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {campaigns.length > 0 && (
            <Btn variant="ghost" size="sm" icon="file-down" onClick={() => {
              exportCSV(filtered)
              track('csv_exported', { section: 'remarketing', rows: filtered.length })
            }}>
              Exportar
            </Btn>
          )}
          <Btn variant="secondary" icon="eye" onClick={onShowTemplates}>Templates</Btn>
          <Btn variant="primary" icon="plus" onClick={onCreate}>Nova campanha</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="Campanhas ativas"         value={`${totals.active} / ${campaigns.length}`} icon="play"               tone="primary" />
        <KPI label="Leads recuperados (30d)"  value={fmtNum(totals.totalLeads)}                icon="users" />
        <KPI label="Receita recuperada (30d)" value={fmtBRL(totals.totalRevenue)}              icon="circle-dollar-sign"  highlight={totals.totalRevenue > 0} />
        <KPI label="Conversão média"          value={totals.avgConversion > 0 ? fmtPct(totals.avgConversion) : '—'} icon="target" />
      </div>

      {campaigns.length === 0 ? (
        <NoDataState onCreate={onCreate} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou gatilho…"
                className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
            <div className="w-40">
              <SelDrop value={statusF} options={['Todos', 'Ativas', 'Pausadas', 'Rascunhos', 'Finalizadas']} onChange={setStatusF} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <CampaignCard
                key={c.id} campaign={c}
                onOpen={() => onOpen(c.id)}
                onDuplicate={() => onDuplicate(c.id)}
                onDelete={() => onDelete(c.id)}
              />
            ))}
            <button
              onClick={onCreate}
              className="group min-h-[220px] bg-surface-2/30 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center px-6 py-8 hover:border-primary hover:bg-primary-soft/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3 group-hover:border-primary group-hover:text-primary transition-colors">
                <Icon name="plus" size={20} />
              </div>
              <div className="text-[13px] font-semibold text-text">Nova campanha</div>
              <div className="text-[11.5px] text-text-muted mt-1 max-w-[220px] leading-snug">Comece do zero ou use um template pronto.</div>
            </button>
          </div>

          {hasMore && (
            <div className="flex justify-center mt-5">
              <Btn variant="secondary" loading={loadingMore} onClick={onLoadMore}>
                Carregar mais campanhas
              </Btn>
            </div>
          )}
          {!hasMore && campaigns.length >= 50 && (
            <p className="text-center text-[11.5px] text-text-subtle mt-4">
              {campaigns.length} campanhas carregadas
            </p>
          )}
        </>
      )}
    </>
  )
}

/* ── Main Client Component ───────────────────────────────────── */

const LIST_SELECT = 'id, name, description, trigger_type, audience, trigger_config, status, leads_recovered, revenue_recovered, leads_triggered, conversion, steps, bot_id, created_at, updated_at'
const PAGE_SIZE   = 50

interface Props {
  initialCampaigns: RawCampaign[]
  bots: RawBotOption[]
  userId: string
  initialHasMore: boolean
}

export default function RemarketingClient({ initialCampaigns, bots, userId, initialHasMore }: Props) {
  const router = useRouter()
  const { track } = useAnalytics()
  const supabase = createClient()

  const [campaigns,    setCampaigns]    = useState<Campaign[]>(() => initialCampaigns.map(mapRaw))
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [toast,        setToastState]   = useState<ToastState | null>(null)
  const [hasMore,      setHasMore]      = useState(initialHasMore)
  const [loadingMore,  setLoadingMore]  = useState(false)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToastState({ msg, type })
    setTimeout(() => setToastState(null), 3500)
  }

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('remarketing-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'remarketing_campaigns',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCampaigns((prev) => {
            if (prev.some((c) => c.id === (payload.new as RawCampaign).id)) return prev
            return [mapRaw(payload.new as RawCampaign), ...prev]
          })
        } else if (payload.eventType === 'UPDATE') {
          setCampaigns((prev) => prev.map((c) =>
            c.id === (payload.new as RawCampaign).id ? mapRaw(payload.new as RawCampaign) : c
          ))
        } else if (payload.eventType === 'DELETE') {
          setCampaigns((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  /* ── Paginação ──────────────────────────────────────────────── */

  async function loadMore() {
    setLoadingMore(true)
    const { data } = await supabase
      .from('remarketing_campaigns')
      .select(LIST_SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(campaigns.length, campaigns.length + PAGE_SIZE - 1)
    setLoadingMore(false)
    if (!data || data.length === 0) { setHasMore(false); return }
    setCampaigns((prev) => {
      const ids = new Set(prev.map((c) => c.id))
      const news = (data as unknown as RawCampaign[]).filter((r) => !ids.has(r.id)).map(mapRaw)
      return [...prev, ...news]
    })
    setHasMore(data.length >= PAGE_SIZE)
  }

  /* ── Lazy-load step_stats ao abrir editor ────────────────────── */

  async function openCampaign(id: string) {
    setEditingId(id)
    // step_stats não vem do SSR (payload da listagem) — busca sob demanda para o PerformanceCard
    const alreadyLoaded = campaigns.find((c) => c.id === id)
    if (alreadyLoaded && alreadyLoaded.stepStats.length > 0) return
    const { data } = await supabase
      .from('remarketing_campaigns')
      .select('step_stats')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    if (data?.step_stats) {
      setCampaigns((prev) => prev.map((c) =>
        c.id === id ? { ...c, stepStats: data.step_stats as number[] } : c
      ))
    }
  }

  /* ── CRUD ───────────────────────────────────────────────────── */

  async function createCampaign(template?: typeof TEMPLATES[0]) {
    setSaving(true)
    const { data, error } = await supabase
      .from('remarketing_campaigns')
      .insert({
        user_id:     userId,
        name:        template ? template.name : 'Nova campanha',
        description: template ? '' : 'Rascunho recém-criado.',
        trigger_type: template ? template.trigger : 'carrinho_abandonado',
        audience:    template ? template.audience : 'leads',
        trigger_config: {},
        status:      'draft',
        steps:       template ? template.steps : [],
        step_stats:  [],
      })
      .select()
      .single()
    setSaving(false)

    if (error || !data) {
      showToast('Erro ao criar campanha. Tente novamente.', 'error')
      return
    }

    const newCampaign = mapRaw(data as unknown as RawCampaign)
    setCampaigns((prev) => [newCampaign, ...prev])
    setEditingId(newCampaign.id)
    track('campaign_created', { trigger: newCampaign.trigger, audience: newCampaign.audience })
  }

  async function saveCampaign(updated: Campaign) {
    setSaving(true)
    const { error } = await supabase
      .from('remarketing_campaigns')
      .update({
        name:           updated.name,
        description:    updated.description,
        trigger_type:   updated.trigger,
        audience:       updated.audience,
        trigger_config: updated.triggerConfig,
        bot_id:         updated.botId,
        steps:          updated.steps,
      })
      .eq('id', updated.id)
      .eq('user_id', userId)
    setSaving(false)

    if (error) {
      showToast('Erro ao salvar campanha.', 'error')
      return
    }

    setCampaigns((prev) => prev.map((c) => c.id === updated.id ? { ...updated, updatedAt: Date.now() } : c))
    track('campaign_saved', { step_count: updated.steps.length })
  }

  async function activate(id: string) {
    const campaign = campaigns.find((c) => c.id === id)
    if (!campaign) return
    if (campaign.steps.length === 0) {
      showToast('Adicione pelo menos uma etapa antes de ativar.', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('remarketing_campaigns')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('user_id', userId)
    setSaving(false)

    if (error) { showToast('Erro ao ativar campanha.', 'error'); return }
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: 'active', updatedAt: Date.now() } : c))
    track('campaign_activated', { trigger: campaign.trigger, step_count: campaign.steps.length })
    showToast('Campanha ativada!')
  }

  async function pause(id: string) {
    setSaving(true)
    const { error } = await supabase
      .from('remarketing_campaigns')
      .update({ status: 'paused' })
      .eq('id', id)
      .eq('user_id', userId)
    setSaving(false)

    if (error) { showToast('Erro ao pausar campanha.', 'error'); return }
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: 'paused', updatedAt: Date.now() } : c))
    track('campaign_paused', { trigger: campaigns.find((c) => c.id === id)?.trigger ?? '' })
    showToast('Campanha pausada.')
  }

  async function duplicateCampaign(id: string) {
    const original = campaigns.find((c) => c.id === id)
    if (!original) return
    setSaving(true)
    const { data, error } = await supabase
      .from('remarketing_campaigns')
      .insert({
        user_id:        userId,
        name:           `${original.name} (cópia)`,
        description:    original.description,
        trigger_type:   original.trigger,
        audience:       original.audience,
        trigger_config: original.triggerConfig,
        bot_id:         original.botId,
        status:         'draft',
        steps:          original.steps,
        step_stats:     [],
      })
      .select()
      .single()
    setSaving(false)

    if (error || !data) { showToast('Erro ao duplicar campanha.', 'error'); return }
    const copy = mapRaw(data as unknown as RawCampaign)
    setCampaigns((prev) => [copy, ...prev])
    showToast('Campanha duplicada!')
    track('campaign_created', { trigger: copy.trigger, audience: copy.audience })
  }

  async function deleteCampaign() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase
      .from('remarketing_campaigns')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('user_id', userId)
    setDeleting(false)

    if (error) { showToast('Erro ao apagar campanha.', 'error'); setDeleteTarget(null); return }
    setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    if (editingId === deleteTarget.id) setEditingId(null)
    setDeleteTarget(null)
    track('campaign_deleted', {})
    showToast('Campanha apagada.')
    router.refresh()
  }

  /* ── Render ─────────────────────────────────────────────────── */

  const editing = campaigns.find((c) => c.id === editingId)

  return (
    <>
      {editing ? (
        <CampaignEditor
          campaign={editing}
          bots={bots}
          saving={saving}
          onBack={() => setEditingId(null)}
          onSave={saveCampaign}
          onActivate={activate}
          onPause={pause}
        />
      ) : (
        <CampaignList
          campaigns={campaigns}
          onOpen={openCampaign}
          onCreate={() => createCampaign()}
          onDuplicate={duplicateCampaign}
          onDelete={(id) => setDeleteTarget(campaigns.find((c) => c.id === id) ?? null)}
          onShowTemplates={() => setShowTemplates(true)}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}

      <TemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onCreate={createCampaign}
      />

      <DeleteModal
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ''}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteCampaign}
      />

      <Toast toast={toast} />
    </>
  )
}
