'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bot, ShoppingBag, Link2, AtSign, Play, Music,
  MessageCircle, Briefcase, Globe, Camera, Calendar,
  ArrowUpRight, Signal, Wifi, BatteryFull,
} from 'lucide-react'
import type { PublicBiolink } from './page'

/* ============================================================
   Types
   ============================================================ */

interface LinkItem {
  id: string
  type: string
  label: string
  url: string
  icon: string
  highlight: boolean
}

interface ThemePreset {
  id: string
  primary: string
  bg: string
  surface: string
  text: string
  muted: string
}

/* ============================================================
   Constants (shared with editor)
   ============================================================ */

const themePresets: ThemePreset[] = [
  { id: 'violet', primary: '#7c3aed', bg: '#0b0a14', surface: '#171428', text: '#f5f3ff', muted: '#a7a3c7' },
  { id: 'mint',   primary: '#10b981', bg: '#06140e', surface: '#0e2017', text: '#ecfdf5', muted: '#86efac' },
  { id: 'sunset', primary: '#f97316', bg: '#1a0d05', surface: '#2a1610', text: '#fff7ed', muted: '#fdba74' },
  { id: 'ocean',  primary: '#0ea5e9', bg: '#04111d', surface: '#0a1f2e', text: '#f0f9ff', muted: '#7dd3fc' },
  { id: 'rose',   primary: '#ec4899', bg: '#1a060f', surface: '#2a0e1c', text: '#fff0f6', muted: '#f9a8d4' },
  { id: 'mono',   primary: '#f5f5f5', bg: '#0a0a0a', surface: '#171717', text: '#fafafa', muted: '#a3a3a3' },
  { id: 'cream',  primary: '#7c3aed', bg: '#f9f5ee', surface: '#ffffff', text: '#1a1a1a', muted: '#737373' },
  { id: 'forest', primary: '#16a34a', bg: '#040e08', surface: '#081a0e', text: '#f0fdf4', muted: '#4ade80' },
]

const ICON_MAP: Record<string, React.ElementType> = {
  bot: Bot, 'shopping-bag': ShoppingBag, link: Link2, 'at-sign': AtSign,
  play: Play, instagram: Camera, youtube: Play, music: Music,
  twitter: MessageCircle, linkedin: Briefcase, facebook: Globe, calendar: Calendar,
  'arrow-up-right': ArrowUpRight,
}

function DynIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Ic = ICON_MAP[name] ?? Link2
  return <Ic size={size} />
}

/* ============================================================
   Helpers
   ============================================================ */

function detectDevice(): 'mobile' | 'desktop' | 'tablet' | 'bot' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/bot|crawler|spider|crawling/i.test(ua)) return 'bot'
  if (/tablet|ipad/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone/i.test(ua)) return 'mobile'
  return 'desktop'
}

/* ============================================================
   BioPublicClient
   ============================================================ */

interface Props {
  biolink: PublicBiolink
  slug: string
}

export function BioPublicClient({ biolink, slug }: Props) {
  const links = (biolink.links as LinkItem[]) ?? []
  const theme = themePresets.find((t) => t.id === biolink.theme_id) ?? themePresets[0]
  const buttonRadius = biolink.button_style === 'rounded' ? '12px' : biolink.button_style === 'pill' ? '999px' : '4px'

  // Track visit on mount (fire-and-forget)
  useEffect(() => {
    const supabase = createClient()
    const referrer = typeof document !== 'undefined' ? (document.referrer || null) : null
    void Promise.resolve(supabase.rpc('record_biolink_visit', {
      p_slug:        slug,
      p_ip_hash:     null,
      p_referrer:    referrer,
      p_device_type: detectDevice(),
    }))
  }, [slug])

  // Track link click then navigate
  const handleLinkClick = useCallback((link: LinkItem, e: React.MouseEvent) => {
    e.preventDefault()
    if (!link.url) return

    const supabase = createClient()
    const referrer = typeof document !== 'undefined' ? (document.referrer || null) : null
    // Fire-and-forget — don't block navigation
    void Promise.resolve(supabase.rpc('record_biolink_link_click', {
      p_slug:        slug,
      p_link_id:     link.id,
      p_link_url:    link.url,
      p_ip_hash:     null,
      p_referrer:    referrer,
      p_device_type: detectDevice(),
    }))

    window.open(link.url, '_blank', 'noopener,noreferrer')
  }, [slug])

  return (
    <div
      className="min-h-screen w-full relative"
      style={{ background: theme.bg, color: theme.text }}
    >
      {/* Background effects */}
      {biolink.background === 'gradient' && (
        <div
          className="fixed inset-0 pointer-events-none opacity-50"
          style={{
            background: `radial-gradient(circle at 20% 0%, ${theme.primary}44, transparent 50%),
                         radial-gradient(circle at 80% 100%, ${theme.primary}33, transparent 40%)`,
          }}
        />
      )}
      {biolink.background === 'dots' && (
        <div
          className="fixed inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle, ${theme.muted}40 1px, transparent 1.5px)`,
            backgroundSize: '22px 22px',
          }}
        />
      )}

      {/* Status bar (mobile cosmetic) */}
      <div className="relative z-10 hidden sm:hidden">
        <div className="px-6 pt-2 pb-1 flex items-center justify-between text-[10px] font-semibold">
          <span>15:30</span>
          <span className="inline-flex items-center gap-1">
            <Signal size={9} /><Wifi size={9} /><BatteryFull size={11} />
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-sm mx-auto px-5 pt-12 pb-16">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-[32px] overflow-hidden shrink-0"
            style={{
              background: biolink.avatar_color || theme.primary,
              color: '#fff',
              border: `3px solid ${theme.surface}`,
              boxShadow: `0 0 0 3px ${theme.primary}33`,
            }}
          >
            {biolink.avatar?.startsWith('http')
              ? <img src={biolink.avatar} alt={biolink.name} className="w-full h-full object-cover" />
              : (biolink.avatar || '?')
            }
          </div>

          <h1
            className="text-[20px] font-bold tracking-tight mt-4 text-center"
            style={{ color: theme.text }}
          >
            {biolink.name || 'Sem nome'}
          </h1>

          <span
            className="text-[11.5px] font-mono mt-1"
            style={{ color: theme.muted }}
          >
            umbra.bot/b/{slug}
          </span>

          {biolink.bio && (
            <p
              className="text-[13.5px] text-center leading-relaxed mt-3 px-2"
              style={{ color: theme.muted }}
            >
              {biolink.bio}
            </p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.length === 0 && (
            <p className="text-center text-[13px] py-8" style={{ color: theme.muted }}>
              Nenhum link adicionado ainda.
            </p>
          )}
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url || '#'}
              onClick={(e) => handleLinkClick(link, e)}
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3.5 text-[14px] font-semibold transition-all duration-150 hover:scale-[1.015] hover:brightness-110 active:scale-[0.99] cursor-pointer"
              style={{
                background:   link.highlight ? theme.primary : theme.surface,
                color:        link.highlight ? '#fff' : theme.text,
                borderRadius: buttonRadius,
                border:       link.highlight ? 'none' : `1.5px solid ${theme.primary}33`,
                boxShadow:    link.highlight
                  ? `0 4px 14px ${theme.primary}55`
                  : `0 1px 4px rgba(0,0,0,0.15)`,
              }}
            >
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{
                  background: link.highlight ? 'rgba(255,255,255,0.2)' : `${theme.primary}22`,
                  color:      link.highlight ? '#fff' : theme.primary,
                }}
              >
                <DynIcon name={link.icon} size={14} />
              </span>
              <span className="flex-1 truncate">{link.label}</span>
              <ArrowUpRight
                size={14}
                style={{ opacity: 0.5, flexShrink: 0 }}
              />
            </a>
          ))}
        </div>

      </div>
    </div>
  )
}
