'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Check, X, ChevronDown, AlertCircle } from 'lucide-react'

// ─── Badge ─────────────────────────────────────────────────────────────────────

export const BADGE_TONES: Record<string, string> = {
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}

export function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.muted}`}>
      {children}
    </span>
  )
}

// ─── Btn ───────────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '', type = 'button' }: {
  children: React.ReactNode
  variant?: BtnVariant
  size?: 'sm' | 'md'
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
    danger:    'bg-danger-soft text-danger border border-danger/20 hover:bg-danger hover:text-white',
  }[variant]
  return (
    <button type={type} className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

// ─── Dropdown ──────────────────────────────────────────────────────────────────

export function Dropdown({ label, value, options, onChange }: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="h-9 px-3 inline-flex items-center gap-1.5 bg-surface border border-border rounded-lg text-[12.5px] text-text hover:bg-surface-2"
      >
        <span className="truncate max-w-[120px]">{value || label}</span>
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 top-full left-0 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
          {options.map(o => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-surface-2 flex items-center gap-2 ${o === value ? 'text-primary font-medium' : 'text-text'}`}
            >
              {o === value && <Check size={12} />}
              <span className={o !== value ? 'pl-5' : ''}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
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
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            {title && <div className="text-[15px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text shrink-0">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

export function Toast({ msg, type, onClose }: {
  msg: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-[13px] font-medium animate-in slide-in-from-bottom-2 ${type === 'success' ? 'bg-success-soft text-success border-success/20' : 'bg-danger-soft text-danger border-danger/20'}`}>
      {type === 'error' ? <AlertCircle size={15} /> : <Check size={15} />}
      {msg}
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100">
        <X size={13} />
      </button>
    </div>
  )
}
