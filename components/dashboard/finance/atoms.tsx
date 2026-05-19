'use client'

import React, { useMemo } from 'react'
import {
  Download, ArrowUpFromLine, Wallet, Clock, TrendingUp, Percent,
  ShoppingBag, UserPlus, Undo2, ArrowUpRight, ArrowDownRight,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Search, Calendar, Tag, CircleCheck, Inbox, X,
  Zap, Landmark, Info, AlertTriangle, AlertCircle, Check,
  ArrowRight, ArrowLeft, CreditCard, FileText, ArrowLeftRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneClasses } from './constants'
import { fmtBRLdec, fmtPct } from './formatters'

/* ── Icon map ─────────────────────────────────────────────────────────── */

export const iconMap: Record<string, LucideIcon> = {
  'download':           Download,
  'arrow-up-from-line': ArrowUpFromLine,
  'wallet':             Wallet,
  'clock':              Clock,
  'trending-up':        TrendingUp,
  'percent':            Percent,
  'shopping-bag':       ShoppingBag,
  'user-plus':          UserPlus,
  'undo-2':             Undo2,
  'arrow-up-right':     ArrowUpRight,
  'arrow-down-right':   ArrowDownRight,
  'chevron-up':         ChevronUp,
  'chevron-down':       ChevronDown,
  'chevron-left':       ChevronLeft,
  'chevron-right':      ChevronRight,
  'search':             Search,
  'calendar':           Calendar,
  'tag':                Tag,
  'circle-check':       CircleCheck,
  'inbox':              Inbox,
  'x':                  X,
  'zap':                Zap,
  'landmark':           Landmark,
  'info':               Info,
  'alert-triangle':     AlertTriangle,
  'alert-circle':       AlertCircle,
  'check':              Check,
  'arrow-right':        ArrowRight,
  'arrow-left':         ArrowLeft,
  'credit-card':        CreditCard,
  'file-text':          FileText,
  'arrow-left-right':   ArrowLeftRight,
}

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Comp = iconMap[name]
  if (!Comp) return null
  return <Comp size={size} className={className} />
}

/* ── Badge ────────────────────────────────────────────────────────────── */

export function Badge({ tone = 'muted', icon, children }: { tone?: string; icon?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium', toneClasses[tone] ?? toneClasses.muted)}>
      {icon && <Icon name={icon} size={10} />}
      {children}
    </span>
  )
}

/* ── Card ─────────────────────────────────────────────────────────────── */

export function Card({
  title, subtitle, action, noPadding, children,
}: {
  title?: string; subtitle?: string; action?: React.ReactNode; noPadding?: boolean; children?: React.ReactNode
}) {
  const hasHeader = !!(title || action)
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          {title && (
            <div>
              <div className="text-[14px] font-semibold text-text">{title}</div>
              {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
            </div>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'px-5 pb-5'}>{children}</div>
    </div>
  )
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */

export function Tabs({
  tabs, active, onChange, className,
}: {
  tabs: { id: string; label: string; icon?: string; count?: number }[]
  active: string; onChange: (id: string) => void; className?: string
}) {
  return (
    <div className={cn('flex items-center gap-0.5 border-b border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-t-md -mb-px border-b-2 transition-colors',
            active === tab.id ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text',
          )}
        >
          {tab.icon && <Icon name={tab.icon} size={14} />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-md min-w-[20px] text-center tnum',
              active === tab.id ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Modal ────────────────────────────────────────────────────────────── */

export function Modal({
  open, onClose, title, subtitle, size = 'md', footer, children,
}: {
  open: boolean; onClose: () => void; title?: string | null; subtitle?: string | null
  size?: 'sm' | 'md' | 'lg'; footer?: React.ReactNode; children?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative bg-surface border border-border rounded-xl shadow-xl flex flex-col max-h-[90vh] w-full',
        size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md',
      )}>
        {title && (
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div>
              <h2 className="text-[15px] font-semibold text-text">{title}</h2>
              {subtitle && <p className="text-[12.5px] text-text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border">{footer}</div>
        )}
      </div>
    </div>
  )
}

/* ── Dropdown ─────────────────────────────────────────────────────────── */

export function Dropdown({
  icon, label, value, options, onChange,
}: {
  icon?: string; label: string; value: string; options: string[]
  onChange: (v: string) => void
}) {
  const Ico = icon ? (iconMap[icon] ?? null) : null
  return (
    <div className="relative h-9 min-w-[140px]">
      {Ico && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10">
          <Ico size={13} />
        </span>
      )}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pr-7',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
          Ico ? 'pl-8' : 'pl-3',
        )}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
        <ChevronDown size={12} />
      </span>
    </div>
  )
}

/* ── Btn ──────────────────────────────────────────────────────────────── */

export function Btn({
  variant = 'primary', size = 'md', iconName, children, onClick, disabled, className,
}: {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  iconName?: string
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const Ico = iconName ? (iconMap[iconName] ?? null) : null
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
        variant === 'primary'   ? 'bg-primary text-primary-fg hover:opacity-90' :
        variant === 'secondary' ? 'border border-border bg-surface text-text hover:bg-surface-2' :
                                  'text-text-muted hover:bg-surface-2 hover:text-text',
        className,
      )}
    >
      {Ico && <Ico size={size === 'sm' ? 12 : 14} className="shrink-0" />}
      {children}
    </button>
  )
}

/* ── Spinner ──────────────────────────────────────────────────────────── */

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" className="spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

/* ── Pagination ───────────────────────────────────────────────────────── */

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages])
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn('min-w-[32px] h-8 px-2 text-[12px] font-medium rounded-md tnum', p === page ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-surface-2 hover:text-text')}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

/* ── SummaryCard ──────────────────────────────────────────────────────── */

export function SummaryCard({ label, value, delta, icon, tone, accessory }: {
  label: string; value: number; delta?: number; icon: string; tone?: string; accessory?: React.ReactNode
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted')}>
          <Icon name={icon} size={14} />
        </div>
      </div>
      <div className="text-[24px] font-semibold tnum tracking-tight text-text leading-none">{fmtBRLdec(value)}</div>
      <div className="flex items-center gap-2 mt-2.5">
        {delta !== undefined && (
          <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium text-[11px]', positive ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
            <Icon name={positive ? 'arrow-up-right' : 'arrow-down-right'} size={11} />
            {fmtPct(Math.abs(delta))}
          </span>
        )}
        {accessory}
      </div>
    </div>
  )
}
