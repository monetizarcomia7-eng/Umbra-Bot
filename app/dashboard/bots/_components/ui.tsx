'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bot, X, Copy, Check, ChevronDown } from 'lucide-react'
import { BotData, STATUS_CONFIG } from './types'

// ─── UI Primitives ─────────────────────────────────────────────────────────────

export function Card({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl">
      {title && (
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[14px] font-semibold text-text">{title}</div>
          {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '', type = 'button' }: {
  children: React.ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; onClick?: () => void
  disabled?: boolean; className?: string; type?: 'button' | 'submit'
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz   = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger hover:bg-danger/20',
  }[variant]
  return <button type={type} className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}
export function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>{children}</span>
}

export function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <span className="truncate max-w-[160px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
          {options.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}>
              {o === value && <Check size={12} />}
              <span className={o !== value ? 'pl-5' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
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
            <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text shrink-0">
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

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; Icon: React.ElementType }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-0.5 border-b border-border">
      {tabs.map(t => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none border-b-2 -mb-px ${
            active === t.id ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text hover:border-border'
          }`}>
          <t.Icon size={14} />{t.label}
        </button>
      ))}
    </div>
  )
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function doCopy() {
    try { navigator.clipboard?.writeText(text) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button type="button" onClick={doCopy} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text" title="Copiar">
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  )
}

export function ReadOnlyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">{label}</div>
      <div className={`text-[12.5px] text-text mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

export function BotAvatar({ bot, size = 48 }: { bot: BotData; size?: number }) {
  const st = STATUS_CONFIG[bot.status] ?? STATUS_CONFIG.offline
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

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[14px] font-semibold text-text leading-none tracking-tight truncate">{value}</div>
      <div className="text-[10.5px] text-text-muted mt-1 leading-tight">{label}</div>
    </div>
  )
}

export function SummaryChip({ dot, label, count, pulse }: { dot: string; label: string; count: number; pulse?: boolean }) {
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
