'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  Send, BookOpen, MessageSquare, CheckCircle2, Activity, Info,
  AlertTriangle, XCircle, FileText, Clock, ChevronRight, ChevronLeft, ChevronDown,
  Search, X, Save, Zap, Bot, Users, User, ShoppingBag, Tag, Package,
  Image, Film, File, Plus, Trash2, ExternalLink, ArrowUpRight, ArrowDownRight, Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ── Types ─────────────────────────────────────────────────────── */

interface MediaAttachment { kind: 'image' | 'video' | 'file'; label: string }
interface BroadcastButton { label: string; url: string }
type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'done' | 'failed' | 'canceled'

interface Broadcast {
  id: string
  title: string
  bot: string
  audience: string
  audienceCount: number
  status: BroadcastStatus
  sent: number
  delivered: number
  failed: number
  scheduledFor: number | null
  startedAt?: number | null
  finishedAt?: number | null
  message: string
  media: MediaAttachment | null
  buttons: BroadcastButton[]
  createdAt: number
  failureReason?: string
}

interface SenderBotInfo { id: string; label: string; color: string }
interface AudienceOption { id: string; label: string; count: number; icon: string }
interface StatusInfo { label: string; tone: string; icon: string; pulse?: boolean }

/* ── Constants ──────────────────────────────────────────────────── */

const NOW_S = new Date('2026-05-18T15:30:00').getTime()

const STATUS_MAP: Record<BroadcastStatus, StatusInfo> = {
  draft:     { label: 'Rascunho',  tone: 'muted',   icon: 'file-text' },
  scheduled: { label: 'Agendado',  tone: 'warning', icon: 'clock' },
  sending:   { label: 'Enviando',  tone: 'primary', icon: 'send', pulse: true },
  done:      { label: 'Concluído', tone: 'success', icon: 'check-circle-2' },
  failed:    { label: 'Falhou',    tone: 'danger',  icon: 'alert-triangle' },
  canceled:  { label: 'Cancelado', tone: 'muted',   icon: 'x-circle' },
}

const SENDER_BOTS: SenderBotInfo[] = [
  { id: '@mentoria_vip_bot',     label: 'Mentoria VIP Premium',   color: 'var(--primary)' },
  { id: '@lancamento_black_bot', label: 'Lançamento Black Friday', color: 'var(--danger)'  },
  { id: '@upsell_pos_bot',       label: 'Upsell Pós-compra',       color: 'var(--success)' },
  { id: '@vendas_curso_bot',     label: 'Vendas Curso 90 dias',    color: 'var(--warning)' },
  { id: '@suporte_premium_bot',  label: 'Suporte Premium',         color: 'oklch(0.62 0.16 200)' },
]

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { id: 'all',       label: 'Todos os contatos',              count: 12845, icon: 'users'        },
  { id: 'leads',     label: 'Apenas leads (não compradores)', count: 8420,  icon: 'user'         },
  { id: 'buyers',    label: 'Apenas compradores',             count: 4425,  icon: 'shopping-bag' },
  { id: 'vip',       label: 'Tag: VIP',                       count: 287,   icon: 'tag'          },
  { id: 'black',     label: 'Tag: Black 2025',                count: 3928,  icon: 'tag'          },
  { id: 'curso',     label: 'Compradores: Curso 90 dias',     count: 287,   icon: 'package'      },
  { id: 'templates', label: 'Compradores: Pack Templates Pro', count: 412,  icon: 'package'      },
]

const INITIAL_BROADCASTS: Broadcast[] = [
  {
    id: 'br_001', title: 'Black Friday — Última chance',
    bot: '@lancamento_black_bot', audience: 'black', audienceCount: 3928,
    status: 'sending', sent: 2147, delivered: 2089, failed: 12,
    scheduledFor: null, startedAt: NOW_S - 8 * 60 * 1000, finishedAt: null,
    message: 'Última chamada, {nome}! Em menos de 4 horas a Black Friday encerra. Se quiser garantir sua vaga no plano anual, agora é o momento.',
    media: null, buttons: [{ label: 'Garantir agora', url: 'https://umbra.bot/r/bf-2025' }],
    createdAt: NOW_S - 30 * 60 * 1000,
  },
  {
    id: 'br_002', title: 'Aula gratuita — hoje às 20h',
    bot: '@mentoria_vip_bot', audience: 'leads', audienceCount: 8420,
    status: 'scheduled', sent: 0, delivered: 0, failed: 0,
    scheduledFor: NOW_S + 4.5 * 3600 * 1000, startedAt: null, finishedAt: null,
    message: 'Olá {nome}! Hoje às 20h tenho uma aula ao vivo gratuita sobre vendas no Telegram. Vou ensinar 3 técnicas que mais geram conversão.',
    media: { kind: 'image', label: 'banner-aula-2026-05.jpg' },
    buttons: [
      { label: 'Lembre-me',       url: 'https://umbra.bot/r/aula-lembrete' },
      { label: 'Participar agora', url: 'https://umbra.bot/r/aula-ao-vivo' },
    ],
    createdAt: NOW_S - 6 * 3600 * 1000,
  },
  {
    id: 'br_003', title: 'Recap semanal — Templates Pro',
    bot: '@upsell_pos_bot', audience: 'templates', audienceCount: 412,
    status: 'done', sent: 412, delivered: 408, failed: 4,
    scheduledFor: null, startedAt: NOW_S - 24 * 3600 * 1000, finishedAt: NOW_S - 23.5 * 3600 * 1000,
    message: 'Resumo da semana: 3 novos templates foram adicionados ao Pack Pro. Atualize sua biblioteca agora.',
    media: null, buttons: [{ label: 'Ver novidades', url: 'https://umbra.bot/r/templates-pro' }],
    createdAt: NOW_S - 25 * 3600 * 1000,
  },
  {
    id: 'br_004', title: 'Convite mentoria 1:1',
    bot: '@mentoria_vip_bot', audience: 'vip', audienceCount: 287,
    status: 'draft', sent: 0, delivered: 0, failed: 0,
    scheduledFor: null, startedAt: null, finishedAt: null,
    message: '', media: null, buttons: [],
    createdAt: NOW_S - 2 * 3600 * 1000,
  },
  {
    id: 'br_005', title: 'Novidade: novo módulo no curso',
    bot: '@vendas_curso_bot', audience: 'curso', audienceCount: 287,
    status: 'done', sent: 287, delivered: 282, failed: 5,
    scheduledFor: null,
    startedAt: NOW_S - 3 * 24 * 3600 * 1000,
    finishedAt: NOW_S - 3 * 24 * 3600 * 1000 + 14 * 60 * 1000,
    message: 'Adicionei o módulo 7 ("Vendas no piloto automático") ao curso. Você já tem acesso liberado.',
    media: null, buttons: [{ label: 'Acessar módulo', url: 'https://umbra.bot/r/modulo-7' }],
    createdAt: NOW_S - 3 * 24 * 3600 * 1000,
  },
  {
    id: 'br_006', title: 'Aviso de manutenção',
    bot: '@suporte_premium_bot', audience: 'all', audienceCount: 12845,
    status: 'failed', sent: 1284, delivered: 1102, failed: 182,
    scheduledFor: null, startedAt: NOW_S - 6 * 3600 * 1000, finishedAt: NOW_S - 5.7 * 3600 * 1000,
    failureReason: 'Bot desconectado durante o disparo. Reinicie o bot e crie um novo broadcast com os contatos restantes.',
    message: 'Faremos manutenção programada hoje das 23h às 01h. Pode haver instabilidade no atendimento.',
    media: null, buttons: [],
    createdAt: NOW_S - 6.5 * 3600 * 1000,
  },
  {
    id: 'br_007', title: 'Recap Black 2025',
    bot: '@lancamento_black_bot', audience: 'buyers', audienceCount: 487,
    status: 'done', sent: 487, delivered: 481, failed: 6,
    scheduledFor: null,
    startedAt: NOW_S - 7 * 24 * 3600 * 1000,
    finishedAt: NOW_S - 7 * 24 * 3600 * 1000 + 22 * 60 * 1000,
    message: 'Encerramos a Black 2025 com 487 novos alunos! Obrigado por confiar. Em breve voltamos com novidades.',
    media: null, buttons: [],
    createdAt: NOW_S - 7 * 24 * 3600 * 1000,
  },
]

/* ── Helpers ────────────────────────────────────────────────────── */

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtPct = (n: number, dec = 1) => `${n.toFixed(dec)}%`

function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
}

function getAudienceLabel(id: string) { return AUDIENCE_OPTIONS.find(a => a.id === id)?.label ?? id }
function getAudienceCount(id: string) { return AUDIENCE_OPTIONS.find(a => a.id === id)?.count ?? 0 }
function getBotInfo(id: string): SenderBotInfo {
  return SENDER_BOTS.find(b => b.id === id) ?? { id, label: id, color: 'var(--text-muted)' }
}

function relTimeS(dt: number | null | undefined, now: number): string {
  if (!dt) return '—'
  const diff = now - dt
  if (diff < 0) {
    const abs = Math.abs(diff)
    const m = Math.floor(abs / 60000)
    if (m < 60) return `em ${m} min`
    const h = Math.floor(m / 60)
    return h < 24 ? `em ${h} h` : `em ${Math.floor(h / 24)} d`
  }
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `há ${h} h` : `há ${Math.floor(h / 24)} d`
}

/* ── Icon ───────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  send: Send, 'book-open': BookOpen, 'message-square': MessageSquare,
  'check-circle-2': CheckCircle2, activity: Activity, info: Info,
  'alert-triangle': AlertTriangle, 'x-circle': XCircle, 'file-text': FileText,
  clock: Clock, 'chevron-right': ChevronRight, 'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown, search: Search, x: X, save: Save, zap: Zap,
  bot: Bot, users: Users, user: User, 'shopping-bag': ShoppingBag,
  tag: Tag, package: Package, image: Image, film: Film, file: File,
  plus: Plus, 'trash-2': Trash2, 'external-link': ExternalLink,
  'arrow-up-right': ArrowUpRight, 'arrow-down-right': ArrowDownRight, check: Check,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const C = ICON_MAP[name] ?? Send
  return <C size={size} className={className} />
}

/* ── Btn ────────────────────────────────────────────────────────── */

function Btn({
  children, onClick, variant = 'secondary', icon, iconRight, disabled, size = 'md', className,
}: {
  children?: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: string; iconRight?: string; disabled?: boolean
  size?: 'sm' | 'md'; className?: string
}) {
  const h  = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]'
  const ic = size === 'sm' ? 13 : 14
  const styles: Record<string, string> = {
    primary:   'bg-primary text-primary-fg hover:opacity-90',
    secondary: 'bg-surface-2 text-text border border-border hover:border-border-strong',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${h} ${styles[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className ?? ''}`}
    >
      {icon && <Icon name={icon} size={ic} />}
      {children}
      {iconRight && <Icon name={iconRight} size={ic} />}
    </button>
  )
}

/* ── Badge ──────────────────────────────────────────────────────── */

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  const cls: Record<string, string> = {
    muted:   'bg-surface-2 text-text-muted',
    warning: 'bg-warning-soft text-warning',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    danger:  'bg-danger-soft text-danger',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold whitespace-nowrap ${cls[tone] ?? cls.muted}`}>
      {children}
    </span>
  )
}

/* ── Card ───────────────────────────────────────────────────────── */

function Card({
  children, title, subtitle, action, noPadding,
}: {
  children: React.ReactNode; title?: string; subtitle?: React.ReactNode
  action?: React.ReactNode; noPadding?: boolean
}) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title && <div className="text-[13px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[11.5px] text-text-muted mt-0.5 leading-snug">{subtitle}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {noPadding
        ? children
        : <div className={title ? 'px-4 pb-4' : 'p-4'}>{children}</div>}
    </div>
  )
}

/* ── Modal ──────────────────────────────────────────────────────── */

function Modal({
  open, onClose, title, subtitle, size = 'md', footer, children,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string
  size?: 'sm' | 'md' | 'lg'; footer?: React.ReactNode; children: React.ReactNode
}) {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-surface border border-border rounded-2xl shadow-xl w-full ${widths[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <div className="text-[15px] font-semibold text-text">{title}</div>
            {subtitle && <div className="text-[12.5px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center text-text-muted shrink-0">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 pb-5">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Dropdown ───────────────────────────────────────────────────── */

function Dropdown({
  label, value, options, onChange, width, icon: _icon,
}: {
  label?: string; value: string; options: string[]
  onChange: (v: string) => void; width?: number; icon?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        className="h-9 pl-3 pr-8 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none cursor-pointer"
        style={width ? { width } : undefined}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
    </div>
  )
}

/* ── KpiS ───────────────────────────────────────────────────────── */

function KpiS({ label, value, icon, delta, tone, highlight, pulse }: {
  label: string; value: string; icon: string
  delta?: number; tone?: string; highlight?: boolean; pulse?: boolean
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={`relative w-7 h-7 rounded-md flex items-center justify-center ${tone === 'primary' ? 'bg-primary-soft text-primary' : highlight ? 'bg-success-soft text-success' : 'bg-surface-2 text-text-muted'}`}>
          <Icon name={icon} size={14} />
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary">
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
            </span>
          )}
        </div>
      </div>
      <div className={`text-[24px] font-semibold tnum tracking-tight leading-none ${highlight ? 'text-success' : 'text-text'}`}>{value}</div>
      {delta !== undefined && (
        <div className="mt-2.5">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium text-[11px] ${positive ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
            <Icon name={positive ? 'arrow-up-right' : 'arrow-down-right'} size={11} />
            {fmtPct(Math.abs(delta))}
          </span>
          <span className="text-[11.5px] text-text-muted ml-1.5">vs. anterior</span>
        </div>
      )}
    </div>
  )
}

/* ── BotPicker ──────────────────────────────────────────────────── */

function BotPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {SENDER_BOTS.map(b => {
        const active = value === b.id
        return (
          <button
            key={b.id}
            onClick={() => onChange(b.id)}
            className={`text-left p-3 rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center gap-3 ${active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2 hover:border-border-strong'}`}
          >
            <div className="w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0" style={{ background: b.color }}>
              <Bot size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-text truncate">{b.label}</div>
              <div className="text-[11px] text-text-muted truncate tnum">{b.id}</div>
            </div>
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-primary' : 'border-border-strong'}`}>
              {active && <span className="w-2 h-2 rounded-full bg-primary" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── AudiencePicker ─────────────────────────────────────────────── */

function AudiencePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      {AUDIENCE_OPTIONS.map(a => {
        const active = value === a.id
        return (
          <button
            key={a.id}
            onClick={() => onChange(a.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center gap-3 ${active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2 hover:border-border-strong'}`}
          >
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-primary' : 'border-border-strong'}`}>
              {active && <span className="w-2 h-2 rounded-full bg-primary" />}
            </span>
            <Icon name={a.icon} size={13} className="text-text-muted shrink-0" />
            <span className="text-[12.5px] text-text flex-1 truncate">{a.label}</span>
            <span className="text-[11px] tnum text-text-muted shrink-0 bg-surface-2 px-1.5 py-0.5 rounded">
              {fmtNum(a.count)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── MediaButton ────────────────────────────────────────────────── */

function MediaButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text bg-surface border border-dashed border-border rounded-lg hover:bg-surface-2 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  )
}

/* ── MessageComposer ────────────────────────────────────────────── */

function MessageComposer({
  message, setMessage, media, setMedia, buttons, setButtons,
}: {
  message: string; setMessage: (v: string) => void
  media: MediaAttachment | null; setMedia: (v: MediaAttachment | null) => void
  buttons: BroadcastButton[]; setButtons: (v: BroadcastButton[]) => void
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)

  function insertVar(v: string) {
    const ta = textRef.current
    if (!ta) return
    const s = ta.selectionStart ?? 0
    const e = ta.selectionEnd ?? 0
    const insert = `{${v}}`
    setMessage(message.substring(0, s) + insert + message.substring(e))
    requestAnimationFrame(() => {
      ta.focus()
      const pos = s + insert.length
      ta.setSelectionRange(pos, pos)
    })
  }

  function addButton() {
    if (buttons.length >= 3) return
    setButtons([...buttons, { label: '', url: '' }])
  }

  function mockMedia(kind: MediaAttachment['kind'], ext: string) {
    setMedia({ kind, label: `${kind}-${Date.now() % 1000}.${ext}` })
  }

  return (
    <div className="space-y-3.5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Texto da mensagem</label>
          <span className="text-[10.5px] tnum text-text-muted">{message.length}/4096</span>
        </div>
        <textarea
          ref={textRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          placeholder="Olá {nome}, …"
          maxLength={4096}
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed"
        />
        <div className="mt-1.5 flex flex-wrap gap-1 items-center text-[11px]">
          <span className="text-text-muted">Inserir:</span>
          {['nome', 'produto', 'valor', 'bot', 'data'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => insertVar(v)}
              className="px-1.5 h-5 bg-surface-2 border border-border rounded font-mono text-[10.5px] text-text-muted hover:text-text hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Mídia (opcional)</label>
        {media ? (
          <div className="flex items-center gap-3 p-2.5 bg-surface-2/50 border border-border rounded-lg">
            <div className="w-12 h-12 rounded-md bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <Icon name={media.kind === 'image' ? 'image' : media.kind === 'video' ? 'film' : 'file'} size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-text truncate">{media.label}</div>
              <div className="text-[11px] text-text-muted">{media.kind === 'image' ? 'Imagem' : media.kind === 'video' ? 'Vídeo' : 'Documento'}</div>
            </div>
            <button
              onClick={() => setMedia(null)}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <MediaButton icon="image" label="Imagem"    onClick={() => mockMedia('image', 'jpg')} />
            <MediaButton icon="film"  label="Vídeo"     onClick={() => mockMedia('video', 'mp4')} />
            <MediaButton icon="file"  label="Documento" onClick={() => mockMedia('file',  'pdf')} />
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Botões inline (até 3)</label>
        {buttons.length === 0 ? (
          <button
            onClick={addButton}
            className="w-full h-9 inline-flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-text-muted hover:text-primary rounded-md border border-dashed border-border hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
          >
            <Plus size={11} />
            Adicionar botão
          </button>
        ) : (
          <div className="space-y-2">
            {buttons.map((btn, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={btn.label}
                  onChange={e => setButtons(buttons.map((b, j) => j === i ? { ...b, label: e.target.value } : b))}
                  placeholder="Texto do botão"
                  className="flex-1 h-9 px-2.5 bg-surface border border-border rounded-md text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
                <input
                  type="url"
                  value={btn.url}
                  onChange={e => setButtons(buttons.map((b, j) => j === i ? { ...b, url: e.target.value } : b))}
                  placeholder="https://…"
                  className="flex-[1.4] h-9 px-2.5 bg-surface border border-border rounded-md text-[12px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
                <button
                  onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {buttons.length < 3 && (
              <button
                onClick={addButton}
                className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1 focus-visible:outline-none rounded px-1"
              >
                <Plus size={11} /> Adicionar outro botão
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── SchedulePicker ─────────────────────────────────────────────── */

function SchedulePicker({ mode, setMode, scheduledFor, setScheduledFor }: {
  mode: 'now' | 'later'; setMode: (v: 'now' | 'later') => void
  scheduledFor: number; setScheduledFor: (v: number) => void
}) {
  function toLocal(dt: number) {
    const d = new Date(dt)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const opts: Array<{ id: 'now' | 'later'; label: string; desc: string; icon: string }> = [
    { id: 'now',   label: 'Enviar agora',  desc: 'Inicia imediatamente após salvar.',                   icon: 'send'  },
    { id: 'later', label: 'Agendar envio', desc: 'Inicia automaticamente na data/hora abaixo.', icon: 'clock' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {opts.map(opt => {
          const active = mode === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={`text-left p-3 rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2 hover:border-border-strong'}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary' : 'border-border-strong'}`}>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </span>
                <Icon name={opt.icon} size={12} className="text-text-muted" />
                <div className="text-[12.5px] font-medium text-text">{opt.label}</div>
              </div>
              <div className="text-[10.5px] text-text-muted ml-5 leading-snug">{opt.desc}</div>
            </button>
          )
        })}
      </div>
      {mode === 'later' && (
        <div>
          <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Data e hora</label>
          <input
            type="datetime-local"
            value={toLocal(scheduledFor)}
            onChange={e => setScheduledFor(new Date(e.target.value).getTime())}
            min={toLocal(Date.now())}
            className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[12.5px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
      )}
    </div>
  )
}

/* ── PreviewBroadcast ───────────────────────────────────────────── */

function PreviewBroadcast({ message, media, buttons, botLabel }: {
  message: string; media: MediaAttachment | null
  buttons: BroadcastButton[]; botLabel: string
}) {
  const rendered = message
    .replace(/\{nome\}/g, 'João')
    .replace(/\{produto\}/g, 'Mentoria Premium')
    .replace(/\{valor\}/g, 'R$ 1.297')

  return (
    <Card title="Prévia da mensagem" subtitle={`Como aparece no Telegram via ${botLabel}`}>
      <div className="bg-surface-2/40 border border-border rounded-lg p-4 mt-1 min-h-[200px]">
        <div className="flex justify-start">
          <div className="max-w-[300px] bg-surface border border-border rounded-2xl rounded-bl-sm overflow-hidden">
            {media && (
              <div className="bg-surface-2 h-32 flex items-center justify-center text-text-muted relative overflow-hidden">
                <Icon name={media.kind === 'image' ? 'image' : media.kind === 'video' ? 'film' : 'file'} size={28} />
                <div className="absolute bottom-1.5 left-2 right-2 text-[10px] font-mono text-text-subtle truncate">{media.label}</div>
              </div>
            )}
            <div className="px-3 py-2 text-[12.5px] text-text whitespace-pre-wrap leading-snug">
              {rendered || <span className="italic text-text-muted">Sua mensagem aparece aqui…</span>}
            </div>
            {buttons.length > 0 && buttons.some(b => b.label) && (
              <div className="px-1.5 pb-1.5 grid grid-cols-1 gap-1">
                {buttons.filter(b => b.label).map((b, i) => (
                  <div key={i} className="bg-surface-2 border border-border text-[12px] font-medium text-text rounded-md py-1.5 px-2 text-center truncate">
                    {b.label}
                    {b.url && <ExternalLink size={9} className="inline-block ml-1 -mt-0.5 text-text-muted" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ── PSStat + SendingStatusCard ─────────────────────────────────── */

function PSStat({ label, value, sub, tone }: {
  label: string; value: string; sub: string; tone?: string
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{label}</div>
      <div className={`text-[18px] font-semibold tnum tracking-tight mt-1 ${tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-text'}`}>{value}</div>
      <div className="text-[10.5px] text-text-muted mt-0.5">{sub}</div>
    </div>
  )
}

function SendingStatusCard({ broadcast, now, onCancel }: {
  broadcast: Broadcast; now: number; onCancel: (id: string) => void
}) {
  const progress  = (broadcast.sent / broadcast.audienceCount) * 100
  const rate      = broadcast.sent > 0 ? (broadcast.delivered / broadcast.sent) * 100 : 0
  const remaining = broadcast.audienceCount - broadcast.sent
  const eta       = Math.max(1, Math.ceil(remaining / 1800))
  const failRate  = broadcast.sent > 0 ? fmtPct((broadcast.failed / broadcast.sent) * 100, 1) : '0.0%'

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative w-2 h-2 rounded-full bg-primary">
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
            </span>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-primary">Enviando</div>
          </div>
          <h3 className="text-[18px] font-semibold text-text mt-1.5">Disparo em andamento</h3>
          <div className="text-[12px] text-text-muted mt-0.5">
            Iniciado {relTimeS(broadcast.startedAt, now)} · {fmtNum(remaining)} restantes · ~{eta} min
          </div>
        </div>
        <Btn variant="secondary" size="sm" icon="x" onClick={() => onCancel(broadcast.id)}>Cancelar</Btn>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12px] text-text-muted">Progresso de envio</span>
          <span className="text-[13px] tnum font-semibold text-text">
            {fmtNum(broadcast.sent)} / {fmtNum(broadcast.audienceCount)}{' '}
            <span className="text-text-muted">({fmtPct(progress)})</span>
          </span>
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        <PSStat label="Entregues"  value={fmtNum(broadcast.delivered)} sub={fmtPct(rate, 1)} tone="success" />
        <PSStat label="Falhas"     value={fmtNum(broadcast.failed)}    sub={broadcast.failed > 0 ? failRate : '0.0%'} tone={broadcast.failed > 0 ? 'danger' : undefined} />
        <PSStat label="Velocidade" value="~30/s"                       sub="limite Telegram" />
      </div>
      <div className="mt-4 flex items-start gap-2 bg-primary-soft/40 border border-primary/20 rounded-lg p-3 text-[11.5px] text-text-muted leading-relaxed">
        <Info size={13} className="text-primary mt-0.5 shrink-0" />
        <span>
          O Telegram limita envios a aproximadamente <strong className="text-text">30 mensagens por segundo por bot</strong>. Disparos são <strong className="text-text">enfileirados e entregues gradualmente</strong> para evitar throttling.
        </span>
      </div>
    </Card>
  )
}

/* ── SummaryLine ────────────────────────────────────────────────── */

function SummaryLine({ icon, label, value, tnum }: {
  icon: string; label: string; value: string; tnum?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 py-1 border-b border-border last:border-b-0">
      <Icon name={icon} size={12} className="text-text-muted shrink-0" />
      <span className="text-text-muted shrink-0">{label}</span>
      <span className={`ml-auto text-text font-medium text-right truncate ${tnum ? 'tnum' : ''}`}>{value}</span>
    </div>
  )
}

/* ── BroadcastRow ───────────────────────────────────────────────── */

function BroadcastRow({ b, now, onOpen, onCancel }: {
  b: Broadcast; now: number; onOpen: () => void; onCancel: (id: string) => void
}) {
  const st       = STATUS_MAP[b.status]
  const bot      = getBotInfo(b.bot)
  const progress = b.audienceCount > 0 ? (b.sent / b.audienceCount) * 100 : 0
  const rate     = b.sent > 0 ? (b.delivered / b.sent) * 100 : 0

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="border-t border-border hover:bg-surface-2/60 transition-colors cursor-pointer"
    >
      <td className="pl-4 pr-2 py-3 max-w-[280px]">
        <div className="text-[12.5px] font-medium text-text truncate">
          {b.title || <span className="italic text-text-muted">Sem título</span>}
        </div>
        <div className="text-[10.5px] text-text-muted tnum mt-0.5">{bot.label} · {b.bot}</div>
      </td>

      <td className="px-2 py-3 whitespace-nowrap">
        <div className="text-[12px] text-text">{getAudienceLabel(b.audience)}</div>
        <div className="text-[10.5px] text-text-muted tnum">{fmtNum(b.audienceCount)} contatos</div>
      </td>

      <td className="px-2 py-3 whitespace-nowrap">
        {b.status === 'scheduled' && <>
          <div className="text-[12px] text-text tnum">{fmtDateTime(b.scheduledFor)}</div>
          <div className="text-[10.5px] text-warning">{relTimeS(b.scheduledFor, now)}</div>
        </>}
        {b.status === 'sending' && <>
          <div className="text-[12px] text-text">Iniciado {relTimeS(b.startedAt, now)}</div>
          <div className="text-[10.5px] text-primary">~{Math.max(1, Math.ceil((b.audienceCount - b.sent) / 1800))} min restantes</div>
        </>}
        {(b.status === 'done' || b.status === 'canceled') && <>
          <div className="text-[12px] text-text tnum">{fmtDateTime(b.finishedAt ?? b.startedAt)}</div>
          <div className="text-[10.5px] text-text-muted">{relTimeS(b.finishedAt ?? b.startedAt, now)}</div>
        </>}
        {b.status === 'failed' && <>
          <div className="text-[12px] text-danger">Interrompido</div>
          <div className="text-[10.5px] text-text-muted tnum">{relTimeS(b.finishedAt, now)}</div>
        </>}
        {b.status === 'draft' && <span className="text-[12px] text-text-muted">—</span>}
      </td>

      <td className="px-2 py-3 whitespace-nowrap">
        <Badge tone={st.tone}>
          {st.pulse && (
            <span className="relative w-1.5 h-1.5 rounded-full bg-primary">
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
            </span>
          )}
          {st.label}
        </Badge>
      </td>

      <td className="px-2 py-3 min-w-[220px]">
        {b.status === 'sending' ? (
          <div>
            <div className="flex items-baseline justify-between text-[11px] mb-1">
              <span className="text-text font-semibold tnum">{fmtNum(b.sent)} / {fmtNum(b.audienceCount)}</span>
              <span className="text-text-muted tnum">{fmtPct(progress)}</span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[10.5px] text-text-muted mt-1 tnum">
              {fmtNum(b.delivered)} entregues · {fmtNum(b.failed)} falhas
            </div>
          </div>
        ) : (b.status === 'done' || b.status === 'failed') ? (
          <div>
            <div className="text-[12px] tnum">
              <span className="text-text font-semibold">{fmtNum(b.delivered)}</span>
              <span className="text-text-muted"> / {fmtNum(b.sent)}</span>
              <span className="text-text-subtle"> entregues</span>
            </div>
            <div className={`text-[10.5px] tnum mt-0.5 ${rate >= 95 ? 'text-success' : rate >= 80 ? 'text-warning' : 'text-danger'}`}>
              Taxa: {fmtPct(rate, 1)}
              {b.failed > 0 && <span className="text-text-muted"> · {fmtNum(b.failed)} falharam</span>}
            </div>
          </div>
        ) : b.status === 'scheduled' ? (
          <div className="text-[11px] text-text-muted">Aguardando início</div>
        ) : (
          <div className="text-[11px] text-text-subtle italic">Não enviado</div>
        )}
      </td>

      <td className="pl-2 pr-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {b.status === 'sending' && (
            <button onClick={() => onCancel(b.id)} className="h-7 px-2 text-[11px] font-medium text-danger hover:bg-danger-soft rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Cancelar
            </button>
          )}
          {b.status === 'scheduled' && (
            <button onClick={() => onCancel(b.id)} className="h-7 px-2 text-[11px] font-medium text-text-muted hover:bg-surface-2 hover:text-text rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Desagendar
            </button>
          )}
          <ChevronRight size={14} className="text-text-muted" />
        </div>
      </td>
    </tr>
  )
}

/* ── BroadcastList ──────────────────────────────────────────────── */

interface FilterState { search: string; status: string; bot: string }

function BroadcastList({ broadcasts, now, onOpen, onCancel, onCreate }: {
  broadcasts: Broadcast[]; now: number
  onOpen: (id: string) => void; onCancel: (id: string) => void; onCreate: () => void
}) {
  const [filters, setFilters] = useState<FilterState>({ search: '', status: 'Todos', bot: 'Todos os bots' })

  const filtered = useMemo(() => broadcasts.filter(b => {
    const q = filters.search.trim().toLowerCase()
    if (q && !b.title.toLowerCase().includes(q) && !b.message.toLowerCase().includes(q)) return false
    if (filters.status !== 'Todos' && STATUS_MAP[b.status]?.label !== filters.status) return false
    if (filters.bot !== 'Todos os bots' && b.bot !== filters.bot) return false
    return true
  }), [broadcasts, filters])

  const totals = useMemo(() => {
    const month     = broadcasts.filter(b => now - (b.startedAt ?? b.createdAt) < 30 * 24 * 3600 * 1000)
    const sent      = broadcasts.reduce((s, b) => s + b.sent, 0)
    const delivered = broadcasts.reduce((s, b) => s + b.delivered, 0)
    const rate      = sent > 0 ? (delivered / sent) * 100 : 0
    const sending   = broadcasts.filter(b => b.status === 'sending').length
    return { monthCount: month.length, sent, rate, sendingCount: sending }
  }, [broadcasts, now])

  const hasFilters = filters.search || filters.status !== 'Todos' || filters.bot !== 'Todos os bots'

  return (
    <>
      <PageHeader
        title="Disparador"
        subtitle="Mensagens em massa para sua base — agendadas, segmentadas e respeitando os limites do Telegram."
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="secondary" icon="book-open">Boas práticas</Btn>
            <Btn variant="primary" icon="send" onClick={onCreate}>Novo disparo</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiS label="Disparos no mês"    value={fmtNum(totals.monthCount)}   icon="send"           tone="primary" />
        <KpiS label="Mensagens enviadas" value={fmtNum(totals.sent)}         icon="message-square" delta={24.8} />
        <KpiS label="Taxa de entrega"    value={fmtPct(totals.rate)}         icon="check-circle-2" highlight={totals.rate >= 95} />
        <KpiS label="Em andamento"       value={fmtNum(totals.sendingCount)} icon="activity"       pulse={totals.sendingCount > 0} />
      </div>

      {totals.sendingCount > 0 && (
        <div className="mb-4 flex items-start gap-2.5 bg-primary-soft border border-primary/30 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-fg flex items-center justify-center shrink-0">
            <Info size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-text">
              {totals.sendingCount} {totals.sendingCount === 1 ? 'disparo em andamento' : 'disparos em andamento'}
            </div>
            <div className="text-[11.5px] text-text-muted leading-relaxed mt-0.5 max-w-2xl">
              O Telegram limita ~<strong className="text-text">30 mensagens por segundo por bot</strong>. Disparos são <strong className="text-text">enfileirados e processados gradualmente</strong> para evitar throttling e banimento.
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Buscar por título ou mensagem…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <Dropdown
          label="Status"
          value={filters.status}
          options={['Todos', 'Rascunho', 'Agendado', 'Enviando', 'Concluído', 'Falhou', 'Cancelado']}
          onChange={v => setFilters(f => ({ ...f, status: v }))}
        />
        <Dropdown
          label="Bot"
          value={filters.bot}
          options={['Todos os bots', ...SENDER_BOTS.map(b => b.id)]}
          onChange={v => setFilters(f => ({ ...f, bot: v }))}
          width={240}
        />
        {hasFilters && (
          <button
            onClick={() => setFilters({ search: '', status: 'Todos', bot: 'Todos os bots' })}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={13} />
            Limpar
          </button>
        )}
        <div className="flex-1" />
        <div className="text-[11.5px] text-text-muted tnum">
          {filtered.length} {filtered.length === 1 ? 'disparo' : 'disparos'}
        </div>
      </div>

      <Card noPadding>
        {filtered.length === 0 ? (
          <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
              <Send size={20} />
            </div>
            <div className="text-[14px] font-semibold text-text">Nenhum disparo encontrado</div>
            <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">Crie seu primeiro broadcast ou limpe os filtros.</div>
            <Btn variant="primary" size="sm" icon="send" onClick={onCreate} className="mt-4">Novo disparo</Btn>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse min-w-[960px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
                  <th className="text-left font-semibold pl-4 pr-2 py-2.5">Título / Bot</th>
                  <th className="text-left font-semibold px-2 py-2.5">Público-alvo</th>
                  <th className="text-left font-semibold px-2 py-2.5">Agendamento</th>
                  <th className="text-left font-semibold px-2 py-2.5">Status</th>
                  <th className="text-left font-semibold px-2 py-2.5">Progresso / Entrega</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <BroadcastRow
                    key={b.id}
                    b={b}
                    now={now}
                    onOpen={() => onOpen(b.id)}
                    onCancel={onCancel}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

/* ── BroadcastEditor ────────────────────────────────────────────── */

function BroadcastEditor({ broadcast, now, onBack, onSave, onCancel }: {
  broadcast: Broadcast; now: number
  onBack: () => void; onSave: (b: Broadcast) => void; onCancel: (id: string) => void
}) {
  const [title, setTitle]               = useState(broadcast.title)
  const [bot, setBot]                   = useState(broadcast.bot)
  const [audience, setAudience]         = useState(broadcast.audience)
  const [message, setMessage]           = useState(broadcast.message)
  const [media, setMedia]               = useState<MediaAttachment | null>(broadcast.media)
  const [buttons, setButtons]           = useState<BroadcastButton[]>(broadcast.buttons)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>(broadcast.scheduledFor ? 'later' : 'now')
  const [scheduledFor, setScheduledFor] = useState(broadcast.scheduledFor ?? NOW_S + 3600 * 1000)
  const [confirmOpen, setConfirmOpen]   = useState(false)
  const [savedToast, setSavedToast]     = useState('')

  const editable = broadcast.status === 'draft' || broadcast.status === 'scheduled'
  const audCount = getAudienceCount(audience)
  const bLabel   = getBotInfo(bot).label
  const eta      = Math.max(1, Math.ceil(audCount / 1800))

  function buildPatch(extra: Partial<Broadcast> = {}): Broadcast {
    return {
      ...broadcast,
      title, bot, audience, audienceCount: audCount,
      message, media, buttons,
      scheduledFor: scheduleMode === 'later' ? scheduledFor : null,
      ...extra,
    }
  }

  function saveDraft() {
    onSave(buildPatch({ status: 'draft' }))
    setSavedToast('Rascunho salvo.')
    setTimeout(() => setSavedToast(''), 2500)
  }

  function doSchedule() { onSave(buildPatch({ status: 'scheduled' })); onBack() }

  function doSendNow() {
    onSave(buildPatch({ status: 'sending', startedAt: Date.now(), sent: 0, delivered: 0, failed: 0 }))
    setConfirmOpen(false)
    onBack()
  }

  const st = STATUS_MAP[broadcast.status]

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-7" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Sticky top bar */}
      <div className="h-[60px] bg-surface border-b border-border flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft size={14} />
          Disparos
        </button>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!editable}
            placeholder="Título do disparo"
            className="bg-transparent text-[15px] font-semibold text-text focus:outline-none focus:bg-surface-2 px-2 py-1 rounded-md min-w-0 max-w-md disabled:opacity-70"
          />
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {savedToast && (
            <span className="text-[11.5px] text-success flex items-center gap-1 mr-1">
              <Check size={12} /> {savedToast}
            </span>
          )}
          {editable && (
            <>
              <Btn variant="secondary" size="sm" icon="save" onClick={saveDraft}>Salvar rascunho</Btn>
              {scheduleMode === 'later'
                ? <Btn variant="primary" size="sm" icon="clock" onClick={doSchedule}>Agendar envio</Btn>
                : <Btn variant="primary" size="sm" icon="send" onClick={() => setConfirmOpen(true)}>Enviar agora</Btn>
              }
            </>
          )}
          {broadcast.status === 'sending' && (
            <Btn variant="secondary" size="sm" icon="x" onClick={() => onCancel(broadcast.id)}>Cancelar envio</Btn>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-7">
        {broadcast.status === 'sending' && (
          <div className="mb-5">
            <SendingStatusCard broadcast={broadcast} now={now} onCancel={onCancel} />
          </div>
        )}
        {broadcast.status === 'failed' && broadcast.failureReason && (
          <div className="mb-5 flex items-start gap-2.5 bg-danger-soft border border-danger/30 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-danger mt-0.5 shrink-0" />
            <div className="text-[12.5px] text-danger leading-relaxed">
              <strong>Envio interrompido:</strong> {broadcast.failureReason}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            <Card title="Bot remetente" subtitle="Qual bot fará o envio das mensagens">
              <div className="mt-2">
                <BotPicker value={bot} onChange={editable ? setBot : () => {}} />
              </div>
            </Card>

            <Card title="Público-alvo" subtitle={`${fmtNum(audCount)} contatos serão alcançados`} action={<Badge tone="primary">{fmtNum(audCount)}</Badge>}>
              <div className="mt-2">
                <AudiencePicker value={audience} onChange={editable ? setAudience : () => {}} />
              </div>
            </Card>

            <Card title="Mensagem" subtitle="Texto + mídia + botões inline">
              <div className="mt-2">
                <MessageComposer
                  message={message}
                  setMessage={editable ? setMessage : () => {}}
                  media={media}
                  setMedia={editable ? setMedia : () => {}}
                  buttons={buttons}
                  setButtons={editable ? setButtons : () => {}}
                />
              </div>
            </Card>

            {editable && (
              <Card title="Envio" subtitle="Quando este disparo deve sair">
                <div className="mt-2">
                  <SchedulePicker
                    mode={scheduleMode}
                    setMode={setScheduleMode}
                    scheduledFor={scheduledFor}
                    setScheduledFor={setScheduledFor}
                  />
                </div>
                <div className="mt-3.5 flex items-start gap-2 bg-warning-soft/40 border border-warning/20 rounded-lg p-3 text-[11.5px] text-text leading-relaxed">
                  <Info size={13} className="text-warning mt-0.5 shrink-0" />
                  <span>
                    Estimativa: <strong className="tnum">~{eta} {eta === 1 ? 'minuto' : 'minutos'}</strong>. Processados ao ritmo de ~30 mensagens/segundo por bot.
                  </span>
                </div>
              </Card>
            )}
          </div>

          <div className="xl:sticky xl:top-[80px] space-y-4">
            <PreviewBroadcast message={message} media={media} buttons={buttons} botLabel={bLabel} />
            <Card title="Resumo" subtitle="Configuração atual do disparo">
              <div className="space-y-2 mt-1 text-[12px]">
                <SummaryLine icon="bot"   label="Bot"      value={bLabel} />
                <SummaryLine icon="users" label="Público"  value={getAudienceLabel(audience)} />
                <SummaryLine icon="users" label="Alcance"  value={`${fmtNum(audCount)} contatos`} tnum />
                <SummaryLine
                  icon={scheduleMode === 'now' ? 'send' : 'clock'}
                  label={scheduleMode === 'now' ? 'Envio' : 'Agendado para'}
                  value={scheduleMode === 'now' ? 'Imediato' : fmtDateTime(scheduledFor)}
                  tnum={scheduleMode === 'later'}
                />
                <SummaryLine icon="zap" label="Estimativa" value={`~${eta} ${eta === 1 ? 'minuto' : 'minutos'}`} tnum />
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Enviar disparo agora?"
        subtitle={`O envio começa imediatamente para ${fmtNum(audCount)} contatos`}
        size="md"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setConfirmOpen(false)}>Cancelar</Btn>
            <Btn variant="primary" icon="send" onClick={doSendNow}>Sim, enviar agora</Btn>
          </>
        }
      >
        <div className="space-y-3">
          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5">
            <div className="grid grid-cols-2 gap-y-2 text-[12px]">
              <span className="text-text-muted">Público</span>
              <span className="text-text font-medium text-right">{getAudienceLabel(audience)}</span>
              <span className="text-text-muted">Contatos</span>
              <span className="text-text font-semibold tnum text-right">{fmtNum(audCount)}</span>
              <span className="text-text-muted">Bot</span>
              <span className="text-text font-medium text-right">{bLabel}</span>
              <span className="text-text-muted">Tempo estimado</span>
              <span className="text-text font-semibold tnum text-right">~{eta} min</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-warning-soft/40 border border-warning/20 rounded-lg p-3 text-[11.5px] text-text leading-relaxed">
            <Info size={13} className="text-warning mt-0.5 shrink-0" />
            <span>O envio é <strong>enfileirado e processado gradualmente</strong> respeitando os limites do Telegram (~30 msgs/s por bot).</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [now, setNow]               = useState(NOW_S)

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data } = await sb.from('broadcasts').select('*')
        if (data && data.length > 0) {
          setBroadcasts(data as Broadcast[])
        } else {
          setBroadcasts(INITIAL_BROADCASTS)
        }
      } catch {
        setBroadcasts(INITIAL_BROADCASTS)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setNow(n => n + 1000)
      setBroadcasts(arr => arr.map(b => {
        if (b.status !== 'sending') return b
        const remaining = b.audienceCount - b.sent
        if (remaining <= 0) return { ...b, status: 'done' as BroadcastStatus, finishedAt: Date.now() }
        const inc   = Math.min(remaining, 28 + Math.floor(Math.random() * 6))
        const deliv = Math.min(inc, Math.round(inc * (0.96 + Math.random() * 0.03)))
        return { ...b, sent: b.sent + inc, delivered: b.delivered + deliv, failed: b.failed + (inc - deliv) }
      }))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  function saveBroadcast(updated: Broadcast) {
    setBroadcasts(arr => arr.map(b => b.id === updated.id ? updated : b))
  }

  function cancelBroadcast(id: string) {
    setBroadcasts(arr => arr.map(b => {
      if (b.id !== id) return b
      if (b.status === 'sending')   return { ...b, status: 'canceled' as BroadcastStatus, finishedAt: Date.now() }
      if (b.status === 'scheduled') return { ...b, status: 'draft'    as BroadcastStatus, scheduledFor: null }
      return b
    }))
  }

  function createBroadcast() {
    const nb: Broadcast = {
      id: `br_${Date.now()}`,
      title: 'Novo disparo',
      bot: SENDER_BOTS[0].id,
      audience: 'leads',
      audienceCount: getAudienceCount('leads'),
      status: 'draft',
      sent: 0, delivered: 0, failed: 0,
      scheduledFor: null, startedAt: null, finishedAt: null,
      message: '', media: null, buttons: [],
      createdAt: Date.now(),
    }
    setBroadcasts(arr => [nb, ...arr])
    setEditingId(nb.id)
  }

  const editing = broadcasts.find(b => b.id === editingId)

  return (
    <DashboardLayout>
      {editing ? (
        <BroadcastEditor
          broadcast={editing}
          now={now}
          onBack={() => setEditingId(null)}
          onSave={saveBroadcast}
          onCancel={cancelBroadcast}
        />
      ) : (
        <BroadcastList
          broadcasts={broadcasts}
          now={now}
          onOpen={setEditingId}
          onCancel={cancelBroadcast}
          onCreate={createBroadcast}
        />
      )}
    </DashboardLayout>
  )
}
