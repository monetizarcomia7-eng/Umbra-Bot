'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  ExternalLink, Save, Rocket, Copy, Check, Eye,
  Signal, Wifi, BatteryFull,
  Bot, ShoppingBag, Link2, AtSign, Play, Music,
  MessageCircle, Briefcase, Globe, Camera, Calendar,
  ArrowUpRight, ChevronUp, ChevronDown, Trash2,
  MousePointerClick, Target, Square, Paintbrush, Grip, Plus,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

interface LinkItem {
  id: string; type: string; label: string; url: string
  icon: string; highlight: boolean; clicks: number
}

interface BioPage {
  id: string; slug: string; name: string; bio: string
  avatar: string; avatarColor: string; themeId: string
  background: 'solid' | 'gradient' | 'dots'
  buttonStyle: 'rounded' | 'sharp' | 'pill'
  links: LinkItem[]
  views: number; clicks: number; conversion: number
  topReferrer: string; updatedAt: number; status: 'published' | 'draft'
}

interface ThemePreset {
  id: string; label: string; primary: string
  bg: string; surface: string; text: string; muted: string
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

const themePresets: ThemePreset[] = [
  { id: 'violet', label: 'Violeta',      primary: '#7c3aed', bg: '#0b0a14', surface: '#171428', text: '#f5f3ff', muted: '#a7a3c7' },
  { id: 'mint',   label: 'Menta',        primary: '#10b981', bg: '#06140e', surface: '#0e2017', text: '#ecfdf5', muted: '#86efac' },
  { id: 'sunset', label: 'Pôr-do-sol',   primary: '#f97316', bg: '#1a0d05', surface: '#2a1610', text: '#fff7ed', muted: '#fdba74' },
  { id: 'ocean',  label: 'Oceano',       primary: '#0ea5e9', bg: '#04111d', surface: '#0a1f2e', text: '#f0f9ff', muted: '#7dd3fc' },
  { id: 'rose',   label: 'Rosé',         primary: '#ec4899', bg: '#1a060f', surface: '#2a0e1c', text: '#fff0f6', muted: '#f9a8d4' },
  { id: 'mono',   label: 'Mono',         primary: '#f5f5f5', bg: '#0a0a0a', surface: '#171717', text: '#fafafa', muted: '#a3a3a3' },
  { id: 'cream',  label: 'Creme',        primary: '#7c3aed', bg: '#f9f5ee', surface: '#ffffff', text: '#1a1a1a', muted: '#737373' },
]

const NOW_B = new Date('2026-05-18T15:30:00').getTime()

const MOCK_PAGE: BioPage = {
  id: 'bio_001', slug: 'umbra-vip', name: 'Ana Souza',
  bio: 'Fundadora da Tribo Black · Mentora · Especialista em vendas no Telegram',
  avatar: 'AS', avatarColor: '#7c3aed', themeId: 'violet',
  background: 'solid', buttonStyle: 'rounded',
  links: [
    { id: 'l1', type: 'bot',     label: 'Entrar na Mentoria VIP',   url: 't.me/mentoria_vip_bot',   icon: 'bot',          highlight: true,  clicks: 1284 },
    { id: 'l2', type: 'product', label: 'Comprar Curso 90 dias',    url: 'umbra.bot/c/curso-90',    icon: 'shopping-bag', highlight: false, clicks: 842 },
    { id: 'l3', type: 'video',   label: 'Aula gratuita: 3 técnicas', url: 'youtube.com/@anasouza',  icon: 'play',         highlight: false, clicks: 614 },
    { id: 'l4', type: 'custom',  label: 'Calendário de eventos',    url: 'eventos.tribo.com.br',    icon: 'calendar',     highlight: false, clicks: 188 },
    { id: 'l5', type: 'social',  label: 'Instagram',                url: 'instagram.com/anasouza', icon: 'instagram',    highlight: false, clicks: 412 },
    { id: 'l6', type: 'social',  label: 'YouTube',                  url: 'youtube.com/@anasouza',  icon: 'youtube',      highlight: false, clicks: 287 },
    { id: 'l7', type: 'social',  label: 'TikTok',                   url: 'tiktok.com/@anasouza',   icon: 'music',        highlight: false, clicks: 142 },
  ],
  views: 8420, clicks: 3769, conversion: 44.8, topReferrer: 'Instagram',
  updatedAt: NOW_B - 3 * 24 * 3600 * 1000, status: 'published',
}

/* ============================================================
   Helpers
   ============================================================ */

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtPct = (n: number, d = 0) => n.toFixed(d).replace('.', ',') + '%'

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
        <Plus size={13} />
        Adicionar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden min-w-[190px]">
            {Object.entries(linkTypes).map(([key, lt]) => (
              <button
                key={key}
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
   Phone Preview
   ============================================================ */

function PhonePreview({ page, theme }: { page: BioPage; theme: ThemePreset }) {
  const t = theme
  const buttonRadius = page.buttonStyle === 'rounded' ? '12px' : page.buttonStyle === 'pill' ? '999px' : '4px'

  return (
    <div
      className="mx-auto rounded-[44px] border-4 overflow-hidden relative"
      style={{ width: 320, height: 640, background: t.bg, borderColor: 'rgba(128,128,128,0.3)', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}
    >
      {/* Notch */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full z-10" style={{ width: 110, height: 26, background: '#000' }} />

      {/* Status bar */}
      <div className="px-6 pt-3 pb-1 flex items-center justify-between text-[10px] font-semibold relative z-20" style={{ color: t.text }}>
        <span>15:30</span>
        <span className="inline-flex items-center gap-1">
          <Signal size={9} /><Wifi size={9} /><BatteryFull size={11} />
        </span>
      </div>

      {/* Background decorations */}
      {page.background === 'gradient' && (
        <div className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: `radial-gradient(circle at 20% 0%, ${t.primary}44, transparent 50%), radial-gradient(circle at 80% 100%, ${t.primary}33, transparent 40%)` }} />
      )}
      {page.background === 'dots' && (
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{ backgroundImage: `radial-gradient(circle, ${t.muted}40 1px, transparent 1.5px)`, backgroundSize: '20px 20px' }} />
      )}

      {/* Content */}
      <div className="relative z-10 px-5 pt-8 pb-6 h-full overflow-y-auto" style={{ color: t.text }}>
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-[28px]"
            style={{ background: page.avatarColor, color: '#fff', border: `3px solid ${t.surface}` }}>
            {page.avatar}
          </div>
          <div className="text-[15px] font-bold tracking-tight mt-3" style={{ color: t.text }}>{page.name}</div>
          <code className="text-[10px] font-mono mt-0.5" style={{ color: t.muted }}>umbra.bot/{page.slug}</code>
          <p className="text-[11.5px] mt-2.5 text-center leading-snug px-2" style={{ color: t.muted }}>{page.bio}</p>
        </div>

        <div className="mt-5 space-y-2.5">
          {page.links.length === 0 && (
            <div className="text-center text-[11px] py-6 italic" style={{ color: t.muted }}>Nenhum link adicionado.</div>
          )}
          {page.links.map((l) => (
            <div
              key={l.id}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-semibold"
              style={{
                background: l.highlight ? t.primary : t.surface,
                color:      l.highlight ? '#fff' : t.text,
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

        <div className="mt-6 text-center text-[9.5px]" style={{ color: t.muted }}>feito com Umbra Bot</div>
      </div>

      {/* Home indicator */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-white/40 z-20" />
    </div>
  )
}

/* ============================================================
   Link Item Row
   ============================================================ */

function LinkItemRow({ link, index, total, onUpdate, onDelete, onMove }: {
  link: LinkItem; index: number; total: number
  onUpdate: (l: LinkItem) => void; onDelete: (id: string) => void; onMove: (id: string, dir: number) => void
}) {
  const lt = linkTypes[link.type] ?? linkTypes.custom

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 hover:border-[var(--text-muted)]/40 transition-colors">
      <div className="flex items-start gap-2.5">
        {/* Move buttons */}
        <div className="flex flex-col gap-0 pt-0.5">
          <button
            onClick={() => onMove(link.id, -1)}
            disabled={index === 0}
            className="w-5 h-5 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none"
          >
            <ChevronUp size={11} />
          </button>
          <button
            onClick={() => onMove(link.id, +1)}
            disabled={index === total - 1}
            className="w-5 h-5 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none"
          >
            <ChevronDown size={11} />
          </button>
        </div>

        {/* Type icon */}
        <div className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: lt.color }}>
          <DynIcon name={link.icon} size={14} />
        </div>

        {/* Inputs */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="text" value={link.label}
            onChange={(e) => onUpdate({ ...link, label: e.target.value })}
            placeholder="Rótulo do link"
            className="w-full h-8 px-2.5 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-md text-[12.5px] font-medium text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
          />
          <div className="flex items-center gap-1.5">
            <select
              value={link.type}
              onChange={(e) => {
                const t2 = linkTypes[e.target.value]
                if (t2) onUpdate({ ...link, type: e.target.value, icon: t2.iconName })
              }}
              className="h-8 px-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[11.5px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 shrink-0"
            >
              {Object.entries(linkTypes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input
              type="text" value={link.url}
              onChange={(e) => onUpdate({ ...link, url: e.target.value })}
              placeholder="https://…"
              className="flex-1 h-8 px-2.5 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-md text-[11.5px] font-mono text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
            />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Toggle checked={!!link.highlight} onChange={() => onUpdate({ ...link, highlight: !link.highlight })} />
              <span className="text-[11px] text-[var(--text-muted)]">Destacar</span>
            </label>
            <span className="text-[10.5px] text-[var(--text-muted)] inline-flex items-center gap-1">
              <MousePointerClick size={9} />
              {fmtNum(link.clicks || 0)} cliques
            </span>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(link.id)}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors focus:outline-none"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   Stats strip
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
   BioLinkPage
   ============================================================ */

export default function BioLinkPage() {
  const [page, setPage]     = useState<BioPage>(MOCK_PAGE)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved]   = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data, error } = await sb.from('biolinks').select('*').limit(1).maybeSingle()
        if (error || !data) throw new Error('no data')
        setPage(data as BioPage)
      } catch { setPage(MOCK_PAGE) } finally { setLoading(false) }
    }
    load()
  }, [])

  const theme = themePresets.find((t) => t.id === page.themeId) ?? themePresets[0]

  function set(patch: Partial<BioPage>) { setPage((p) => ({ ...p, ...patch })) }

  function updateLink(updated: LinkItem) { setPage((p) => ({ ...p, links: p.links.map((l) => (l.id === updated.id ? updated : l)) })) }
  function deleteLink(id: string)        { setPage((p) => ({ ...p, links: p.links.filter((l) => l.id !== id) })) }

  function moveLink(id: string, dir: number) {
    setPage((p) => {
      const idx = p.links.findIndex((l) => l.id === id)
      if (idx < 0) return p
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= p.links.length) return p
      const next = [...p.links];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return { ...p, links: next }
    })
  }

  function addLink(type: string) {
    const lt = linkTypes[type]
    if (!lt) return
    setPage((p) => ({
      ...p,
      links: [...p.links, { id: 'l_' + Date.now(), type, label: `Novo ${lt.label.toLowerCase()}`, url: '', icon: lt.iconName, highlight: false, clicks: 0 }],
    }))
  }

  function copyUrl() {
    try { navigator.clipboard?.writeText('https://umbra.bot/' + page.slug) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
    try {
      const sb = createClient()
      await sb.from('biolinks').upsert({
        id: page.id, slug: page.slug, name: page.name, bio: page.bio,
        avatar: page.avatar, avatar_color: page.avatarColor,
        theme_id: page.themeId, background: page.background, button_style: page.buttonStyle,
        links: page.links, status: page.status, updated_at: new Date().toISOString(),
      })
    } catch { /* silent */ }
  }

  const sortedByClicks = useMemo(() => [...page.links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)), [page.links])
  const totalLinkClicks = page.links.reduce((s, l) => s + (l.clicks || 0), 0)

  return (
    <DashboardLayout>
      <PageHeader
        title="Bio Link"
        subtitle="Sua página única de links — substitui o link na bio do Instagram/TikTok."
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
              <ExternalLink size={14} />Abrir página
            </button>
            <button
              onClick={save}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              {saved ? <Check size={14} className="text-green-500" /> : <Save size={14} />}
              {saved ? 'Salvo' : 'Salvar'}
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity">
              <Rocket size={14} />Publicar
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin mr-2" />
          Carregando…
        </div>
      ) : (
        <>
          {/* URL bar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-0 flex-1 min-w-[260px] max-w-md bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg overflow-hidden">
                <span className="pl-3 text-[10.5px] font-mono text-[var(--text-muted)] shrink-0">https://umbra.bot/</span>
                <input
                  type="text" value={page.slug}
                  onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })}
                  className="flex-1 h-9 pr-3 bg-transparent text-[13px] font-mono text-[var(--text)] focus:outline-none"
                />
              </div>
              <button
                onClick={copyUrl}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {copied ? 'Copiado' : 'Copiar URL'}
              </button>
              <div className="flex items-center gap-4 ml-auto">
                <Stat label="Visitas (30d)"   value={fmtNum(page.views)}      icon={Eye} />
                <Stat label="Cliques (30d)"   value={fmtNum(page.clicks)}     icon={MousePointerClick} />
                <Stat label="Conv. cliques"   value={fmtPct(page.conversion, 1)} icon={Target} tone="success" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
            {/* Editor column */}
            <div className="space-y-4 min-w-0">
              {/* Perfil */}
              <SectionCard title="Perfil" subtitle="Avatar, nome e descrição que aparecem no topo">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-[22px] shrink-0" style={{ background: page.avatarColor }}>
                      {page.avatar}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <FieldB label="Iniciais do avatar">
                        <input type="text" value={page.avatar} maxLength={3}
                          onChange={(e) => set({ avatar: e.target.value.toUpperCase().slice(0, 3) })}
                          className={inputB} />
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
                    <input type="text" value={page.name} onChange={(e) => set({ name: e.target.value })} className={inputB} />
                  </FieldB>
                  <FieldB label="Descrição (bio)" hint="Curta, com no máximo ~140 caracteres.">
                    <textarea value={page.bio} onChange={(e) => set({ bio: e.target.value })} rows={2} maxLength={160} className={textareaB} />
                    <div className="text-[10.5px] text-[var(--text-muted)] text-right mt-1">{page.bio.length}/160</div>
                  </FieldB>
                </div>
              </SectionCard>

              {/* Links */}
              <SectionCard
                title="Links"
                subtitle={`${page.links.length} links · use as setas para reordenar`}
                action={<AddLinkDropdown onAdd={addLink} />}
              >
                <div className="space-y-2">
                  {page.links.length === 0 && (
                    <div className="bg-[var(--surface-2)]/30 border border-dashed border-[var(--border)] rounded-lg p-8 text-center">
                      <Link2 size={20} className="text-[var(--text-muted)] mx-auto mb-2" />
                      <div className="text-[13px] font-semibold text-[var(--text)]">Adicione seu primeiro link</div>
                      <div className="text-[11.5px] text-[var(--text-muted)] mt-1">Escolha o tipo no botão "Adicionar" acima.</div>
                    </div>
                  )}
                  {page.links.map((l, i) => (
                    <LinkItemRow key={l.id} link={l} index={i} total={page.links.length}
                      onUpdate={updateLink} onDelete={deleteLink} onMove={moveLink} />
                  ))}
                </div>
              </SectionCard>

              {/* Tema */}
              <SectionCard title="Tema da página" subtitle="Cores, fundo e estilo dos botões">
                <div className="space-y-3.5">
                  <FieldB label="Paleta">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {themePresets.map((t) => {
                        const active = page.themeId === t.id
                        return (
                          <button key={t.id} onClick={() => set({ themeId: t.id })}
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
                          <button key={b.id}
                            onClick={() => set({ background: b.id as BioPage['background'] })}
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
                          <button key={b.id}
                            onClick={() => set({ buttonStyle: b.id as BioPage['buttonStyle'] })}
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
              <SectionCard title="Cliques por link" subtitle="Performance dos últimos 30 dias">
                <div className="space-y-2.5">
                  {sortedByClicks.map((l) => {
                    const max = sortedByClicks[0]?.clicks || 1
                    const pct = totalLinkClicks > 0 ? (l.clicks / totalLinkClicks) * 100 : 0
                    const barPct = (l.clicks / max) * 100
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
              </SectionCard>
            </div>

            {/* Preview column */}
            <div className="xl:sticky xl:top-[80px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye size={13} className="text-[var(--text-muted)]" />
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Prévia mobile</span>
                </div>
                <Badge tone={page.status === 'published' ? 'success' : 'muted'}>
                  {page.status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                  {page.status === 'published' ? 'Publicado' : 'Rascunho'}
                </Badge>
              </div>
              <PhonePreview page={page} theme={theme} />
              <div className="mt-3 text-center text-[10.5px] text-[var(--text-muted)]">
                umbra.bot/{page.slug} · referência principal: {page.topReferrer}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
