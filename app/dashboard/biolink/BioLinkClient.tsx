'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'
import type { RawBiolink, BioAnalytics } from './page'
import QRCode from 'qrcode'
import {
  ExternalLink, Save, Rocket, Copy, Check, Eye,
  Signal, Wifi, BatteryFull,
  Bot, ShoppingBag, Link2, AtSign, Play, Music,
  MessageCircle, Briefcase, Globe, Camera, Calendar,
  ArrowUpRight, Trash2,
  MousePointerClick, Target, Square, Paintbrush, Grip, Plus,
  Loader2, Upload, X, AlertCircle, CheckCircle2,
  QrCode, GripVertical, Download,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

interface LinkItem {
  id: string; type: string; label: string; url: string
  icon: string; highlight: boolean
}

interface BioPage {
  id: string         // empty string = not yet saved to DB
  slug: string
  name: string
  bio: string
  avatar: string
  avatarColor: string
  themeId: string
  background: 'solid' | 'gradient' | 'dots'
  buttonStyle: 'rounded' | 'sharp' | 'pill'
  links: LinkItem[]
  views: number
  clicks: number
  status: 'published' | 'draft'
}

interface ThemePreset {
  id: string; label: string; primary: string
  bg: string; surface: string; text: string; muted: string
}

interface BioLinkClientProps {
  userId: string
  initialBiolink: RawBiolink | null
  initialAnalytics: BioAnalytics
  appUrl: string
}

/* ============================================================
   Constants
   ============================================================ */

const linkTypes: Record<string, { label: string; iconName: string; color: string }> = {
  bot:     { label: 'Bot do Telegram', iconName: 'bot',          color: 'var(--primary)' },
  product: { label: 'Produto',         iconName: 'shopping-bag', color: '#22c55e' },
  custom:  { label: 'Link externo',    iconName: 'link',         color: 'oklch(0.58 0.05 280)' },
  social:  { label: 'Rede social',     iconName: 'at-sign',      color: 'oklch(0.62 0.18 320)' },
  video:   { label: 'Vídeo / YouTube', iconName: 'play',         color: '#ef4444' },
}

const SOCIAL_PRESETS = [
  { id: 'instagram', label: 'Instagram', icon: 'instagram', color: '#E1306C' },
  { id: 'tiktok',    label: 'TikTok',    icon: 'music',     color: '#010101' },
  { id: 'youtube',   label: 'YouTube',   icon: 'youtube',   color: '#FF0000' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: 'at-sign',   color: '#25D366' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: 'linkedin',  color: '#0A66C2' },
  { id: 'twitter',   label: 'Twitter',   icon: 'twitter',   color: '#1DA1F2' },
] as const

const themePresets: ThemePreset[] = [
  { id: 'violet', label: 'Violeta',    primary: '#7c3aed', bg: '#0b0a14', surface: '#171428', text: '#f5f3ff', muted: '#a7a3c7' },
  { id: 'mint',   label: 'Menta',      primary: '#10b981', bg: '#06140e', surface: '#0e2017', text: '#ecfdf5', muted: '#86efac' },
  { id: 'sunset', label: 'Pôr-do-sol', primary: '#f97316', bg: '#1a0d05', surface: '#2a1610', text: '#fff7ed', muted: '#fdba74' },
  { id: 'ocean',  label: 'Oceano',     primary: '#0ea5e9', bg: '#04111d', surface: '#0a1f2e', text: '#f0f9ff', muted: '#7dd3fc' },
  { id: 'rose',   label: 'Rosé',       primary: '#ec4899', bg: '#1a060f', surface: '#2a0e1c', text: '#fff0f6', muted: '#f9a8d4' },
  { id: 'mono',   label: 'Mono',       primary: '#f5f5f5', bg: '#0a0a0a', surface: '#171717', text: '#fafafa', muted: '#a3a3a3' },
  { id: 'cream',  label: 'Creme',      primary: '#7c3aed', bg: '#f9f5ee', surface: '#ffffff', text: '#1a1a1a', muted: '#737373' },
  { id: 'forest', label: 'Floresta',   primary: '#16a34a', bg: '#040e08', surface: '#081a0e', text: '#f0fdf4', muted: '#4ade80' },
]

/* ============================================================
   Helpers
   ============================================================ */

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtPct = (n: number, d = 0) => n.toFixed(d).replace('.', ',') + '%'

function mapRaw(row: RawBiolink): BioPage {
  return {
    id:          row.id,
    slug:        row.slug,
    name:        row.name,
    bio:         row.bio,
    avatar:      row.avatar,
    avatarColor: row.avatar_color,
    themeId:     row.theme_id,
    background:  row.background as BioPage['background'],
    buttonStyle: row.button_style as BioPage['buttonStyle'],
    links:       (row.links as LinkItem[]) ?? [],
    views:       row.views ?? 0,
    clicks:      row.clicks ?? 0,
    status:      row.status,
  }
}

function buildDefault(): BioPage {
  return {
    id: '', slug: '', name: '', bio: '',
    avatar: '', avatarColor: '#7c3aed',
    themeId: 'violet', background: 'solid', buttonStyle: 'rounded',
    links: [], views: 0, clicks: 0, status: 'draft',
  }
}

const ICON_MAP: Record<string, React.ElementType> = {
  bot: Bot, 'shopping-bag': ShoppingBag, link: Link2, 'at-sign': AtSign,
  play: Play, instagram: Camera, youtube: Play, music: Music,
  twitter: MessageCircle, linkedin: Briefcase, facebook: Globe, calendar: Calendar,
  'arrow-up-right': ArrowUpRight,
}

function DynIcon({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const Ic = ICON_MAP[name] ?? Link2
  return <Ic size={size} className={className} />
}

/* ============================================================
   Micro components
   ============================================================ */

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    muted:   'bg-[var(--surface-2)] text-[var(--text-muted)]',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium ${cls[tone] ?? cls.muted}`}>
      {children}
    </span>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch" aria-checked={checked} onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

const inputB    = 'w-full h-10 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50'
const textareaB = 'w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 resize-none leading-relaxed'

function FieldB({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">{hint}</div>}
    </div>
  )
}

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[13.5px] font-semibold text-[var(--text)]">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/* ============================================================
   Add Link Dropdown
   ============================================================ */

function AddLinkDropdown({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <Plus size={13} />Adicionar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden min-w-[190px]">
            {Object.entries(linkTypes).map(([key, lt]) => (
              <button key={key}
                onClick={() => { onAdd(key); setOpen(false) }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="w-6 h-6 rounded flex items-center justify-center text-white shrink-0" style={{ background: lt.color }}>
                  <DynIcon name={lt.iconName} size={12} />
                </span>
                <span className="text-[var(--text)]">{lt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ============================================================
   Quick Social Row
   ============================================================ */

function QuickSocialRow({ onAddSocial }: { onAddSocial: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1 pb-2 border-b border-[var(--border)] mb-2">
      <span className="text-[10.5px] text-[var(--text-muted)] self-center mr-1 font-medium uppercase tracking-wide">Redes:</span>
      {SOCIAL_PRESETS.map((s) => (
        <button key={s.id}
          onClick={() => onAddSocial(s.id)}
          title={`Adicionar ${s.label}`}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11.5px] font-medium text-white transition-opacity hover:opacity-85 active:scale-95"
          style={{ background: s.color }}
        >
          <DynIcon name={s.icon} size={11} />
          {s.label}
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   Phone Preview
   ============================================================ */

function PhonePreview({ page, theme, publicUrl }: { page: BioPage; theme: ThemePreset; publicUrl: string | null }) {
  const t = theme
  const buttonRadius = page.buttonStyle === 'rounded' ? '12px' : page.buttonStyle === 'pill' ? '999px' : '4px'
  const inner = (
    <div
      className="mx-auto rounded-[44px] border-4 overflow-hidden relative"
      style={{ width: 320, height: 640, background: t.bg, borderColor: 'rgba(128,128,128,0.3)', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full z-10" style={{ width: 110, height: 26, background: '#000' }} />
      <div className="px-6 pt-3 pb-1 flex items-center justify-between text-[10px] font-semibold relative z-20" style={{ color: t.text }}>
        <span>15:30</span>
        <span className="inline-flex items-center gap-1">
          <Signal size={9} /><Wifi size={9} /><BatteryFull size={11} />
        </span>
      </div>
      {page.background === 'gradient' && (
        <div className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: `radial-gradient(circle at 20% 0%, ${t.primary}44, transparent 50%), radial-gradient(circle at 80% 100%, ${t.primary}33, transparent 40%)` }} />
      )}
      {page.background === 'dots' && (
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{ backgroundImage: `radial-gradient(circle, ${t.muted}40 1px, transparent 1.5px)`, backgroundSize: '20px 20px' }} />
      )}
      <div className="relative z-10 px-5 pt-8 pb-6 h-full overflow-y-auto" style={{ color: t.text }}>
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-[28px]"
            style={{ background: page.avatarColor, color: '#fff', border: `3px solid ${t.surface}` }}>
            {page.avatar?.startsWith('http')
              ? <img src={page.avatar} alt="" className="w-full h-full object-cover rounded-full" />
              : (page.avatar || '?')
            }
          </div>
          <div className="text-[15px] font-bold tracking-tight mt-3" style={{ color: t.text }}>
            {page.name || 'Seu nome'}
          </div>
          <code className="text-[10px] font-mono mt-0.5" style={{ color: t.muted }}>
            umbra.bot/{page.slug || 'seu-slug'}
          </code>
          <p className="text-[11.5px] mt-2.5 text-center leading-snug px-2" style={{ color: t.muted }}>
            {page.bio || 'Sua descrição aparece aqui…'}
          </p>
        </div>
        <div className="mt-5 space-y-2.5">
          {page.links.length === 0 && (
            <div className="text-center text-[11px] py-6 italic" style={{ color: t.muted }}>Nenhum link adicionado.</div>
          )}
          {page.links.map((l) => (
            <div key={l.id} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-semibold"
              style={{
                background: l.highlight ? t.primary : t.surface,
                color: l.highlight ? '#fff' : t.text,
                borderRadius: buttonRadius,
                border: l.highlight ? 'none' : `1px solid ${t.primary}33`,
              }}
            >
              <span className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${l.highlight ? 'bg-white/20' : ''}`}>
                <DynIcon name={l.icon} size={12} />
              </span>
              <span className="flex-1 truncate">{l.label}</span>
              <ArrowUpRight size={11} style={{ opacity: 0.5 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-white/40 z-20" />
    </div>
  )

  if (publicUrl) {
    return (
      <a href={publicUrl} target="_blank" rel="noopener noreferrer" title="Abrir página pública" className="block group relative">
        {inner}
        <div className="absolute inset-0 rounded-[44px] bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white text-[11px] font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <ExternalLink size={11} />Abrir página
          </span>
        </div>
      </a>
    )
  }
  return inner
}

/* ============================================================
   Link Item Row — drag-and-drop
   ============================================================ */

function LinkItemRow({ link, index, total, onUpdate, onDelete, isDragOver, onDragStart, onDragEnd, onDragEnter, onDragOver: handleDragOver, onDrop }: {
  link: LinkItem; index: number; total: number
  onUpdate: (l: LinkItem) => void; onDelete: (id: string) => void
  isDragOver: boolean
  onDragStart: () => void; onDragEnd: () => void
  onDragEnter: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void
}) {
  const lt = linkTypes[link.type] ?? linkTypes.custom
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragOver={handleDragOver}
      onDrop={onDrop}
      className={`bg-[var(--surface)] border rounded-lg p-3 transition-colors select-none ${isDragOver ? 'border-[var(--primary)] bg-[var(--primary)]/5 scale-[1.01]' : 'border-[var(--border)] hover:border-[var(--text-muted)]/40'}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="pt-2 cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text)] shrink-0" title="Arrastar para reordenar">
          <GripVertical size={15} />
        </div>
        <div className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: lt.color }}>
          <DynIcon name={link.icon} size={14} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <input type="text" value={link.label}
            onChange={(e) => onUpdate({ ...link, label: e.target.value })}
            placeholder="Rótulo do link"
            className="w-full h-8 px-2.5 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-md text-[12.5px] font-medium text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
          />
          <div className="flex items-center gap-1.5">
            <select value={link.type}
              onChange={(e) => {
                const t2 = linkTypes[e.target.value]
                if (t2) onUpdate({ ...link, type: e.target.value, icon: t2.iconName })
              }}
              className="h-8 px-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[11.5px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 shrink-0"
            >
              {Object.entries(linkTypes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="text" value={link.url}
              onChange={(e) => onUpdate({ ...link, url: e.target.value })}
              placeholder="https://…"
              className="flex-1 h-8 px-2.5 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-md text-[11.5px] font-mono text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Toggle checked={!!link.highlight} onChange={() => onUpdate({ ...link, highlight: !link.highlight })} />
              <span className="text-[11px] text-[var(--text-muted)]">Destacar</span>
            </label>
          </div>
        </div>
        <button onClick={() => onDelete(link.id)}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors focus:outline-none">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   QR Code Modal
   ============================================================ */

function QRCodeModal({ url, slug, onClose }: { url: string; slug: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(console.error)
  }, [url])

  function handleDownload() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${slug}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">QR Code da página</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"><X size={16} /></button>
        </div>
        <div className="bg-white rounded-xl p-3 mx-auto w-fit mb-4">
          {dataUrl
            ? <img src={dataUrl} alt="QR Code" width={240} height={240} />
            : <div className="w-60 h-60 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
          }
        </div>
        <p className="text-[11.5px] text-[var(--text-muted)] text-center mb-4 font-mono break-all">{url}</p>
        <button
          onClick={handleDownload} disabled={!dataUrl}
          className="w-full h-10 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Download size={15} />Baixar QR Code
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   Toast
   ============================================================ */

interface ToastState { msg: string; type: 'success' | 'error' }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-[13px] font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {toast.msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

/* ============================================================
   Stat strip helper
   ============================================================ */

function Stat({ label, value, icon: Icon_, tone }: { label: string; value: string; icon: React.ElementType; tone?: string }) {
  return (
    <div className="hidden md:block">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] inline-flex items-center gap-1">
        <Icon_ size={10} />{label}
      </div>
      <div className={`text-[14px] font-semibold tracking-tight leading-none mt-0.5 ${tone === 'success' ? 'text-green-500' : 'text-[var(--text)]'}`}>{value}</div>
    </div>
  )
}

/* ============================================================
   Discard confirm modal
   ============================================================ */

function DiscardModal({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-[15px] font-semibold text-[var(--text)] mb-1">Descartar alterações?</h3>
        <p className="text-[13px] text-[var(--text-muted)] mb-5">Você tem alterações não salvas. Deseja descartá-las?</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onKeep} className="h-9 px-4 rounded-lg text-[13px] font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors">
            Continuar editando
          </button>
          <button onClick={onDiscard} className="h-9 px-4 rounded-lg text-[13px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">
            Descartar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Avatar upload
   ============================================================ */

function AvatarUpload({ avatarUrl, initials, color, onFileSelect, uploading }: {
  avatarUrl: string | null; initials: string; color: string
  onFileSelect: (file: File) => void; uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-[22px] shrink-0 overflow-hidden"
        style={{ background: color, color: '#fff' }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : (initials || '?')
        }
      </div>
      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {uploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Upload size={16} className="text-white" />}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = '' }} />
    </div>
  )
}

/* ============================================================
   Main BioLinkClient
   ============================================================ */

export function BioLinkClient({ userId, initialBiolink, initialAnalytics, appUrl }: BioLinkClientProps) {
  const router = useRouter()
  const { track } = useAnalytics()

  const [page, setPage]         = useState<BioPage>(() => initialBiolink ? mapRaw(initialBiolink) : buildDefault())
  const [snapshot, setSnapshot] = useState<BioPage>(() => initialBiolink ? mapRaw(initialBiolink) : buildDefault())
  const [analytics, setAnalytics] = useState<BioAnalytics>(initialAnalytics)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saved, setSaved]       = useState(false)
  const [copied, setCopied]     = useState(false)
  const [qrOpen, setQrOpen]     = useState(false)
  const [toast, setToast]       = useState<ToastState | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)

  // Drag-and-drop state
  const [dragId, setDragId]         = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const pageRef     = useRef(page)
  pageRef.current   = page
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountedRef  = useRef(false)

  // dirty check
  const dirty = useMemo(() => JSON.stringify(page) !== JSON.stringify(snapshot), [page, snapshot])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function set(patch: Partial<BioPage>) {
    setPage((p) => ({ ...p, ...patch }))
  }

  // Auto-save 30s — skip first render (mountedRef) and skip when nothing changed (!dirty)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (!page.id || !dirty) return
    clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      if (!pageRef.current.id || !pageRef.current.slug.trim()) return
      saveImpl(pageRef.current, false)
    }, 30_000)
    return () => clearTimeout(autoSaveRef.current)
  }, [page, dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveImpl(toSave: BioPage, showFeedback = true) {
    if (!toSave.slug.trim()) {
      if (showFeedback) showToast('Defina um slug para a URL da sua página.', 'error')
      return false
    }
    if (saving) return false
    setSaving(true)
    try {
      const sb = createClient()
      if (!toSave.id) {
        const newId = crypto.randomUUID()
        const { error } = await sb.from('biolinks').insert({
          id: newId,
          user_id: userId,
          slug: toSave.slug,
          name: toSave.name,
          bio: toSave.bio,
          avatar: toSave.avatar,
          avatar_color: toSave.avatarColor,
          theme_id: toSave.themeId,
          background: toSave.background,
          button_style: toSave.buttonStyle,
          links: toSave.links,
          status: toSave.status,
        })
        if (error) throw error
        const withId = { ...toSave, id: newId }
        setPage(withId)
        setSnapshot(withId)
        track('biolink_created', {})
      } else {
        const { error } = await sb.from('biolinks').update({
          slug: toSave.slug,
          name: toSave.name,
          bio: toSave.bio,
          avatar: toSave.avatar,
          avatar_color: toSave.avatarColor,
          theme_id: toSave.themeId,
          background: toSave.background,
          button_style: toSave.buttonStyle,
          links: toSave.links,
          status: toSave.status,
          updated_at: new Date().toISOString(),
        }).eq('id', toSave.id).eq('user_id', userId)
        if (error) throw error
        setSnapshot({ ...toSave })
        track('biolink_saved', {})
      }
      if (showFeedback) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2200)
      }
      return true
    } catch {
      if (showFeedback) showToast('Erro ao salvar. Tente novamente.', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    await saveImpl(page, true)
  }

  async function handlePublish() {
    if (!page.slug.trim()) {
      showToast('Defina um slug antes de publicar.', 'error')
      return
    }
    setPublishing(true)
    const newStatus: BioPage['status'] = page.status === 'published' ? 'draft' : 'published'
    const updated = { ...page, status: newStatus }
    const ok = await saveImpl(updated, false)
    setPublishing(false)
    if (ok) {
      setPage(updated)
      if (newStatus === 'published') {
        showToast('Página publicada! ✓')
        track('biolink_published', { slug: page.slug })
      } else {
        showToast('Página despublicada.')
      }
    } else {
      showToast('Erro ao alterar status.', 'error')
    }
  }

  function updateLink(updated: LinkItem) {
    setPage((p) => ({ ...p, links: p.links.map((l) => (l.id === updated.id ? updated : l)) }))
  }

  function deleteLink(id: string) {
    setPage((p) => ({ ...p, links: p.links.filter((l) => l.id !== id) }))
  }

  // Drag-and-drop reorder
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    setPage((p) => {
      const from = p.links.findIndex((l) => l.id === dragId)
      const to   = p.links.findIndex((l) => l.id === targetId)
      if (from < 0 || to < 0) return p
      const next = [...p.links]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { ...p, links: next }
    })
    setDragId(null)
    setDragOverId(null)
  }

  function addLink(type: string) {
    const lt = linkTypes[type]
    if (!lt) return
    const newLink: LinkItem = {
      id: crypto.randomUUID(),
      type,
      label: `Novo ${lt.label.toLowerCase()}`,
      url: '',
      icon: lt.iconName,
      highlight: false,
    }
    setPage((p) => ({ ...p, links: [...p.links, newLink] }))
    track('biolink_link_added', { type })
  }

  function addSocialLink(socialId: string) {
    const preset = SOCIAL_PRESETS.find((s) => s.id === socialId)
    if (!preset) return
    const newLink: LinkItem = {
      id: crypto.randomUUID(),
      type: 'social',
      label: preset.label,
      url: '',
      icon: preset.icon,
      highlight: false,
    }
    setPage((p) => ({ ...p, links: [...p.links, newLink] }))
    track('biolink_link_added', { type: `social:${socialId}` })
  }

  function copyUrl() {
    const url = `${appUrl}/b/${page.slug}`
    try { navigator.clipboard?.writeText(url) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleAvatarUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      showToast('Imagem deve ter no máximo 2 MB.', 'error')
      return
    }
    setAvatarUploading(true)
    try {
      const sb = createClient()
      if (!page.id) {
        const url = URL.createObjectURL(file)
        setAvatarUrl(url)
        return
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${userId}/${page.id}.${ext}`
      const { error: upErr } = await sb.storage.from('bio-avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = sb.storage.from('bio-avatars').getPublicUrl(path)
      setAvatarUrl(publicUrl)
      setPage((p) => ({ ...p, avatar: publicUrl }))
    } catch {
      showToast('Erro ao enviar imagem.', 'error')
    } finally {
      setAvatarUploading(false)
    }
  }

  const theme = themePresets.find((t) => t.id === page.themeId) ?? themePresets[0]

  const clicksByLink = useMemo(() => analytics.clicks_by_link ?? {}, [analytics.clicks_by_link])
  const sortedByClicks = useMemo(() => {
    const withClicks = page.links.map((l) => ({ ...l, clicks: clicksByLink[l.id] ?? 0 }))
    return [...withClicks].sort((a, b) => b.clicks - a.clicks)
  }, [page.links, clicksByLink])
  const totalLinkClicks = useMemo(
    () => Object.values(clicksByLink).reduce((s, v) => s + (v ?? 0), 0),
    [clicksByLink],
  )

  const publicUrl = `${appUrl}/b/${page.slug}`
  const isPublished = page.status === 'published'
  const conversion = analytics.views_period > 0
    ? (analytics.clicks_period / analytics.views_period) * 100
    : 0

  return (
    <>
      <PageHeader
        title="Bio Link"
        subtitle="Sua página única de links — substitui o link na bio do Instagram/TikTok."
        actions={
          <div className="flex items-center gap-2">
            {page.slug && (
              <a
                href={publicUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <ExternalLink size={14} />Abrir página
              </a>
            )}
            {dirty && (
              <button
                onClick={() => setDiscardOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              >
                Descartar
              </button>
            )}
            <button
              onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-green-500" /> : <Save size={14} />}
              {saving ? 'Salvando…' : saved ? 'Salvo' : 'Salvar'}
            </button>
            <button
              onClick={handlePublish} disabled={publishing}
              className={`inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg transition-opacity ${isPublished ? 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]' : 'bg-[var(--primary)] text-white hover:opacity-90'}`}
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {isPublished ? 'Despublicar' : 'Publicar'}
            </button>
          </div>
        }
      />

      {/* URL bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-5">
        {page.name && (
          <p className="text-[14px] font-semibold text-[var(--text)] mb-3 leading-none">{page.name}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-0 flex-1 min-w-[260px] max-w-md bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg overflow-hidden">
            <span className="pl-3 text-[10.5px] font-mono text-[var(--text-muted)] shrink-0">{appUrl}/b/</span>
            <input
              type="text" value={page.slug}
              onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })}
              placeholder="seu-slug"
              className="flex-1 h-9 pr-3 bg-transparent text-[13px] font-mono text-[var(--text)] focus:outline-none"
            />
          </div>
          <button onClick={copyUrl} disabled={!page.slug}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40">
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button onClick={() => setQrOpen(true)} disabled={!page.slug}
            title="Gerar QR Code"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40">
            <QrCode size={13} />QR Code
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <Stat label="Visitas (30d)"  value={fmtNum(analytics.views_period)}  icon={Eye} />
            <Stat label="Cliques (30d)"  value={fmtNum(analytics.clicks_period)} icon={MousePointerClick} />
            <Stat label="Conv. cliques"  value={fmtPct(conversion, 1)} icon={Target} tone="success" />
          </div>
        </div>
      </div>

      {/* Slug warning for new pages */}
      {!page.id && (
        <div className="mb-5 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-[var(--primary)] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[var(--text-muted)]">
            Preencha o perfil, adicione links e clique em <strong className="text-[var(--text)]">Salvar</strong> para criar sua página. Depois publique para torná-la pública.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        {/* Editor column */}
        <div className="space-y-4 min-w-0">
          {/* Perfil */}
          <SectionCard title="Perfil" subtitle="Avatar, nome e descrição que aparecem no topo">
            <div className="space-y-3.5">
              <div className="flex items-center gap-4">
                <AvatarUpload
                  avatarUrl={avatarUrl || (page.avatar?.startsWith('http') ? page.avatar : null)}
                  initials={page.avatar?.startsWith('http') ? '' : page.avatar}
                  color={page.avatarColor}
                  onFileSelect={handleAvatarUpload}
                  uploading={avatarUploading}
                />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <FieldB label="Iniciais do avatar">
                    <input type="text" value={page.avatar?.startsWith('http') ? '' : page.avatar} maxLength={3}
                      onChange={(e) => { setAvatarUrl(null); set({ avatar: e.target.value.toUpperCase().slice(0, 3) }) }}
                      placeholder="AS" className={inputB} />
                  </FieldB>
                  <FieldB label="Cor do avatar">
                    <div className="flex items-center gap-1.5 h-10 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2">
                      <span className="w-6 h-6 rounded border border-[var(--border)]" style={{ background: page.avatarColor }} />
                      <input type="text" value={page.avatarColor}
                        onChange={(e) => set({ avatarColor: e.target.value })}
                        className="flex-1 bg-transparent text-[12px] font-mono text-[var(--text)] focus:outline-none" />
                    </div>
                  </FieldB>
                </div>
              </div>
              <FieldB label="Nome de exibição">
                <input type="text" value={page.name} onChange={(e) => set({ name: e.target.value })}
                  placeholder="Seu nome" className={inputB} />
              </FieldB>
              <FieldB label="Descrição (bio)" hint="Curta, com no máximo ~140 caracteres.">
                <textarea value={page.bio} onChange={(e) => set({ bio: e.target.value })}
                  rows={2} maxLength={160} placeholder="Quem você é e o que oferece…" className={textareaB} />
                <div className="text-[10.5px] text-[var(--text-muted)] text-right mt-1">{page.bio.length}/160</div>
              </FieldB>
            </div>
          </SectionCard>

          {/* Links */}
          <SectionCard
            title="Links"
            subtitle={`${page.links.length} link${page.links.length !== 1 ? 's' : ''} · arraste para reordenar`}
            action={<AddLinkDropdown onAdd={addLink} />}
          >
            <QuickSocialRow onAddSocial={addSocialLink} />
            <div className="space-y-2">
              {page.links.length === 0 && (
                <div className="bg-[var(--surface-2)]/30 border border-dashed border-[var(--border)] rounded-lg p-8 text-center">
                  <Link2 size={20} className="text-[var(--text-muted)] mx-auto mb-2" />
                  <div className="text-[13px] font-semibold text-[var(--text)]">Adicione seu primeiro link</div>
                  <div className="text-[11.5px] text-[var(--text-muted)] mt-1">Use os atalhos de rede social acima ou "Adicionar".</div>
                </div>
              )}
              {page.links.map((l) => (
                <LinkItemRow
                  key={l.id} link={l} index={0} total={page.links.length}
                  onUpdate={updateLink} onDelete={deleteLink}
                  isDragOver={dragOverId === l.id}
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                  onDragEnter={() => setDragOverId(l.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(l.id)}
                />
              ))}
            </div>
          </SectionCard>

          {/* Tema */}
          <SectionCard title="Tema da página" subtitle="Cores, fundo e estilo dos botões">
            <div className="space-y-3.5">
              <FieldB label="Paleta">
                <div className="grid grid-cols-4 gap-2">
                  {themePresets.map((t) => {
                    const active = page.themeId === t.id
                    return (
                      <button key={t.id} onClick={() => { set({ themeId: t.id }); track('biolink_theme_changed', { theme: t.id }) }}
                        className={`p-2.5 rounded-lg border-2 focus:outline-none transition-colors ${active ? 'border-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--text-muted)]/40'}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-5 h-5 rounded border border-[var(--border)]" style={{ background: t.bg }} />
                          <span className="w-5 h-5 rounded border border-[var(--border)]" style={{ background: t.surface }} />
                          <span className="w-5 h-5 rounded" style={{ background: t.primary }} />
                        </div>
                        <div className="text-[11px] font-medium text-[var(--text)] text-left">{t.label}</div>
                      </button>
                    )
                  })}
                </div>
              </FieldB>

              <FieldB label="Fundo">
                <div className="grid grid-cols-3 gap-2 max-w-[420px]">
                  {[
                    { id: 'solid',    label: 'Sólido',     icon: Square },
                    { id: 'gradient', label: 'Gradiente',  icon: Paintbrush },
                    { id: 'dots',     label: 'Pontilhado', icon: Grip },
                  ].map((b) => {
                    const active = page.background === b.id
                    return (
                      <button key={b.id} onClick={() => set({ background: b.id as BioPage['background'] })}
                        className={`h-9 rounded-md text-[12px] font-medium border-2 inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
                        <b.icon size={12} />{b.label}
                      </button>
                    )
                  })}
                </div>
              </FieldB>

              <FieldB label="Estilo dos botões">
                <div className="grid grid-cols-3 gap-2 max-w-[420px]">
                  {[
                    { id: 'rounded', label: 'Arredondado', cls: 'rounded-md' },
                    { id: 'sharp',   label: 'Reto',         cls: 'rounded-none' },
                    { id: 'pill',    label: 'Pill',          cls: 'rounded-full' },
                  ].map((b) => {
                    const active = page.buttonStyle === b.id
                    return (
                      <button key={b.id} onClick={() => set({ buttonStyle: b.id as BioPage['buttonStyle'] })}
                        className={`h-9 text-[12px] font-medium border-2 transition-colors focus:outline-none ${b.cls} ${active ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
                        {b.label}
                      </button>
                    )
                  })}
                </div>
              </FieldB>
            </div>
          </SectionCard>

          {/* Cliques por link */}
          {page.links.length > 0 && (
            <SectionCard title="Cliques por link" subtitle="Performance dos últimos 30 dias">
              {sortedByClicks.every((l) => l.clicks === 0) ? (
                <div className="text-[12.5px] text-[var(--text-muted)] py-3 text-center">
                  Nenhum clique registrado ainda. Publique a página e compartilhe o link!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortedByClicks.map((l) => {
                    const maxClicks = sortedByClicks[0]?.clicks || 1
                    const pct = totalLinkClicks > 0 ? (l.clicks / totalLinkClicks) * 100 : 0
                    const barPct = (l.clicks / maxClicks) * 100
                    return (
                      <div key={l.id}>
                        <div className="flex items-baseline justify-between text-[12px] mb-1">
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <DynIcon name={l.icon} size={11} className="text-[var(--text-muted)] shrink-0" />
                            <span className="text-[var(--text)] truncate font-medium">{l.label}</span>
                            {l.highlight && <Badge tone="primary">Destaque</Badge>}
                          </span>
                          <span className="text-[var(--text-muted)] shrink-0 ml-2">
                            <span className="text-[var(--text)] font-semibold">{fmtNum(l.clicks)}</span> · {fmtPct(pct, 1)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>
          )}
        </div>

        {/* Preview column */}
        <div className="xl:sticky xl:top-[80px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye size={13} className="text-[var(--text-muted)]" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Prévia mobile</span>
            </div>
            <Badge tone={isPublished ? 'success' : 'muted'}>
              {isPublished && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              {isPublished ? 'Publicado' : 'Rascunho'}
            </Badge>
          </div>
          <PhonePreview
            page={page}
            theme={theme}
            publicUrl={isPublished && page.slug ? publicUrl : null}
          />
          {page.slug && (
            <div className="mt-3 text-center text-[10.5px] text-[var(--text-muted)]">
              {isPublished
                ? <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1">{appUrl}/b/{page.slug} <ExternalLink size={9} /></a>
                : <span>{appUrl}/b/{page.slug}</span>
              }
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {discardOpen && (
        <DiscardModal
          onKeep={() => setDiscardOpen(false)}
          onDiscard={() => { setPage(snapshot); setDiscardOpen(false) }}
        />
      )}

      {qrOpen && page.slug && (
        <QRCodeModal
          url={publicUrl}
          slug={page.slug}
          onClose={() => setQrOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  )
}
