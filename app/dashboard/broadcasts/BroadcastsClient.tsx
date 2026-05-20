'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  Send, BookOpen, MessageSquare, CheckCircle2, Activity, Info,
  AlertTriangle, XCircle, FileText, Clock, ChevronRight, ChevronLeft, ChevronDown,
  Search, X, Save, Zap, Bot, Users, User, ShoppingBag, Tag, Package,
  Image, Film, File, Plus, Trash2, ExternalLink, ArrowUpRight, ArrowDownRight,
  Check, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ── Tipos exportados (usados pelo Server Component) ─────────────── */

export interface RawBroadcast {
  id:             string
  title:          string
  bot_id:         string | null
  bot:            string | null
  audience:       string
  audience_count: number
  status:         string
  sent:           number
  delivered:      number
  failed:         number
  scheduled_for:  string | null
  started_at:     string | null
  finished_at:    string | null
  failure_reason: string | null
  message:        string
  media:          MediaAttachment | null
  buttons:        BroadcastButton[]
  filters:        Record<string, string>
  created_at:     string
  updated_at:     string
}

export interface RawBotOption {
  id:       string
  name:     string
  username: string | null
  color:    string | null
}

export interface AudienceCounts {
  all:    number
  leads:  number
  buyers: number
  tags:   Record<string, number>
}

/* ── Tipos internos ──────────────────────────────────────────────── */

interface MediaAttachment { kind: 'image' | 'video' | 'file'; label: string; url?: string }
interface BroadcastButton { label: string; url: string }
type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'done' | 'failed' | 'canceled'

interface Broadcast {
  id:           string
  title:        string
  botId:        string
  bot:          string
  audience:     string
  audienceCount: number
  status:       BroadcastStatus
  sent:         number
  delivered:    number
  failed:       number
  scheduledFor: number | null
  startedAt:    number | null
  finishedAt:   number | null
  message:      string
  media:        MediaAttachment | null
  buttons:      BroadcastButton[]
  createdAt:    number
  failureReason?: string
  filters:      Record<string, string>
}

interface AudienceOption { id: string; label: string; count: number; icon: string }

/* ── Mapeamento DB → Frontend ────────────────────────────────────── */

function mapRaw(row: RawBroadcast): Broadcast {
  return {
    id:           row.id,
    title:        row.title ?? 'Novo disparo',
    botId:        row.bot_id ?? '',
    bot:          row.bot ?? '',
    audience:     row.audience ?? 'leads',
    audienceCount: row.audience_count ?? 0,
    status:       (row.status ?? 'draft') as BroadcastStatus,
    sent:         row.sent ?? 0,
    delivered:    row.delivered ?? 0,
    failed:       row.failed ?? 0,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).getTime() : null,
    startedAt:    row.started_at    ? new Date(row.started_at).getTime()    : null,
    finishedAt:   row.finished_at   ? new Date(row.finished_at).getTime()   : null,
    message:      row.message ?? '',
    media:        row.media as MediaAttachment | null,
    buttons:      (row.buttons ?? []) as BroadcastButton[],
    createdAt:    new Date(row.created_at).getTime(),
    failureReason: row.failure_reason ?? undefined,
    filters:      row.filters ?? {},
  }
}

function mapToDb(b: Broadcast, userId: string) {
  return {
    user_id:       userId,
    title:         b.title,
    bot_id:        b.botId || null,
    bot:           b.bot,
    audience:      b.audience,
    audience_count: b.audienceCount,
    message:       b.message,
    media:         b.media,
    buttons:       b.buttons,
    status:        b.status,
    sent:          b.sent,
    delivered:     b.delivered,
    failed:        b.failed,
    scheduled_for: b.scheduledFor  ? new Date(b.scheduledFor).toISOString()  : null,
    started_at:    b.startedAt     ? new Date(b.startedAt).toISOString()     : null,
    finished_at:   b.finishedAt    ? new Date(b.finishedAt).toISOString()    : null,
    failure_reason: b.failureReason ?? null,
    filters:       b.filters,
  }
}

/* ── Constants ───────────────────────────────────────────────────── */

const STATUS_MAP: Record<BroadcastStatus, { label: string; tone: string; icon: string; pulse?: boolean }> = {
  draft:     { label: 'Rascunho',  tone: 'muted',   icon: 'file-text' },
  scheduled: { label: 'Agendado',  tone: 'warning', icon: 'clock' },
  sending:   { label: 'Enviando',  tone: 'primary', icon: 'send', pulse: true },
  done:      { label: 'Concluído', tone: 'success', icon: 'check-circle-2' },
  failed:    { label: 'Falhou',    tone: 'danger',  icon: 'alert-triangle' },
  canceled:  { label: 'Cancelado', tone: 'muted',   icon: 'x-circle' },
}

const BOT_COLORS = [
  'var(--primary)', 'var(--danger)', 'var(--success)', 'var(--warning)',
  'oklch(0.62 0.16 200)', 'oklch(0.58 0.18 310)',
]

/* ── Helpers ─────────────────────────────────────────────────────── */

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtPct = (n: number, dec = 1) => `${n.toFixed(dec)}%`

function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
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

/* ── Icon ────────────────────────────────────────────────────────── */

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

/* ── Btn ─────────────────────────────────────────────────────────── */

function Btn({
  children, onClick, variant = 'secondary', icon, iconRight, disabled, loading, size = 'md', className,
}: {
  children?: React.ReactNode; onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: string; iconRight?: string; disabled?: boolean; loading?: boolean
  size?: 'sm' | 'md'; className?: string
}) {
  const h  = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]'
  const ic = size === 'sm' ? 13 : 14
  const styles: Record<string, string> = {
    primary:   'bg-primary text-primary-fg hover:opacity-90',
    secondary: 'bg-surface-2 text-text border border-border hover:border-border-strong',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:text-white',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${h} ${styles[variant]} ${(disabled || loading) ? 'opacity-40 cursor-not-allowed' : ''} ${className ?? ''}`}
    >
      {loading ? <Loader2 size={ic} className="animate-spin" /> : icon && <Icon name={icon} size={ic} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={ic} />}
    </button>
  )
}

/* ── Badge ───────────────────────────────────────────────────────── */

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

/* ── Card ────────────────────────────────────────────────────────── */

function Card({ children, title, subtitle, action, noPadding }: {
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
      {noPadding ? children : <div className={title ? 'px-4 pb-4' : 'p-4'}>{children}</div>}
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────────────────── */

function Modal({ open, onClose, title, subtitle, size = 'md', footer, children }: {
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

/* ── KpiS ────────────────────────────────────────────────────────── */

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

/* ── BotPicker ───────────────────────────────────────────────────── */

function BotPicker({
  value, onChange, bots,
}: {
  value: string; onChange: (id: string) => void; bots: RawBotOption[]
}) {
  if (bots.length === 0) {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-warning-soft/30 border border-warning/20 rounded-lg text-[12px] text-warning">
        <AlertTriangle size={14} className="shrink-0" />
        Você precisa conectar pelo menos um bot em <strong>Gerenciar bots</strong> antes de criar um disparo.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {bots.map((b, idx) => {
        const active = value === b.id
        const color  = b.color ?? BOT_COLORS[idx % BOT_COLORS.length]
        const handle = b.username ? `@${b.username}` : b.name
        return (
          <button
            key={b.id}
            onClick={() => onChange(b.id)}
            className={`text-left p-3 rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center gap-3 ${active ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface hover:bg-surface-2 hover:border-border-strong'}`}
          >
            <div className="w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0" style={{ background: color }}>
              <Bot size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-text truncate">{b.name}</div>
              <div className="text-[11px] text-text-muted truncate tnum">{handle}</div>
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

/* ── AudiencePicker ──────────────────────────────────────────────── */

function AudiencePicker({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: AudienceOption[]
}) {
  return (
    <div className="space-y-1.5">
      {options.map(a => {
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

/* ── MediaUrlInput ───────────────────────────────────────────────── */

function MediaUrlInput({ onSet }: { onSet: (m: MediaAttachment) => void }) {
  const [kind, setKind] = useState<'image' | 'video' | 'file'>('image')
  const [url,  setUrl]  = useState('')

  const opts = [
    { k: 'image' as const, icon: 'image', label: 'Imagem' },
    { k: 'video' as const, icon: 'film',  label: 'Vídeo'  },
    { k: 'file'  as const, icon: 'file',  label: 'Documento' },
  ]

  function handleSet() {
    const trimmed = url.trim()
    if (!trimmed) return
    const labelMap = { image: 'Imagem', video: 'Vídeo', file: 'Documento' }
    onSet({ kind, label: labelMap[kind], url: trimmed })
    setUrl('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {opts.map(o => (
          <button
            key={o.k}
            type="button"
            onClick={() => setKind(o.k)}
            className={`flex-1 h-8 inline-flex items-center justify-center gap-1.5 text-[11.5px] font-medium rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${kind === o.k ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text'}`}
          >
            <Icon name={o.icon} size={12} />
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSet() } }}
          placeholder="https://…"
          className="flex-1 h-9 px-2.5 bg-surface border border-border rounded-md text-[12px] font-mono text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
        />
        <button
          type="button"
          onClick={handleSet}
          disabled={!url.trim()}
          className="h-9 px-3 bg-primary text-primary-fg rounded-md text-[12px] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Adicionar
        </button>
      </div>
      <div className="text-[10.5px] text-text-muted">Cole a URL pública da mídia. Suporte: Telegram CDN, S3, Cloudflare R2.</div>
    </div>
  )
}

/* ── MessageComposer ─────────────────────────────────────────────── */

function MessageComposer({
  message, setMessage, media, setMedia, buttons, setButtons, disabled,
}: {
  message: string; setMessage: (v: string) => void
  media: MediaAttachment | null; setMedia: (v: MediaAttachment | null) => void
  buttons: BroadcastButton[]; setButtons: (v: BroadcastButton[]) => void
  disabled?: boolean
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)

  function insertVar(v: string) {
    if (disabled) return
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
    if (buttons.length >= 3 || disabled) return
    setButtons([...buttons, { label: '', url: '' }])
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
          disabled={disabled}
          rows={5}
          placeholder="Olá {nome}, …"
          maxLength={4096}
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed disabled:opacity-60"
        />
        <div className="mt-1.5 flex flex-wrap gap-1 items-center text-[11px]">
          <span className="text-text-muted">Inserir:</span>
          {['nome', 'produto', 'valor', 'bot', 'data'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => insertVar(v)}
              disabled={disabled}
              className="px-1.5 h-5 bg-surface-2 border border-border rounded font-mono text-[10.5px] text-text-muted hover:text-text hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
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
              {media.url
                ? <div className="text-[10.5px] text-text-muted font-mono truncate">{media.url}</div>
                : <div className="text-[11px] text-text-muted">{media.kind === 'image' ? 'Imagem' : media.kind === 'video' ? 'Vídeo' : 'Documento'}</div>
              }
            </div>
            {!disabled && (
              <button onClick={() => setMedia(null)} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger">
                <X size={13} />
              </button>
            )}
          </div>
        ) : (
          !disabled && <MediaUrlInput onSet={setMedia} />
        )}
      </div>

      <div>
        <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Botões inline (até 3)</label>
        {buttons.length === 0 ? (
          !disabled && (
            <button
              onClick={addButton}
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-text-muted hover:text-primary rounded-md border border-dashed border-border hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              <Plus size={11} /> Adicionar botão
            </button>
          )
        ) : (
          <div className="space-y-2">
            {buttons.map((btn, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={btn.label}
                  onChange={e => setButtons(buttons.map((b, j) => j === i ? { ...b, label: e.target.value } : b))}
                  disabled={disabled}
                  placeholder="Texto do botão"
                  className="flex-1 h-9 px-2.5 bg-surface border border-border rounded-md text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-60"
                />
                <input
                  type="url"
                  value={btn.url}
                  onChange={e => setButtons(buttons.map((b, j) => j === i ? { ...b, url: e.target.value } : b))}
                  disabled={disabled}
                  placeholder="https://…"
                  className="flex-[1.4] h-9 px-2.5 bg-surface border border-border rounded-md text-[12px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-60"
                />
                {!disabled && (
                  <button
                    onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {!disabled && buttons.length < 3 && (
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

/* ── SchedulePicker ──────────────────────────────────────────────── */

function SchedulePicker({ mode, setMode, scheduledFor, setScheduledFor }: {
  mode: 'now' | 'later'; setMode: (v: 'now' | 'later') => void
  scheduledFor: number; setScheduledFor: (v: number) => void
}) {
  function toLocal(dt: number) {
    const d = new Date(dt)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {([
          { id: 'now',   label: 'Enviar agora',  desc: 'Inicia imediatamente após confirmar.',          icon: 'send'  },
          { id: 'later', label: 'Agendar envio', desc: 'Inicia automaticamente na data/hora abaixo.', icon: 'clock' },
        ] as const).map(opt => {
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

/* ── BestPracticesModal ──────────────────────────────────────────── */

function BestPracticesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tips = [
    { icon: 'users',         title: 'Segmente com precisão',          body: 'Envie apenas para quem tem interesse real. Disparos genéricos aumentam bloqueios e reduzem a taxa de entrega.' },
    { icon: 'message-square', title: 'Personalize a mensagem',         body: 'Use {nome}, {produto} e {bot} para criar mensagens mais próximas. Mensagens personalizadas têm até 30% mais engajamento.' },
    { icon: 'clock',          title: 'Escolha o horário certo',        body: 'Agende disparos entre 8h e 21h (horário do seu público). Evite madrugadas e finais de semana para produtos B2B.' },
    { icon: 'activity',       title: 'Respeite o limite do Telegram',  body: 'O Telegram bloqueia bots que enviam muito rápido. O Umbra Bot já limita automaticamente a ~28 msgs/segundo.' },
    { icon: 'check-circle-2', title: 'Teste antes de enviar',          body: 'Crie um segmento de teste (tag: "teste") com sua própria conta. Verifique a prévia antes de disparar para toda a base.' },
    { icon: 'alert-triangle', title: 'Cuide da frequência',            body: 'Evite mais de 1-2 disparos por semana para o mesmo público. Excesso de mensagens leva a bloqueios e prejudica disparos futuros.' },
  ]
  return (
    <Modal open={open} onClose={onClose} title="Boas práticas de disparo" size="lg"
      footer={<Btn variant="primary" onClick={onClose}>Entendido</Btn>}
    >
      <div className="space-y-4">
        {tips.map(t => (
          <div key={t.title} className="flex gap-3">
            <div className="w-7 h-7 rounded-md bg-primary-soft text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Icon name={t.icon} size={13} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-text mb-0.5">{t.title}</div>
              <div className="text-[12.5px] text-text-muted leading-relaxed">{t.body}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ── PreviewBroadcast ────────────────────────────────────────────── */

function PreviewBroadcast({ message, media, buttons, botLabel }: {
  message: string; media: MediaAttachment | null
  buttons: BroadcastButton[]; botLabel: string
}) {
  const rendered = message
    .replace(/\{nome\}/g,    'João')
    .replace(/\{produto\}/g, 'Mentoria Premium')
    .replace(/\{valor\}/g,   'R$ 1.297')
    .replace(/\{bot\}/g,     botLabel)
    .replace(/\{data\}/g,    new Date().toLocaleDateString('pt-BR'))

  return (
    <Card title="Prévia da mensagem" subtitle={`Como aparece no Telegram via ${botLabel}`}>
      <div className="bg-surface-2/40 border border-border rounded-lg p-4 mt-1 min-h-[200px]">
        <div className="flex justify-start">
          <div className="max-w-[300px] bg-surface border border-border rounded-2xl rounded-bl-sm overflow-hidden">
            {media && (
              <div className="bg-surface-2 h-32 flex items-center justify-center text-text-muted relative overflow-hidden">
                {media.url && media.kind === 'image'
                  ? <img src={media.url} alt="prévia" className="absolute inset-0 w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <Icon name={media.kind === 'image' ? 'image' : media.kind === 'video' ? 'film' : 'file'} size={28} />
                }
                <div className="absolute bottom-1.5 left-2 right-2 text-[10px] font-mono text-text-subtle truncate bg-black/30 px-1 rounded">
                  {media.url ?? media.label}
                </div>
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

/* ── SendingStatusCard ───────────────────────────────────────────── */

function SendingStatusCard({ broadcast, now, onCancel }: {
  broadcast: Broadcast; now: number; onCancel: (id: string) => void
}) {
  const progress  = broadcast.audienceCount > 0 ? (broadcast.sent / broadcast.audienceCount) * 100 : 0
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
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Entregues</div>
          <div className="text-[18px] font-semibold tnum tracking-tight mt-1 text-success">{fmtNum(broadcast.delivered)}</div>
          <div className="text-[10.5px] text-text-muted mt-0.5">{fmtPct(rate, 1)}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Falhas</div>
          <div className={`text-[18px] font-semibold tnum tracking-tight mt-1 ${broadcast.failed > 0 ? 'text-danger' : 'text-text'}`}>{fmtNum(broadcast.failed)}</div>
          <div className="text-[10.5px] text-text-muted mt-0.5">{failRate}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Velocidade</div>
          <div className="text-[18px] font-semibold tnum tracking-tight mt-1 text-text">~28/s</div>
          <div className="text-[10.5px] text-text-muted mt-0.5">limite Telegram</div>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 bg-primary-soft/40 border border-primary/20 rounded-lg p-3 text-[11.5px] text-text-muted leading-relaxed">
        <Info size={13} className="text-primary mt-0.5 shrink-0" />
        <span>
          O Telegram limita envios a aproximadamente <strong className="text-text">30 mensagens por segundo por bot</strong>. O progresso é atualizado em tempo real via Supabase Realtime.
        </span>
      </div>
    </Card>
  )
}

/* ── SummaryLine ─────────────────────────────────────────────────── */

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

/* ── BroadcastRow ────────────────────────────────────────────────── */

function BroadcastRow({ b, now, botName, audienceLabel, onOpen, onCancel, onDuplicate }: {
  b: Broadcast; now: number
  botName: string; audienceLabel: string
  onOpen: () => void; onCancel: (id: string) => void; onDuplicate: (id: string) => void
}) {
  const st       = STATUS_MAP[b.status]
  const progress = b.audienceCount > 0 ? (b.sent / b.audienceCount) * 100 : 0
  const rate     = b.sent > 0 ? (b.delivered / b.sent) * 100 : 0

  return (
    <tr
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="border-t border-border hover:bg-surface-2/60 transition-colors cursor-pointer"
    >
      <td className="pl-4 pr-2 py-3 max-w-[280px]">
        <div className="text-[12.5px] font-medium text-text truncate">
          {b.title || <span className="italic text-text-muted">Sem título</span>}
        </div>
        <div className="text-[10.5px] text-text-muted tnum mt-0.5">{botName}</div>
      </td>

      <td className="px-2 py-3 whitespace-nowrap">
        <div className="text-[12px] text-text">{audienceLabel}</div>
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
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <div className="text-[10.5px] text-text-muted mt-1 tnum">{fmtNum(b.delivered)} entregues · {fmtNum(b.failed)} falhas</div>
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
            <button
              onClick={() => onCancel(b.id)}
              className="h-7 px-2 text-[11px] font-medium text-danger hover:bg-danger-soft rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancelar
            </button>
          )}
          {b.status === 'scheduled' && (
            <button
              onClick={() => onCancel(b.id)}
              className="h-7 px-2 text-[11px] font-medium text-text-muted hover:bg-surface-2 hover:text-text rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Desagendar
            </button>
          )}
          {(b.status === 'done' || b.status === 'draft' || b.status === 'failed' || b.status === 'canceled') && (
            <button
              onClick={() => onDuplicate(b.id)}
              title="Duplicar"
              className="h-7 px-2 text-[11px] font-medium text-text-muted hover:bg-surface-2 hover:text-text rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Copiar
            </button>
          )}
          <ChevronRight size={14} className="text-text-muted" />
        </div>
      </td>
    </tr>
  )
}

/* ── BroadcastEditor ─────────────────────────────────────────────── */

interface EditorProps {
  broadcast:       Broadcast
  now:             number
  bots:            RawBotOption[]
  audienceOptions: AudienceOption[]
  userId:          string
  onBack:          () => void
  onSave:          (b: Broadcast) => Promise<void>
  onSendNow:       (b: Broadcast) => Promise<string | null>
  onSchedule:      (b: Broadcast) => Promise<void>
  onCancel:        (id: string) => Promise<void>
  onDelete:        (id: string) => Promise<void>
}

function BroadcastEditor({
  broadcast, now, bots, audienceOptions, userId,
  onBack, onSave, onSendNow, onSchedule, onCancel, onDelete,
}: EditorProps) {
  const supabase = createClient()

  const [title,        setTitle]        = useState(broadcast.title)
  const [botId,        setBotId]        = useState(broadcast.botId)
  const [audience,     setAudience]     = useState(broadcast.audience)
  const [message,      setMessage]      = useState(broadcast.message)
  const [media,        setMedia]        = useState<MediaAttachment | null>(broadcast.media)
  const [buttons,      setButtons]      = useState<BroadcastButton[]>(broadcast.buttons)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>(broadcast.scheduledFor ? 'later' : 'now')
  const [scheduledFor, setScheduledFor] = useState(broadcast.scheduledFor ?? Date.now() + 3600 * 1000)
  const [regAfter,     setRegAfter]     = useState(broadcast.filters?.registered_after  ?? '')
  const [regBefore,    setRegBefore]    = useState(broadcast.filters?.registered_before ?? '')
  const [confirmOpen,  setConfirmOpen]  = useState(false)
  const [deleteOpen,   setDeleteOpen]   = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [sending,      setSending]      = useState(false)
  const [toast,        setToast]        = useState('')
  const [localCounts,  setLocalCounts]  = useState<AudienceCounts | null>(null)

  // Atualiza contagens ao trocar de bot
  useEffect(() => {
    if (!botId) { setLocalCounts(null); return }
    supabase
      .rpc('broadcasts_audience_counts', { p_user_id: userId, p_bot_id: botId })
      .then(({ data }) => { if (data) setLocalCounts(data as unknown as AudienceCounts) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, userId])

  const effectiveOptions = useMemo<AudienceOption[]>(() => {
    if (!localCounts) return audienceOptions
    return [
      { id: 'all',    label: 'Todos os contatos',             count: localCounts.all,    icon: 'users'        },
      { id: 'leads',  label: 'Apenas leads (não compradores)', count: localCounts.leads,  icon: 'user'         },
      { id: 'buyers', label: 'Apenas compradores',             count: localCounts.buyers, icon: 'shopping-bag' },
      ...Object.entries(localCounts.tags ?? {}).map(([tag, cnt]) => ({
        id: `tag:${tag}`, label: `Tag: ${tag}`, count: cnt as number, icon: 'tag',
      })),
    ]
  }, [localCounts, audienceOptions])

  const editable = broadcast.status === 'draft' || broadcast.status === 'scheduled'
  const selBot   = bots.find(b => b.id === botId)
  const bLabel   = selBot ? (selBot.username ? `@${selBot.username}` : selBot.name) : '—'
  const audOpt   = effectiveOptions.find(a => a.id === audience)
  const audCount = audOpt?.count ?? 0
  const eta      = Math.max(1, Math.ceil(audCount / 1800))

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function buildPatch(extra: Partial<Broadcast> = {}): Broadcast {
    const filters: Record<string, string> = {}
    if (regAfter.trim())  filters.registered_after  = regAfter.trim()
    if (regBefore.trim()) filters.registered_before = regBefore.trim()
    return { ...broadcast, title, botId, bot: bLabel, audience, audienceCount: audCount, message, media, buttons, scheduledFor: scheduleMode === 'later' ? scheduledFor : null, filters, ...extra }
  }

  async function handleSaveDraft() {
    if (!title.trim()) { showToast('Digite um título para salvar.'); return }
    setSaving(true)
    await onSave(buildPatch({ status: 'draft' }))
    setSaving(false)
    showToast('Rascunho salvo.')
  }

  async function handleSchedule() {
    if (!title.trim()) { showToast('Digite um título para agendar.'); return }
    if (!message.trim()) { showToast('A mensagem não pode ficar vazia.'); return }
    setSaving(true)
    await onSchedule(buildPatch({ status: 'scheduled', scheduledFor }))
    setSaving(false)
    showToast('Disparo agendado.')
    onBack()
  }

  async function handleSendNow() {
    if (!botId) { showToast('Selecione um bot remetente.'); return }
    if (!message.trim()) { showToast('A mensagem não pode ficar vazia.'); return }
    setSending(true)
    setConfirmOpen(false)
    const errMsg = await onSendNow(buildPatch())
    setSending(false)
    if (errMsg) {
      showToast(errMsg)
    } else {
      onBack()
    }
  }

  async function handleCancel() {
    await onCancel(broadcast.id)
  }

  async function handleDelete() {
    setDeleteOpen(false)
    await onDelete(broadcast.id)
    onBack()
  }

  const st = STATUS_MAP[broadcast.status]

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-7" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Topbar sticky */}
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
          {toast && (
            <span className="text-[11.5px] text-success flex items-center gap-1 mr-1">
              <Check size={12} /> {toast}
            </span>
          )}
          {editable && (
            <>
              {(broadcast.status === 'draft') && (
                <Btn variant="danger" size="sm" icon="trash-2" onClick={() => setDeleteOpen(true)}>Excluir</Btn>
              )}
              <Btn variant="secondary" size="sm" icon="save" onClick={handleSaveDraft} loading={saving}>Salvar rascunho</Btn>
              {scheduleMode === 'later'
                ? <Btn variant="primary" size="sm" icon="clock" onClick={handleSchedule} loading={saving}>Agendar envio</Btn>
                : <Btn variant="primary" size="sm" icon="send" onClick={() => setConfirmOpen(true)} disabled={!botId || !message.trim()}>Enviar agora</Btn>
              }
            </>
          )}
          {broadcast.status === 'sending' && (
            <Btn variant="secondary" size="sm" icon="x" onClick={handleCancel} loading={sending}>Cancelar envio</Btn>
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
                <BotPicker value={botId} onChange={editable ? setBotId : () => {}} bots={bots} />
              </div>
            </Card>

            <Card
              title="Público-alvo"
              subtitle={`${fmtNum(audCount)} contatos serão alcançados`}
              action={<Badge tone="primary">{fmtNum(audCount)}</Badge>}
            >
              <div className="mt-2">
                <AudiencePicker value={audience} onChange={editable ? setAudience : () => {}} options={effectiveOptions} />
              </div>
            </Card>

            <Card title="Mensagem" subtitle="Texto + mídia + botões inline">
              <div className="mt-2">
                <MessageComposer
                  message={message} setMessage={editable ? setMessage : () => {}}
                  media={media}     setMedia={editable ? setMedia : () => {}}
                  buttons={buttons} setButtons={editable ? setButtons : () => {}}
                  disabled={!editable}
                />
              </div>
            </Card>

            <Card title="Filtros avançados" subtitle="Restrinja o público por data de cadastro (opcional)">
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Cadastrado após</label>
                  <input
                    type="date"
                    value={regAfter}
                    onChange={e => setRegAfter(e.target.value)}
                    disabled={!editable}
                    className="w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Cadastrado antes de</label>
                  <input
                    type="date"
                    value={regBefore}
                    onChange={e => setRegBefore(e.target.value)}
                    disabled={!editable}
                    className="w-full h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-60"
                  />
                </div>
              </div>
              {(regAfter || regBefore) && (
                <div className="mt-2.5 text-[11px] text-text-muted flex items-center gap-1.5">
                  <Info size={12} className="text-primary shrink-0" />
                  Apenas contatos cadastrados {regAfter ? `a partir de ${regAfter}` : ''}{regAfter && regBefore ? ' e ' : ''}{regBefore ? `até ${regBefore}` : ''} receberão o disparo.
                </div>
              )}
            </Card>

            {editable && (
              <Card title="Envio" subtitle="Quando este disparo deve sair">
                <div className="mt-2">
                  <SchedulePicker
                    mode={scheduleMode} setMode={setScheduleMode}
                    scheduledFor={scheduledFor} setScheduledFor={setScheduledFor}
                  />
                </div>
                <div className="mt-3.5 flex items-start gap-2 bg-warning-soft/40 border border-warning/20 rounded-lg p-3 text-[11.5px] text-text leading-relaxed">
                  <Info size={13} className="text-warning mt-0.5 shrink-0" />
                  <span>
                    Estimativa: <strong className="tnum">~{eta} {eta === 1 ? 'minuto' : 'minutos'}</strong>. Processados ao ritmo de ~28 mensagens/segundo por bot.
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
                <SummaryLine icon="users" label="Público"  value={audOpt?.label ?? audience} />
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

      {/* Modal confirmar envio */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Enviar disparo agora?"
        subtitle={`O envio começa imediatamente para ${fmtNum(audCount)} contatos`}
        size="md"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setConfirmOpen(false)}>Cancelar</Btn>
            <Btn variant="primary" icon="send" onClick={handleSendNow} loading={sending}>Sim, enviar agora</Btn>
          </>
        }
      >
        <div className="space-y-3">
          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5">
            <div className="grid grid-cols-2 gap-y-2 text-[12px]">
              <span className="text-text-muted">Público</span>
              <span className="text-text font-medium text-right">{audOpt?.label ?? audience}</span>
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
            <span>O envio é <strong>enfileirado e processado gradualmente</strong> respeitando os limites do Telegram (~28 msgs/s por bot).</span>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar exclusão */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Excluir rascunho?"
        subtitle="Esta ação não pode ser desfeita."
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteOpen(false)}>Cancelar</Btn>
            <Btn variant="danger" icon="trash-2" onClick={handleDelete}>Excluir</Btn>
          </>
        }
      >
        <p className="text-[13px] text-text-muted">O rascunho <strong className="text-text">{title || 'Sem título'}</strong> será removido permanentemente.</p>
      </Modal>
    </div>
  )
}

/* ── BroadcastList ───────────────────────────────────────────────── */

interface FilterState { search: string; status: string; bot: string }

function BroadcastList({
  broadcasts, now, bots, audienceOptions,
  onOpen, onCancel, onCreate, onDuplicate, hasMore, onLoadMore, loadingMore,
}: {
  broadcasts:    Broadcast[]
  now:           number
  bots:          RawBotOption[]
  audienceOptions: AudienceOption[]
  onOpen:        (id: string) => void
  onCancel:      (id: string) => Promise<void>
  onCreate:      () => Promise<void>
  onDuplicate:   (id: string) => Promise<void>
  hasMore:       boolean
  onLoadMore:    () => Promise<void>
  loadingMore:   boolean
}) {
  const [filters,   setFilters]  = useState<FilterState>({ search: '', status: 'Todos', bot: 'Todos os bots' })
  const [creating,  setCreating] = useState(false)
  const [bestOpen,  setBestOpen] = useState(false)

  const botMap = useMemo(() => {
    const m = new Map<string, string>()
    bots.forEach(b => m.set(b.id, b.username ? `@${b.username}` : b.name))
    return m
  }, [bots])

  const audLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    audienceOptions.forEach(a => m.set(a.id, a.label))
    return m
  }, [audienceOptions])

  const botOptions = useMemo(() => ['Todos os bots', ...bots.map(b => b.username ? `@${b.username}` : b.name)], [bots])
  const botIdByDisplay = useMemo(() => {
    const m = new Map<string, string>()
    bots.forEach(b => m.set(b.username ? `@${b.username}` : b.name, b.id))
    return m
  }, [bots])

  const filtered = useMemo(() => broadcasts.filter(b => {
    const q = filters.search.trim().toLowerCase()
    if (q && !b.title.toLowerCase().includes(q) && !b.message.toLowerCase().includes(q)) return false
    if (filters.status !== 'Todos' && STATUS_MAP[b.status]?.label !== filters.status) return false
    if (filters.bot !== 'Todos os bots') {
      const botId = botIdByDisplay.get(filters.bot)
      if (botId && b.botId !== botId) return false
    }
    return true
  }), [broadcasts, filters, botIdByDisplay])

  const totals = useMemo(() => {
    const nowMs     = now
    const month     = broadcasts.filter(b => nowMs - (b.startedAt ?? b.createdAt) < 30 * 24 * 3600 * 1000)
    const totalSent = broadcasts.reduce((s, b) => s + b.sent, 0)
    const totalDel  = broadcasts.reduce((s, b) => s + b.delivered, 0)
    const rate      = totalSent > 0 ? (totalDel / totalSent) * 100 : 0
    const sending   = broadcasts.filter(b => b.status === 'sending').length
    return { monthCount: month.length, sent: totalSent, rate, sendingCount: sending }
  }, [broadcasts, now])

  const hasFilters = filters.search || filters.status !== 'Todos' || filters.bot !== 'Todos os bots'

  async function handleCreate() {
    setCreating(true)
    await onCreate()
    setCreating(false)
  }

  return (
    <>
      <PageHeader
        title="Disparador"
        subtitle="Mensagens em massa para sua base — agendadas, segmentadas e respeitando os limites do Telegram."
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="secondary" icon="book-open" onClick={() => setBestOpen(true)}>Boas práticas</Btn>
            <Btn variant="primary" icon="send" onClick={handleCreate} loading={creating} disabled={bots.length === 0}>
              Novo disparo
            </Btn>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiS label="Disparos no mês"    value={fmtNum(totals.monthCount)}   icon="send"           tone="primary" />
        <KpiS label="Mensagens enviadas" value={fmtNum(totals.sent)}         icon="message-square" />
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
              Progresso atualizado em tempo real via Supabase Realtime — <strong className="text-text">sem precisar recarregar a página</strong>.
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
        <div className="relative">
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="h-9 pl-3 pr-8 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none cursor-pointer"
          >
            {['Todos', 'Rascunho', 'Agendado', 'Enviando', 'Concluído', 'Falhou', 'Cancelado'].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filters.bot}
            onChange={e => setFilters(f => ({ ...f, bot: e.target.value }))}
            className="h-9 pl-3 pr-8 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none cursor-pointer"
            style={{ minWidth: 180 }}
          >
            {botOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        {hasFilters && (
          <button
            onClick={() => setFilters({ search: '', status: 'Todos', bot: 'Todos os bots' })}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={13} /> Limpar
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
            <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">
              {broadcasts.length === 0 ? 'Crie seu primeiro broadcast para começar.' : 'Tente limpar os filtros.'}
            </div>
            {broadcasts.length === 0 && bots.length > 0 && (
              <Btn variant="primary" size="sm" icon="send" onClick={handleCreate} loading={creating} className="mt-4">Novo disparo</Btn>
            )}
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
                    botName={botMap.get(b.botId) ?? b.bot ?? '—'}
                    audienceLabel={audLabelMap.get(b.audience) ?? b.audience}
                    onOpen={() => onOpen(b.id)}
                    onCancel={onCancel}
                    onDuplicate={onDuplicate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Btn variant="secondary" onClick={onLoadMore} loading={loadingMore}>
            Carregar mais disparos
          </Btn>
        </div>
      )}

      <BestPracticesModal open={bestOpen} onClose={() => setBestOpen(false)} />
    </>
  )
}

/* ── BroadcastsClient (componente principal) ─────────────────────── */

interface Props {
  initialBroadcasts: RawBroadcast[]
  bots:              RawBotOption[]
  audienceCounts:    AudienceCounts
  userId:            string
  initialHasMore:    boolean
}

export default function BroadcastsClient({
  initialBroadcasts, bots, audienceCounts, userId, initialHasMore,
}: Props) {
  const supabase  = createClient()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(() => initialBroadcasts.map(mapRaw))
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [now,        setNow]        = useState(Date.now)
  const [hasMore,    setHasMore]    = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const offsetRef = useRef(initialBroadcasts.length)

  // Audiência dinâmica a partir dos dados reais
  const audienceOptions = useMemo<AudienceOption[]>(() => [
    { id: 'all',    label: 'Todos os contatos',             count: audienceCounts.all,    icon: 'users'        },
    { id: 'leads',  label: 'Apenas leads (não compradores)', count: audienceCounts.leads,  icon: 'user'         },
    { id: 'buyers', label: 'Apenas compradores',             count: audienceCounts.buyers, icon: 'shopping-bag' },
    ...Object.entries(audienceCounts.tags ?? {}).map(([tag, count]) => ({
      id:    `tag:${tag}`,
      label: `Tag: ${tag}`,
      count: count as number,
      icon:  'tag',
    })),
  ], [audienceCounts])

  // Tick a cada 30s para atualizar tempos relativos
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Realtime: atualizações de progresso em tempo real (INSERT + UPDATE)
  useEffect(() => {
    const channel = supabase
      .channel('broadcasts-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'broadcasts', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as unknown as RawBroadcast
          setBroadcasts(prev => prev.map(b => b.id === row.id ? mapRaw(row) : b))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcasts', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as unknown as RawBroadcast
          setBroadcasts(prev => {
            if (prev.some(b => b.id === row.id)) return prev
            return [mapRaw(row), ...prev]
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  /* ── CRUD ────────────────────────────────────────────────────────── */

  const createBroadcast = useCallback(async () => {
    const defaultBotId  = bots[0]?.id ?? ''
    const defaultBotStr = bots[0] ? (bots[0].username ? `@${bots[0].username}` : bots[0].name) : ''
    const defaultAud    = 'leads'
    const defaultCount  = audienceCounts.leads

    const { data, error } = await supabase
      .from('broadcasts')
      .insert({
        user_id:        userId,
        title:          'Novo disparo',
        bot_id:         defaultBotId || null,
        bot:            defaultBotStr,
        audience:       defaultAud,
        audience_count: defaultCount,
        message:        '',
        buttons:        [],
        status:         'draft',
        sent:           0, delivered: 0, failed: 0,
        filters:        {},
      })
      .select('id')
      .single()

    if (!error && data?.id) {
      setEditingId(data.id)
    }
  }, [bots, audienceCounts, userId, supabase])

  const saveBroadcast = useCallback(async (updated: Broadcast) => {
    setBroadcasts(prev => prev.map(b => b.id === updated.id ? updated : b))
    await supabase
      .from('broadcasts')
      .update(mapToDb(updated, userId))
      .eq('id', updated.id)
      .eq('user_id', userId)
  }, [userId, supabase])

  const sendBroadcastNow = useCallback(async (updated: Broadcast): Promise<string | null> => {
    await saveBroadcast(updated)

    // Tenta aguardar resposta por até 20s para capturar erros imediatos
    // (rate limit, status inválido, bot não encontrado, etc.)
    // Se demorar mais, assuma que está processando audiência grande — Realtime cuida do progresso
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 20_000)

    try {
      const res = await fetch('/api/broadcasts/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ broadcast_id: updated.id }),
        signal:  controller.signal,
      })
      clearTimeout(tid)

      if (!res.ok) {
        const body = await res.json().catch(() => ({} as Record<string, string>)) as Record<string, string>
        const msg = body.error ?? `Erro ${res.status}`
        // Reverte status local — disparo não saiu
        setBroadcasts(prev => prev.map(b => b.id === updated.id ? { ...b, status: 'draft' } : b))
        return msg
      }
    } catch {
      clearTimeout(tid)
      // AbortError = timeout → audiência grande ainda processando (normal)
      // Outros = erro de rede → Realtime mostrará quando status mudar
    }

    setBroadcasts(prev => prev.map(b =>
      b.id === updated.id ? { ...updated, status: 'sending', startedAt: Date.now() } : b,
    ))
    return null
  }, [saveBroadcast])

  const scheduleBroadcast = useCallback(async (updated: Broadcast) => {
    await saveBroadcast({ ...updated, status: 'scheduled' })
  }, [saveBroadcast])

  const cancelBroadcast = useCallback(async (id: string) => {
    const b = broadcasts.find(x => x.id === id)
    if (!b) return

    const newStatus: BroadcastStatus = b.status === 'sending' ? 'canceled' : 'draft'
    const patch = {
      ...b,
      status:      newStatus,
      scheduledFor: newStatus === 'draft' ? null : b.scheduledFor,
      finishedAt:  newStatus === 'canceled' ? Date.now() : b.finishedAt,
    }

    setBroadcasts(prev => prev.map(x => x.id === id ? patch : x))
    await supabase
      .from('broadcasts')
      .update({ status: newStatus, finished_at: newStatus === 'canceled' ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('user_id', userId)
  }, [broadcasts, userId, supabase])

  const deleteBroadcast = useCallback(async (id: string) => {
    setBroadcasts(prev => prev.filter(b => b.id !== id))
    await supabase
      .from('broadcasts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
  }, [userId, supabase])

  const duplicateBroadcast = useCallback(async (id: string) => {
    const source = broadcasts.find(b => b.id === id)
    if (!source) return

    const { data, error } = await supabase
      .from('broadcasts')
      .insert({
        user_id:        userId,
        title:          `${source.title} (cópia)`,
        bot_id:         source.botId || null,
        bot:            source.bot,
        audience:       source.audience,
        audience_count: source.audienceCount,
        message:        source.message,
        media:          source.media,
        buttons:        source.buttons,
        status:         'draft',
        sent:           0, delivered: 0, failed: 0,
        filters:        source.filters,
      })
      .select('id, title, bot_id, bot, audience, audience_count, status, sent, delivered, failed, scheduled_for, started_at, finished_at, failure_reason, message, media, buttons, filters, created_at, updated_at')
      .single()

    if (!error && data) {
      setBroadcasts(prev => [mapRaw(data as unknown as RawBroadcast), ...prev])
    }
  }, [broadcasts, userId, supabase])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    const { data } = await supabase
      .from('broadcasts')
      .select(
        'id, title, bot_id, bot, audience, audience_count, status,' +
        'sent, delivered, failed, scheduled_for, started_at, finished_at,' +
        'failure_reason, message, media, buttons, filters, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offsetRef.current, offsetRef.current + 49)

    if (data && data.length > 0) {
      const newRows = (data as unknown as RawBroadcast[]).map(mapRaw)
      setBroadcasts(prev => [...prev, ...newRows.filter(r => !prev.some(p => p.id === r.id))])
      offsetRef.current += data.length
      setHasMore(data.length === 50)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }, [userId, supabase])

  /* ── Render ──────────────────────────────────────────────────────── */

  const editing = broadcasts.find(b => b.id === editingId)

  return editing ? (
    <BroadcastEditor
      broadcast={editing}
      now={now}
      bots={bots}
      audienceOptions={audienceOptions}
      userId={userId}
      onBack={() => setEditingId(null)}
      onSave={saveBroadcast}
      onSendNow={sendBroadcastNow}
      onSchedule={scheduleBroadcast}
      onCancel={cancelBroadcast}
      onDelete={deleteBroadcast}
    />
  ) : (
    <BroadcastList
      broadcasts={broadcasts}
      now={now}
      bots={bots}
      audienceOptions={audienceOptions}
      onOpen={setEditingId}
      onCancel={cancelBroadcast}
      onCreate={createBroadcast}
      onDuplicate={duplicateBroadcast}
      hasMore={hasMore}
      onLoadMore={loadMore}
      loadingMore={loadingMore}
    />
  )
}
