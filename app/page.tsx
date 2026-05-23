'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import {
  ArrowRight, PlayCircle, Check, MoreVertical, QrCode, CheckCircle2,
  Paperclip, Mic, Zap, UserPlus, Wallet, Rocket, Landmark, ShieldCheck,
  MoonStar, XCircle, X, Bot, GitBranch, RotateCw, Send, BarChart3,
  Users, Link, Target, ShoppingCart, Link2, Webhook, AlertTriangle,
  CreditCard, Infinity, MessageSquare, Sun, Moon, Menu, Plus, Minus,
  ChevronRight, Music, Search, Facebook, DollarSign,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ─── Icon component ─────────────────────────────────────── */
const iconMap: Record<string, LucideIcon> = {
  'arrow-right': ArrowRight,
  'play-circle': PlayCircle,
  'check': Check,
  'more-vertical': MoreVertical,
  'qr-code': QrCode,
  'check-circle-2': CheckCircle2,
  'paperclip': Paperclip,
  'mic': Mic,
  'zap': Zap,
  'user-plus': UserPlus,
  'wallet': Wallet,
  'rocket': Rocket,
  'landmark': Landmark,
  'shield-check': ShieldCheck,
  'moon-star': MoonStar,
  'x-circle': XCircle,
  'x': X,
  'bots': Bot,
  'bot': Bot,
  'git-branch': GitBranch,
  'rotate-cw': RotateCw,
  'send': Send,
  'bar-chart-3': BarChart3,
  'users': Users,
  'link': Link,
  'target': Target,
  'shopping-cart': ShoppingCart,
  'link-2': Link2,
  'webhook': Webhook,
  'alert-triangle': AlertTriangle,
  'credit-card': CreditCard,
  'infinity': Infinity,
  'message-square': MessageSquare,
  'sun': Sun,
  'moon': Moon,
  'menu': Menu,
  'plus': Plus,
  'minus': Minus,
  'chevron-right': ChevronRight,
  'facebook': Facebook,
  'music': Music,
  'search': Search,
}

function Icon({ name, size = 16, className = '', style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const Comp = iconMap[name]
  if (!Comp) return null
  return <Comp size={size} className={`shrink-0 ${className}`.trim()} style={style} />
}

/* ─── Logo ───────────────────────────────────────────────── */
function UmbraLogo({ size = 28 }: { size?: number }) {
  const r = Math.round(size * 0.24)
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div style={{ width: size, height: size, background: 'var(--accent)', borderRadius: r, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)}>
          <path d="M 18 18 V 60 A 32 32 0 0 0 82 60 V 18 H 64 V 60 A 14 14 0 0 1 36 60 V 18 Z" fill="rgba(255,255,255,0.93)" />
          <rect x="14" y="42" width="72" height="3.5" rx="2" fill="rgba(0,0,0,0.55)" />
        </svg>
      </div>
      <span className="text-[15px] font-bold tracking-tight text-text">
        Umbra<span style={{ color: 'var(--accent)' }}>.</span>Bot
      </span>
    </div>
  )
}

/* ─── ScrollProgress ─────────────────────────────────────── */
function ScrollProgress() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    function onScroll() {
      const el = document.documentElement
      const scrolled = el.scrollTop || document.body.scrollTop
      const total = el.scrollHeight - el.clientHeight
      setPct(total > 0 ? (scrolled / total) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 64,
        left: 0,
        height: 2,
        width: `${pct}%`,
        background: 'linear-gradient(90deg, var(--accent), color-mix(in oklab, var(--accent) 70%, #a78bfa))',
        transition: 'width 0.08s linear',
        pointerEvents: 'none',
        zIndex: 51,
      }}
    />
  )
}

/* ─── Header ─────────────────────────────────────────────── */
function Header({ theme, toggleTheme, mounted }: {
  theme: string
  toggleTheme: () => void
  mounted: boolean
}) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 8) }
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { href: '#recursos', label: 'Recursos' },
    { href: '#gateways', label: 'Gateways' },
    { href: '#precos',   label: 'Preços'   },
    { href: '#faq',      label: 'FAQ'      },
  ]

  return (
    <header className={[
      'fixed top-0 inset-x-0 z-50 transition-all',
      scrolled ? 'bg-bg/85 backdrop-blur-md border-b border-border' : 'bg-transparent',
    ].join(' ')}>
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="focus-ring rounded">
          <UmbraLogo />
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 text-[13px] font-medium text-text-muted hover:text-text rounded-md hover:bg-surface-2 focus-ring"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {mounted && (
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-ring"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
          <a
            href="/login"
            className="hidden sm:inline-flex h-9 px-3.5 items-center rounded-md text-[13px] font-medium text-text-muted hover:text-text hover:bg-surface-2 focus-ring"
          >
            Login
          </a>
          <a
            href="#precos"
            onClick={(e) => { e.preventDefault(); document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth' }) }}
            className="inline-flex h-9 px-3.5 items-center rounded-md text-[13px] font-semibold focus-ring whitespace-nowrap transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Criar conta
          </a>
          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-bg">
          <nav className="px-5 py-3 space-y-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-[14px] text-text rounded-md hover:bg-surface-2"
              >
                {l.label}
              </a>
            ))}
            <a href="/login" className="block px-3 py-2 text-[14px] text-text-muted rounded-md hover:bg-surface-2">Login</a>
          </nav>
        </div>
      )}
    </header>
  )
}

/* ─── Hero ───────────────────────────────────────────────── */
function ChatBubble({ side, children, accent, success }: {
  side: 'left' | 'right'
  children: React.ReactNode
  accent?: boolean
  success?: boolean
}) {
  const isRight = side === 'right'

  if (isRight && success) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 leading-snug border"
          style={{ background: 'color-mix(in oklab, var(--success) 15%, transparent)', color: 'var(--success)', borderColor: 'color-mix(in oklab, var(--success) 30%, transparent)' }}>
          {children}
        </div>
      </div>
    )
  }
  if (isRight) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 leading-snug"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
          {children}
        </div>
      </div>
    )
  }
  if (accent) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2 leading-snug"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2 leading-snug border border-border bg-surface-2 text-text">
        {children}
      </div>
    </div>
  )
}

/* ─── Sale ticker strip ──────────────────────────────────── */
const SALE_NOTIFS_FULL = [
  { amount: 'R$ 97,00',  buyer: 'Carlos M.'  },
  { amount: 'R$ 197,00', buyer: 'Ana P.'     },
  { amount: 'R$ 47,00',  buyer: 'Bruno S.'   },
  { amount: 'R$ 297,00', buyer: 'Fernanda L.'},
  { amount: 'R$ 37,00',  buyer: 'Lucas T.'   },
  { amount: 'R$ 497,00', buyer: 'Mariana C.' },
  { amount: 'R$ 67,00',  buyer: 'Pedro V.'   },
  { amount: 'R$ 147,00', buyer: 'Juliana M.' },
  { amount: 'R$ 997,00', buyer: 'Rafael B.'  },
]

function SaleTickerSection() {
  const doubled = [...SALE_NOTIFS_FULL, ...SALE_NOTIFS_FULL]
  return (
    <div
      className="relative overflow-hidden py-3 border-y border-border"
      style={{ background: 'color-mix(in oklab, var(--success) 5%, var(--bg))' }}
    >
      {/* fade masks left/right */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10"
        style={{ background: 'linear-gradient(to right, var(--bg), transparent)' }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10"
        style={{ background: 'linear-gradient(to left, var(--bg), transparent)' }} />

      <div style={{ display: 'flex', width: 'max-content', gap: '0.75rem', animation: 'marquee-lp 24s linear infinite' }}>
        {doubled.map((n, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-2.5 bg-surface border border-border rounded-xl px-3 py-2 shrink-0"
            style={{ boxShadow: '0 2px 12px -4px rgba(0,0,0,0.2)' }}
          >
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: 'color-mix(in oklab, var(--success) 15%, transparent)',
                color: 'var(--success)',
                animation: `moneyPing 2.4s ${(i % 9) * 0.27}s ease-in-out infinite`,
              }}
            >
              <DollarSign size={13} />
            </span>
            <div>
              <div className="text-[9.5px] uppercase tracking-wider font-semibold text-text-subtle">
                Venda aprovada · {n.buyer}
              </div>
              <div className="text-[14px] font-bold tnum" style={{ color: 'var(--success)' }}>
                {n.amount}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TypingIndicator({ side }: { side: 'left' | 'right' }) {
  const isRight = side === 'right'
  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}
      style={{ animation: 'chatIn 0.18s ease both' }}>
      <div
        className="rounded-2xl px-3 py-2.5"
        style={isRight
          ? { background: 'var(--accent)' }
          : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
        }
      >
        <div className="flex gap-1 items-center" style={{ height: 12 }}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                display: 'block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isRight ? 'var(--accent-fg)' : 'var(--text-muted)',
                animation: `typingDot 1.1s ${i * 0.18}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const CHAT_STEPS: Array<{ side: 'left' | 'right'; typingMs: number; pauseAfter: number }> = [
  { side: 'left',  typingMs: 950,  pauseAfter: 450 },
  { side: 'right', typingMs: 480,  pauseAfter: 380 },
  { side: 'left',  typingMs: 1150, pauseAfter: 380 },
  { side: 'left',  typingMs: 1050, pauseAfter: 380 },
  { side: 'right', typingMs: 680,  pauseAfter: 380 },
  { side: 'left',  typingMs: 920,  pauseAfter: 3800 },
]

function HeroVisual() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [typing, setTyping] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function runStep(stepIndex: number) {
      if (stepIndex >= CHAT_STEPS.length) {
        // pauseAfter of last step already elapsed before this call — just reset
        setVisibleCount(0)
        setTyping(null)
        timer = setTimeout(() => runStep(0), 500)
        return
      }
      const step = CHAT_STEPS[stepIndex]
      setTyping(step.side)
      timer = setTimeout(() => {
        setTyping(null)
        setVisibleCount(stepIndex + 1)
        timer = setTimeout(() => runStep(stepIndex + 1), step.pauseAfter)
      }, step.typingMs)
    }

    timer = setTimeout(() => runStep(0), 600)
    return () => clearTimeout(timer)
  }, [])

  const chatStyle: React.CSSProperties = { animation: 'chatIn 0.22s cubic-bezier(.2,.8,.3,1) both' }

  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--corona) 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative">
        <div
          className="relative bg-surface border border-border rounded-2xl p-4 max-w-[340px] mx-auto"
          style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)' }}
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <div
              className="relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px]"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              U
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-surface" style={{ background: 'var(--success)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-text">Mentoria VIP Bot</div>
              <div className="text-[10.5px]" style={{ color: 'var(--success)' }}>online</div>
            </div>
            <MoreVertical size={14} className="text-text-muted shrink-0" />
          </div>

          <div className="py-3 space-y-2 text-[12px]" style={{ minHeight: 220 }}>
            {visibleCount >= 1 && (
              <div style={chatStyle}>
                <ChatBubble side="left">Olá! Quer entrar no grupo VIP? 🟣</ChatBubble>
              </div>
            )}
            {visibleCount >= 2 && (
              <div style={chatStyle}>
                <ChatBubble side="right">Quero sim</ChatBubble>
              </div>
            )}
            {visibleCount >= 3 && (
              <div style={chatStyle}>
                <ChatBubble side="left">
                  <div className="font-semibold mb-0.5">Acesso VIP — 30 dias</div>
                  <div className="text-[16px] font-bold tnum" style={{ color: 'var(--accent)' }}>R$ 97,00</div>
                  <div className="text-[10.5px] opacity-70 mt-0.5">Pagamento via PIX · instantâneo</div>
                </ChatBubble>
              </div>
            )}
            {visibleCount >= 4 && (
              <div style={chatStyle}>
                <ChatBubble side="left">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-bg rounded border border-border flex items-center justify-center">
                      <QrCode size={24} className="text-text" />
                    </div>
                    <div className="text-[10.5px]">
                      <div className="font-semibold">QR Code PIX</div>
                      <div className="opacity-70">Toque para copiar</div>
                    </div>
                  </div>
                </ChatBubble>
              </div>
            )}
            {visibleCount >= 5 && (
              <div style={chatStyle}>
                <ChatBubble side="right" success>
                  <div className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="shrink-0" />
                    Pagamento confirmado
                  </div>
                </ChatBubble>
              </div>
            )}
            {visibleCount >= 6 && (
              <div style={chatStyle}>
                <ChatBubble side="left" accent>
                  <div className="font-semibold mb-1">🎉 Acesso liberado!</div>
                  <div className="text-[11px] opacity-90">Clique para entrar no grupo VIP:</div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-white/15 backdrop-blur rounded text-[11px] font-mono">
                    t.me/+abc123…
                  </div>
                </ChatBubble>
              </div>
            )}
            {typing && <TypingIndicator side={typing} />}
          </div>

          <div className="pt-3 border-t border-border flex items-center gap-2 text-text-subtle">
            <Paperclip size={14} className="shrink-0" />
            <div className="flex-1 text-[11px]">Mensagem</div>
            <Mic size={14} className="shrink-0" />
          </div>
        </div>

        <div
          className="absolute -right-3 sm:-right-8 bottom-8 bg-surface border border-border rounded-xl p-3 hidden sm:block"
          style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.4)', animation: 'revealUp 0.7s 0.5s both' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
            >
              <UserPlus size={13} className="shrink-0" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Acesso liberado</div>
              <div className="text-[12px] font-medium text-text">automaticamente</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section id="top" className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden noise">
      <div className="corona" style={{ width: 1000, height: 1000, top: -320, left: '50%', animation: 'pulseBgA 9s ease-in-out infinite' }} />
      <div className="corona" style={{ width: 600, height: 600, top: 80, right: -120, opacity: 0.7, animation: 'pulseBgB 12s ease-in-out infinite' }} />
      <div className="corona" style={{ width: 450, height: 450, bottom: -80, left: -80, opacity: 0.5, animation: 'pulseBgC 15s ease-in-out infinite' }} />

      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div className="reveal">
            <a
              href="#precos"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11.5px] font-semibold hover:opacity-90 transition-colors"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'color-mix(in oklab, var(--accent) 30%, transparent)',
                color: 'var(--accent)',
              }}
            >
              <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }}>
                <span className="absolute inset-0 rounded-full ping-soft" style={{ background: 'var(--accent)' }} />
              </span>
              Sem mensalidade · só paga quando vende
            </a>
            <h1 className="mt-5 text-[34px] sm:text-[44px] md:text-[56px] font-bold tracking-tight leading-[1.02]">
              Venda no Telegram <span className="text-grad">no automático</span>.<br />
              Você só recebe.
            </h1>
            <p className="mt-5 text-[16px] md:text-[17px] text-text-muted leading-relaxed max-w-xl">
              O Umbra Bot atende, cobra via PIX e libera o acesso ao seu grupo, canal ou produto digital sozinho — 24 horas por dia. Você conecta o seu bot do Telegram e o seu gateway. O dinheiro cai direto na sua conta.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a
                href="/login?mode=signup"
                className="inline-flex h-12 px-5 items-center justify-center gap-2 rounded-md text-[14.5px] font-semibold hover:opacity-90 focus-ring transition-colors"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Criar Conta Grátis
                <ArrowRight size={16} className="shrink-0" />
              </a>
            </div>

            <div className="mt-6 flex items-center gap-5 text-[12px] text-text-muted flex-wrap">
              <span className="inline-flex items-center gap-1.5"><Check size={12} className="shrink-0" style={{ color: 'var(--success)' }} /> Sem cartão de crédito</span>
              <span className="inline-flex items-center gap-1.5"><Check size={12} className="shrink-0" style={{ color: 'var(--success)' }} /> Setup em minutos</span>
              <span className="inline-flex items-center gap-1.5"><Check size={12} className="shrink-0" style={{ color: 'var(--success)' }} /> Sem código</span>
            </div>
          </div>

          <div className="reveal" style={{ animationDelay: '0.15s' }}>
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Highlights ─────────────────────────────────────────── */
function Highlights() {
  const items = [
    { icon: 'zap',          label: 'PIX instantâneo'           },
    { icon: 'wallet',       label: 'Sem mensalidade'           },
    { icon: 'rocket',       label: 'Setup em minutos'          },
    { icon: 'landmark',     label: 'Saque direto na sua conta' },
    { icon: 'shield-check', label: 'Sem código, sem técnico'   },
    { icon: 'moon-star',    label: 'Funciona 24/7'             },
    { icon: 'infinity',     label: 'Bots ilimitados'           },
    { icon: 'users',        label: 'Leads ilimitados'          },
    { icon: 'rotate-cw',    label: 'Remarketing automático'    },
    { icon: 'bar-chart-3',  label: 'Dashboard em tempo real'   },
    { icon: 'user-plus',    label: 'Programa de afiliados'     },
    { icon: 'git-branch',   label: 'Fluxos sem código'         },
  ]
  const doubled = [...items, ...items]
  return (
    <section className="border-y border-border overflow-hidden" style={{ background: 'color-mix(in oklab, var(--surface) 40%, transparent)' }}>
      <div className="py-5">
        <div style={{ display: 'flex', alignItems: 'center', width: 'max-content', gap: '2.5rem', animation: 'marquee-lp 16s linear infinite' }}>
          {doubled.map((it, i) => (
            <div key={i} className="inline-flex items-center gap-2 text-[13px] shrink-0">
              <Icon name={it.icon} size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-medium text-text">{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── SectionEyebrow ─────────────────────────────────────── */
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--accent)' }}>
      <span className="w-6 h-px" style={{ background: 'var(--accent)' }} />
      {children}
    </div>
  )
}

/* ─── Reveal (scroll-triggered fade-up) ─────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, delay = 0, className = '', style }: {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(22px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ─── BeforeAfter ────────────────────────────────────────── */
function BeforeAfter() {
  const rows = [
    { label: 'Atendimento',    before: 'Você responde no DM toda hora, inclusive de madrugada',        after: 'O bot atende automaticamente, na hora, 24/7'           },
    { label: 'Cobrança',       before: 'Cliente pede chave PIX, você manda na mão',                    after: 'O bot gera o PIX no segundo seguinte ao pedido'        },
    { label: 'Confirmação',    before: 'Você confere o comprovante e libera o acesso manualmente',     after: 'Pagamento detectado e acesso liberado em segundos'     },
    { label: 'Acesso ao grupo',before: 'Você adiciona cada comprador um a um',                         after: 'Link de convite único gerado e enviado pelo bot'       },
    { label: 'Vendas perdidas',before: 'Lead some quando você demora a responder',                     after: 'Remarketing automático reativa quem não pagou'         },
    { label: 'Escalar',        before: 'Cada nova venda é mais trabalho seu',                          after: 'Mil vendas no mesmo dia, mesmo trabalho'               },
  ]

  return (
    <section className="py-20 md:py-28 relative">
      <div className="corona" style={{ width: 700, height: 700, top: -100, left: -200, opacity: 0.4 }} />
      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <SectionEyebrow>O contraste</SectionEyebrow>
          <h2 className="mt-2 text-[28px] md:text-[40px] font-bold tracking-tight leading-tight max-w-3xl">
            Da venda manual{' '}
            <span
              className="line-through text-text-subtle"
              style={{ textDecorationColor: 'color-mix(in oklab, var(--danger) 60%, transparent)' }}
            >caótica</span>
            <br className="hidden sm:block" />
            {' '}para o piloto automático.
          </h2>
          <p className="mt-3 text-[15px] text-text-muted max-w-2xl">
            A diferença não está em vender mais. Está em parar de operar o seu próprio produto.
          </p>
        </Reveal>

        <Reveal delay={180}>
        <div className="mt-10 rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr] bg-surface-2 border-b border-border">
            <div className="hidden md:block px-5 py-3 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Etapa</div>
            <div className="px-5 py-3 text-[10.5px] uppercase tracking-wider font-semibold border-l border-border flex items-center gap-2" style={{ color: 'var(--danger)' }}>
              <XCircle size={12} className="shrink-0" /> Venda manual hoje
            </div>
            <div className="px-5 py-3 text-[10.5px] uppercase tracking-wider font-semibold border-l border-border flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <CheckCircle2 size={12} className="shrink-0" /> Com Umbra Bot
            </div>
          </div>

          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-1 md:grid-cols-[180px_1fr_1fr] ${i !== rows.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="px-5 py-3 md:py-4 text-[12px] uppercase tracking-wider font-semibold text-text-muted bg-surface/50 md:bg-transparent">
                {r.label}
              </div>
              <div className="px-5 py-3 md:py-4 text-[13.5px] text-text-muted leading-snug border-l border-border bg-surface/30">
                <X size={12} className="inline-block -mt-0.5 mr-1.5 shrink-0" style={{ color: 'var(--danger)' }} />
                {r.before}
              </div>
              <div
                className="px-5 py-3 md:py-4 text-[13.5px] text-text font-medium leading-snug border-l border-border"
                style={{ background: 'color-mix(in oklab, var(--accent) 4%, transparent)' }}
              >
                <Check size={12} className="inline-block -mt-0.5 mr-1.5 shrink-0" style={{ color: 'var(--accent)' }} />
                {r.after}
              </div>
            </div>
          ))}
        </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── Features ───────────────────────────────────────────── */
function Features() {
  const features = [
    { icon: 'bots',           title: 'Múltiplos bots',              desc: 'Gerencie quantos bots quiser numa única conta, cada um com seu próprio funil.' },
    { icon: 'moon-star',      title: 'Vende 24/7 sozinho',          desc: 'O bot atende, cobra e entrega o produto, mesmo enquanto você dorme.' },
    { icon: 'zap',            title: 'PIX integrado',               desc: 'QR Code gerado direto no chat. Pagamento detectado em segundos.' },
    { icon: 'git-branch',     title: 'Editor visual de fluxos',     desc: 'Monte funis com mensagens, condições, delays, ofertas e upsells sem código.' },
    { icon: 'rotate-cw',      title: 'Remarketing automático',      desc: 'Recupera PIX gerado e não pago + reativa leads com campanhas programadas.' },
    { icon: 'send',           title: 'Disparador em massa',         desc: 'Envia mensagens para toda a base de leads e clientes em segundos.' },
    { icon: 'bar-chart-3',    title: 'Dashboard em tempo real',     desc: 'Faturamento, funil de conversão e métricas atualizadas a cada venda.' },
    { icon: 'users',          title: 'CRM de clientes',             desc: 'Veja quem comprou, ticket médio, último contato e histórico de cada lead.' },
    { icon: 'user-plus',      title: 'Programa de afiliados',       desc: 'Distribua links, controle comissão e split automático na venda.' },
    { icon: 'link',           title: 'Redirecionadores + cloaker',  desc: 'Links rastreáveis com proteção contra clonagem em campanhas pagas.' },
    { icon: 'target',         title: 'Pixels + UTMs server-side',   desc: 'Trackeamento real do Meta, TikTok e Google, com atribuição precisa.' },
    { icon: 'shopping-cart',  title: 'Checkout próprio',            desc: 'Páginas de pagamento personalizadas com sua marca e identidade.' },
    { icon: 'link-2',         title: 'Bio Link',                    desc: 'Página de bio com seus links, produtos e bots em um único endereço.' },
    { icon: 'webhook',        title: 'Webhooks',                    desc: 'Notifica sistemas externos quando uma venda acontece ou um lead entra.' },
    { icon: 'alert-triangle', title: 'Alertas críticos',            desc: 'Avisa na hora se um bot caiu, gateway falhou ou venda não foi liberada.' },
    { icon: 'wallet',         title: 'Financeiro completo',         desc: 'Extrato detalhado de cada transação, taxa cobrada e saldo a sacar.' },
  ]

  return (
    <section id="recursos" className="py-20 md:py-28 relative">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <SectionEyebrow>Tudo numa só ferramenta</SectionEyebrow>
            <h2 className="mt-2 text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
              Cada peça da sua operação, no automático.
            </h2>
            <p className="mt-3 text-[15px] text-text-muted">
              Atendimento, cobrança, entrega, tráfego, financeiro e tudo o mais que você precisaria amarrar com 5 ferramentas diferentes.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={(i % 4) * 70}
              className="group relative bg-surface border border-border rounded-xl p-5 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-colors"
                style={{
                  color: 'var(--accent)',
                  border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
                  background: 'color-mix(in oklab, var(--accent) 5%, transparent)',
                }}
              >
                <Icon name={f.icon} size={15} />
              </div>
              <h3 className="text-[14px] font-semibold text-text leading-snug">{f.title}</h3>
              <p className="text-[12.5px] text-text-muted mt-1.5 leading-relaxed">{f.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── HowItWorks ─────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n: '01', icon: 'user-plus',   title: 'Crie sua conta grátis',  desc: 'Sem cartão de crédito. Em menos de 60 segundos você já está dentro.' },
    { n: '02', icon: 'bot',         title: 'Conecte seu bot',         desc: 'Cole o token do @BotFather no Umbra. A gente cuida do resto — webhook, eventos, tudo.' },
    { n: '03', icon: 'credit-card', title: 'Conecte seu gateway PIX', desc: 'O dinheiro cai direto na sua conta. Nada passa pelo Umbra. Sem markup, sem retenção.' },
    { n: '04', icon: 'zap',         title: 'Vendendo no automático',  desc: 'Seu bot já atende, cobra, entrega o acesso e te avisa de cada venda em tempo real.' },
  ]

  return (
    <section id="como-funciona" className="py-20 md:py-28 relative border-y border-border" style={{ background: 'color-mix(in oklab, var(--surface) 40%, transparent)' }}>
      <div className="corona" style={{ width: 800, height: 800, top: -200, right: -200, opacity: 0.5 }} />
      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <SectionEyebrow>Em 4 passos</SectionEyebrow>
            <h2 className="mt-2 text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
              Do zero ao primeiro PIX, hoje.
            </h2>
            <p className="mt-3 text-[15px] text-text-muted">
              Sem técnico. Sem código. Sem mensalidade.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 100} className="relative">
              <div className="bg-surface border border-border rounded-xl p-5 h-full">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[42px] font-black tnum tracking-tighter text-grad leading-none">{s.n}</span>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'color-mix(in oklab, var(--accent) 10%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Icon name={s.icon} size={16} />
                  </div>
                </div>
                <h3 className="text-[15px] font-semibold text-text">{s.title}</h3>
                <p className="text-[12.5px] text-text-muted mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-2.5 z-10">
                  <ChevronRight size={16} className="text-text-subtle shrink-0" />
                </div>
              )}
            </Reveal>
          ))}
        </div>

        <Reveal delay={300}>
        <div className="mt-10 text-center">
          <a
            href="/login?mode=signup"
            className="inline-flex h-12 px-5 items-center justify-center gap-2 rounded-md text-[14.5px] font-semibold hover:opacity-90 focus-ring transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Começar agora — é grátis
            <ArrowRight size={16} className="shrink-0" />
          </a>
        </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── Integrations ───────────────────────────────────────── */
function PlaceholderChip({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-surface-2 border border-dashed border-border rounded-lg px-3 py-2">
      <div className="w-6 h-6 rounded bg-bg border border-border flex items-center justify-center text-text-subtle">
        <CreditCard size={11} className="shrink-0" />
      </div>
      <span className="text-[11.5px] font-mono text-text-subtle truncate">{label}</span>
    </div>
  )
}

function TrackingRow({ icon, name, sub }: { icon: string; name: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3.5 py-2.5">
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
        style={{
          background: 'color-mix(in oklab, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
          color: 'var(--accent)',
        }}
      >
        <Icon name={icon} size={14} />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-text">{name}</div>
        <div className="text-[11px] text-text-muted truncate">{sub}</div>
      </div>
      <CheckCircle2 size={14} className="ml-auto shrink-0" style={{ color: 'var(--success)' }} />
    </div>
  )
}

function Integrations() {
  return (
    <section id="gateways" className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <Reveal>
          <div>
            <SectionEyebrow>Gateways de pagamento</SectionEyebrow>
            <h2 className="mt-2 text-[28px] md:text-[36px] font-bold tracking-tight leading-tight">
              Conecte o seu gateway. O dinheiro é seu, sempre.
            </h2>
            <p className="mt-3 text-[15px] text-text-muted leading-relaxed max-w-lg">
              A Umbra não retém um centavo das suas vendas. Você conecta o seu próprio gateway de PIX e o valor cai direto na sua conta a cada pagamento confirmado.
            </p>

            <div className="mt-7 bg-surface border border-border rounded-xl p-5">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-3">Gateways suportados</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <PlaceholderChip label="[GATEWAY 1 — PREENCHER]" />
                <PlaceholderChip label="[GATEWAY 2 — PREENCHER]" />
                <PlaceholderChip label="[GATEWAY 3 — PREENCHER]" />
                <PlaceholderChip label="[GATEWAY 4 — PREENCHER]" />
              </div>
              <div className="mt-3 text-[11px] text-text-subtle leading-snug">
                Não conhece o seu gateway? Veja a lista completa atualizada no painel após criar a conta.
              </div>
            </div>
          </div>
          </Reveal>

          <Reveal delay={150}>
          <div>
            <SectionEyebrow>Trackeamento</SectionEyebrow>
            <h2 className="mt-2 text-[28px] md:text-[36px] font-bold tracking-tight leading-tight">
              Pixels e atribuição que realmente funcionam.
            </h2>
            <p className="mt-3 text-[15px] text-text-muted leading-relaxed max-w-lg">
              Envio server-side dos pixels de Meta, TikTok e Google, com UTMs propagados do clique até o evento de venda. Atribuição precisa — sem perder dados em iOS ou bloqueador de anúncios.
            </p>

            <div className="mt-7 space-y-2.5">
              <TrackingRow icon="facebook" name="Meta"   sub="Facebook & Instagram · Pixel + CAPI" />
              <TrackingRow icon="music"    name="TikTok" sub="Pixel + Events API" />
              <TrackingRow icon="search"   name="Google" sub="Google Tag · GA4 + Ads" />
              <TrackingRow icon="link-2"   name="UTMs"   sub="Captura no clique, persiste até a venda" />
            </div>
          </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─── Pricing ────────────────────────────────────────────── */
function Pricing() {
  const benefits = [
    { icon: 'infinity',       title: 'Bots ilimitados',             desc: 'Conecte quantos bots você precisar.' },
    { icon: 'users',          title: 'Leads e clientes ilimitados', desc: 'Sem teto na base.' },
    { icon: 'wallet',         title: 'Sem markup no PIX',           desc: 'Você paga só a taxa do seu gateway.' },
    { icon: 'message-square', title: 'Disparos sem limite extra',   desc: 'Conforme política do Telegram (~30/s por bot).' },
    { icon: 'git-branch',     title: 'Todos os recursos',           desc: 'Nada bloqueado por plano.' },
    { icon: 'shield-check',   title: 'Suporte humano',              desc: 'Time disponível pelo painel.' },
  ]

  return (
    <section id="precos" className="py-20 md:py-28 relative">
      <div className="corona" style={{ width: 800, height: 800, top: -100, left: '50%', transform: 'translateX(-50%)', opacity: 0.6 }} />
      <div className="relative max-w-4xl mx-auto px-5 md:px-8">
        <Reveal>
        <div className="text-center">
          <SectionEyebrow>Preços</SectionEyebrow>
          <h2 className="mt-2 text-[32px] md:text-[44px] font-bold tracking-tight leading-tight">
            Sem mensalidade.<br />
            <span className="text-grad">Só paga quando vende.</span>
          </h2>
          <p className="mt-4 text-[15px] text-text-muted max-w-xl mx-auto">
            Você não paga nada para criar conta, conectar bots ou configurar funis. A Umbra cobra apenas quando uma venda é processada — e o dinheiro continua caindo direto na sua conta.
          </p>
        </div>
        </Reveal>

        <Reveal delay={150}>
        <div className="mt-12">
          <div
            className="relative bg-surface rounded-2xl p-1"
            style={{ border: '2px solid color-mix(in oklab, var(--accent) 40%, transparent)' }}
          >
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 0%, var(--accent-soft), transparent 70%)', opacity: 0.5 }}
            />
            <div className="relative bg-surface rounded-xl p-7 md:p-10">
              {/* badges */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'color-mix(in oklab, var(--success) 15%, transparent)', color: 'var(--success)' }}>
                  <Check size={10} className="shrink-0" /> Sem mensalidade
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'color-mix(in oklab, var(--success) 15%, transparent)', color: 'var(--success)' }}>
                  <Check size={10} className="shrink-0" /> Sem cartão de crédito
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'color-mix(in oklab, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
                  Modelo único · pay-as-you-sell
                </span>
              </div>

              {/* preço principal */}
              <div className="flex items-end gap-4 flex-wrap">
                <div className="flex items-start leading-none">
                  <span className="text-[28px] font-bold text-text-muted mt-3 mr-1">R$</span>
                  <span className="text-[88px] md:text-[100px] font-black tnum tracking-tighter leading-none text-text">1</span>
                  <span className="text-[36px] font-black tnum text-text mt-4">,00</span>
                </div>
                <div className="pb-2">
                  <div className="text-[17px] font-bold text-text">fixo por transação</div>
                  <div className="text-[13px] text-text-muted mt-0.5">independente do valor da venda</div>
                </div>
              </div>

              {/* exemplos */}
              <div className="mt-6 rounded-xl p-4 space-y-2.5" style={{ background: 'color-mix(in oklab, var(--surface-2) 60%, transparent)', border: '1px solid var(--border)' }}>
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-3">Veja na prática</div>
                {[
                  { sell: 'R$ 47,00',   pay: 'R$ 1,00', keep: 'R$ 46,00',  pct: '97,9%' },
                  { sell: 'R$ 97,00',   pay: 'R$ 1,00', keep: 'R$ 96,00',  pct: '99,0%' },
                  { sell: 'R$ 197,00',  pay: 'R$ 1,00', keep: 'R$ 196,00', pct: '99,5%' },
                  { sell: 'R$ 997,00',  pay: 'R$ 1,00', keep: 'R$ 996,00', pct: '99,9%' },
                ].map((ex) => (
                  <div key={ex.sell} className="flex items-center justify-between gap-2 text-[13px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-text shrink-0">Venda de {ex.sell}</span>
                      <ChevronRight size={13} className="shrink-0 text-text-subtle" />
                      <span className="text-text-muted shrink-0">paga</span>
                      <span className="font-bold shrink-0" style={{ color: 'var(--accent)' }}>{ex.pay}</span>
                    </div>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'color-mix(in oklab, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                      fica {ex.pct}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-border text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>
                  Quanto mais vende, mais você economiza em relação a qualquer percentual.
                </div>
              </div>

              {/* benefícios */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                {benefits.map((b) => (
                  <div key={b.title} className="flex items-start gap-2.5 p-3 bg-surface-2/50 border border-border rounded-lg">
                    <Icon name={b.icon} size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-text">{b.title}</div>
                      <div className="text-[11.5px] text-text-muted leading-snug">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="/login?mode=signup"
                className="mt-8 w-full inline-flex h-12 items-center justify-center gap-2 rounded-md text-[14.5px] font-semibold hover:opacity-90 focus-ring transition-colors"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Criar conta grátis agora
                <ArrowRight size={16} className="shrink-0" />
              </a>
            </div>
          </div>
        </div>
        </Reveal>

        <Reveal delay={250}>
        <div className="mt-12 bg-surface border border-border rounded-2xl p-6 md:p-7">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-3">Por que isso muda o jogo</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={14} className="shrink-0" style={{ color: 'var(--danger)' }} />
                <div className="text-[13px] font-semibold text-text">O modelo das outras ferramentas</div>
              </div>
              <ul className="space-y-2 text-[12.5px] text-text-muted leading-relaxed">
                <li className="flex items-start gap-2"><X size={11} className="shrink-0 mt-1" style={{ color: 'var(--danger)' }} /> Cobram mensalidade fixa, vendendo ou não</li>
                <li className="flex items-start gap-2"><X size={11} className="shrink-0 mt-1" style={{ color: 'var(--danger)' }} /> Retêm percentual + cobram mensalidade junto</li>
                <li className="flex items-start gap-2"><X size={11} className="shrink-0 mt-1" style={{ color: 'var(--danger)' }} /> Travam recursos atrás de planos avançados</li>
                <li className="flex items-start gap-2"><X size={11} className="shrink-0 mt-1" style={{ color: 'var(--danger)' }} /> Mistura confusa de taxas — você nunca sabe quanto sobra</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />
                <div className="text-[13px] font-semibold text-text">O modelo Umbra</div>
              </div>
              <ul className="space-y-2 text-[12.5px] text-text leading-relaxed">
                <li className="flex items-start gap-2"><Check size={11} className="shrink-0 mt-1" style={{ color: 'var(--accent)' }} /> Sem mensalidade — começar é R$ 0</li>
                <li className="flex items-start gap-2"><Check size={11} className="shrink-0 mt-1" style={{ color: 'var(--accent)' }} /> Você paga só quando uma venda acontece</li>
                <li className="flex items-start gap-2"><Check size={11} className="shrink-0 mt-1" style={{ color: 'var(--accent)' }} /> Todos os recursos liberados desde o dia 1</li>
                <li className="flex items-start gap-2"><Check size={11} className="shrink-0 mt-1" style={{ color: 'var(--accent)' }} /> Dinheiro vai direto pro seu gateway — sem markup</li>
              </ul>
            </div>
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── FAQ ────────────────────────────────────────────────── */
const faqs = [
  { q: 'Vou pagar mensalidade?',                    a: 'Não. A Umbra Bot não tem mensalidade. Você só paga quando uma venda é processada pelo bot — R$ 1,00 fixo por venda, independente do valor que você cobrar. Se não vender, não paga nada.' },
  { q: 'Como eu recebo o dinheiro?',                a: 'Você conecta o seu próprio gateway de PIX dentro do painel. A partir daí, todo pagamento confirmado cai diretamente na sua conta bancária pelo gateway que você escolheu. A Umbra não retém, não intermedia, não cobra markup.' },
  { q: 'Quantos bots eu posso criar?',              a: 'Quantos você quiser. Não há limite no número de bots, leads ou clientes. Você pode conectar um bot por produto, por nicho, por canal — como fizer mais sentido para a sua operação.' },
  { q: 'Quais gateways de pagamento são suportados?', a: 'A lista atualizada de gateways suportados pode ser consultada dentro do painel após criar conta. Os principais gateways brasileiros que processam PIX para infoprodutores estão integrados.' },
  { q: 'Preciso saber programar?',                  a: 'Não. O editor visual de fluxos foi feito para quem não escreve código. Você arrasta blocos (mensagem, condição, espera, oferta, upsell, tag) e conecta entre si para montar o funil. Em poucos minutos seu primeiro fluxo está no ar.' },
  { q: 'O bot funciona 24 horas mesmo?',            a: 'Sim. Uma vez configurado, o bot atende, cobra, confirma o PIX e libera o acesso sozinho, todos os dias, a qualquer hora. Você só recebe os alertas de venda no seu painel e no canal de notificação que escolher.' },
  { q: 'E se um cliente gerar PIX e não pagar?',   a: 'O Remarketing automático dispara mensagens de lembrete para o cliente que gerou o QR Code mas não pagou. Você define o tempo (1 h, 24 h, etc.) e o que falar em cada etapa.' },
  { q: 'Posso testar antes de pagar qualquer coisa?', a: 'A conta é grátis e você só paga quando uma venda é efetivada. Crie a conta, conecte um bot de teste e veja o painel inteiro funcionando sem compromisso.' },
]

function FAQ() {
  const [open, setOpen] = useState<number>(0)
  return (
    <section id="faq" className="py-20 md:py-28 border-y border-border" style={{ background: 'color-mix(in oklab, var(--surface) 40%, transparent)' }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <Reveal>
        <div className="text-center">
          <SectionEyebrow>Perguntas frequentes</SectionEyebrow>
          <h2 className="mt-2 text-[28px] md:text-[40px] font-bold tracking-tight leading-tight">
            As dúvidas que todo mundo tem.
          </h2>
        </div>
        </Reveal>

        <Reveal delay={150}>
        <div className="mt-10 space-y-2">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpen((cur) => (cur === i ? -1 : i))}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-surface-2/40 focus-ring"
                >
                  <span className="text-[14px] font-semibold text-text pr-2">{f.q}</span>
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: isOpen ? 'var(--accent)' : 'var(--surface-2)',
                      color: isOpen ? 'var(--accent-fg)' : 'var(--text-muted)',
                    }}
                  >
                    {isOpen ? <Minus size={13} className="shrink-0" /> : <Plus size={13} className="shrink-0" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-[13.5px] text-text-muted leading-relaxed max-w-2xl">
                    {f.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── FinalCTA ───────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      <div className="corona" style={{ width: 1000, height: 1000, top: -200, left: '50%', transform: 'translateX(-50%)', opacity: 0.7 }} />
      <div className="relative max-w-3xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-2xl px-5 py-2.5"
            style={{
              background: '#0E0F13',
              border: '1px solid rgba(124,92,255,0.30)',
              boxShadow: '0 0 32px -8px rgba(124,92,255,0.35)',
            }}>
            <svg viewBox="0 0 100 100" width="26" height="26" aria-hidden="true">
              <path d="M 18 18 V 60 A 32 32 0 0 0 82 60 V 18 H 64 V 60 A 14 14 0 0 1 36 60 V 18 Z" fill="#f4f4f8" />
              <rect x="14" y="42" width="72" height="3.5" rx="2" fill="#7C5CFF" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: '19px', letterSpacing: '-0.5px', color: '#f4f4f8', lineHeight: 1 }}>
              umbra<span style={{ color: '#7C5CFF' }}>.</span>bot
            </span>
          </div>
        </div>
        <h2 className="text-[32px] md:text-[52px] font-bold tracking-tight leading-[1.05]">
          Pare de operar.<br />
          <span className="text-grad">Comece a faturar.</span>
        </h2>
        <p className="mt-5 text-[16px] md:text-[17px] text-text-muted max-w-xl mx-auto leading-relaxed">
          O Umbra Bot atende, cobra e entrega — você fica livre pra criar, vender mais e dormir tranquilo. Crie sua conta agora, é grátis.
        </p>
        </Reveal>

        <Reveal delay={200}>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/login?mode=signup"
            className="inline-flex h-12 px-6 items-center justify-center gap-2 rounded-md text-[15px] font-bold hover:opacity-90 focus-ring transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)', boxShadow: '0 10px 40px -8px var(--accent-soft)' }}
          >
            Criar conta grátis
            <ArrowRight size={16} className="shrink-0" />
          </a>
          <a
            href="/login"
            className="inline-flex h-12 px-5 items-center justify-center gap-2 rounded-md bg-transparent border border-border text-text text-[14.5px] font-medium hover:bg-surface-2 focus-ring transition-colors"
          >
            Já tenho conta
          </a>
        </div>

        <div className="mt-5 text-[12px] text-text-muted">
          Sem cartão de crédito · Sem mensalidade · Cancela quando quiser
        </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── Footer ─────────────────────────────────────────────── */
function FooterCol({ title, links }: {
  title: string
  links: { label: string; href: string; mono?: boolean }[]
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-3">{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className={`text-[12.5px] text-text-muted hover:text-text ${l.mono ? 'font-mono' : ''}`}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <UmbraLogo />
            <p className="mt-4 text-[12.5px] text-text-muted leading-relaxed max-w-xs">
              Automação de vendas no Telegram. Para criadores que querem parar de operar e começar a faturar.
            </p>
          </div>

          <FooterCol title="Produto" links={[
            { label: 'Recursos',      href: '#recursos'     },
            { label: 'Gateways',      href: '#gateways'     },
            { label: 'Preços',        href: '#precos'       },
            { label: 'Como funciona', href: '#como-funciona' },
          ]} />

          <FooterCol title="Recursos" links={[
            { label: 'Documentação', href: '/docs'      },
            { label: 'Status',       href: '/status'    },
            { label: 'Changelog',    href: '/changelog' },
            { label: 'Roadmap',      href: '/roadmap'   },
          ]} />

          <FooterCol title="Empresa" links={[
            { label: 'Termos de uso', href: '/termos'      },
            { label: 'Privacidade',   href: '/privacidade' },
            { label: 'Suporte',       href: '/contato'     },
            { label: 'Contato',       href: '/contato'     },
          ]} />
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11.5px] text-text-subtle">
          <div>© 2026 Umbra Bot · Todos os direitos reservados.</div>
          <div className="flex items-center gap-4">
            <a href="#x"         className="hover:text-text-muted">X / Twitter</a>
            <a href="#instagram" className="hover:text-text-muted">Instagram</a>
            <a href="#telegram"  className="hover:text-text-muted">Telegram</a>
            <a href="#youtube"   className="hover:text-text-muted">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ─── Page ───────────────────────────────────────────────── */
export default function LandingPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const currentTheme = mounted ? (theme ?? 'dark') : 'dark'
  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }, [currentTheme, setTheme])

  return (
    <div className="lp bg-bg text-text relative overflow-x-hidden">
      <Header theme={currentTheme} toggleTheme={toggleTheme} mounted={mounted} />
      <ScrollProgress />
      <main>
        <Hero />
        <SaleTickerSection />
        <Highlights />
        <BeforeAfter />
        <Features />
        <HowItWorks />
        <Integrations />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
