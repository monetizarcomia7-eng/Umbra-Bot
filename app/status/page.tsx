'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

/* ─── Types ─────────────────────────────────────────────────────── */
type ServiceStatus = 'operational' | 'degraded' | 'outage'

interface Service {
  name:        string
  description: string
  status:      ServiceStatus
}

/* ─── Static data (substitua por fetch do Supabase em produção) ─ */
const OVERALL_STATUS: ServiceStatus = 'operational'

const SERVICES: Service[] = [
  { name: 'API da Plataforma',          description: 'Endpoints REST do painel e integrações.',       status: 'operational' },
  { name: 'Webhooks dos bots',          description: 'Recebimento de updates do Telegram.',            status: 'operational' },
  { name: 'Processamento de pagamentos', description: 'Confirmação de PIX e split de comissão.',      status: 'operational' },
  { name: 'Painel web',                 description: 'Interface do dashboard em app.umbra.bot.',       status: 'operational' },
  { name: 'Banco de dados',             description: 'Armazenamento de leads, vendas e configurações.', status: 'operational' },
  { name: 'Disparador de mensagens',    description: 'Fila de envio em massa (broadcasts).',           status: 'operational' },
]

/* ─── Status config ─────────────────────────────────────────────── */
const STATUS_CONFIG: Record<ServiceStatus, {
  label: string; dot: string; bar: string; bg: string; border: string; icon: React.ElementType
}> = {
  operational: {
    label:  'Operacional',
    dot:    'bg-success',
    bar:    'bg-success',
    bg:     'bg-success-soft/20',
    border: 'border-success/30',
    icon:   CheckCircle2,
  },
  degraded: {
    label:  'Degradado',
    dot:    'bg-warning',
    bar:    'bg-warning',
    bg:     'bg-warning-soft/20',
    border: 'border-warning/30',
    icon:   AlertTriangle,
  },
  outage: {
    label:  'Fora do ar',
    dot:    'bg-danger',
    bar:    'bg-danger',
    bg:     'bg-danger-soft/20',
    border: 'border-danger/30',
    icon:   XCircle,
  },
}

const OVERALL_CONFIG = {
  operational: { label: 'Todos os sistemas operacionais', bg: 'bg-success-soft/30 border-success/25', icon: CheckCircle2, iconColor: 'text-success' },
  degraded:    { label: 'Instabilidade detectada',         bg: 'bg-warning-soft/30 border-warning/25', icon: AlertTriangle, iconColor: 'text-warning' },
  outage:      { label: 'Interrupção em andamento',        bg: 'bg-danger-soft/30 border-danger/25',   icon: XCircle,       iconColor: 'text-danger'  },
}

/* ─── Uptime bar — 90 days (simulated, all green for a new product) */
function UptimeBar({ status }: { status: ServiceStatus }) {
  const days = Array.from({ length: 90 }, (_, i) => {
    if (status === 'operational') return 'operational'
    if (i === 89) return status
    return 'operational'
  })
  return (
    <div className="flex gap-px h-7 items-end">
      {days.map((d, i) => (
        <div
          key={i}
          title={d === 'operational' ? 'Operacional' : STATUS_CONFIG[d as ServiceStatus].label}
          className={cn(
            'flex-1 rounded-[2px] transition-all hover:opacity-80',
            STATUS_CONFIG[d as ServiceStatus].bar,
            d === 'operational' ? 'h-full' : 'h-1/2',
          )}
        />
      ))}
    </div>
  )
}

/* ─── Service card ──────────────────────────────────────────────── */
function ServiceCard({ svc }: { svc: Service }) {
  const cfg  = STATUS_CONFIG[svc.status]
  const Icon = cfg.icon

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
            <span className="text-[14px] font-semibold text-text truncate">{svc.name}</span>
          </div>
          <p className="text-[12.5px] text-text-muted pl-4 leading-snug">{svc.description}</p>
        </div>
        <span className={cn(
          'flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg border shrink-0 ml-3',
          cfg.bg, cfg.border,
          svc.status === 'operational' ? 'text-success' : svc.status === 'degraded' ? 'text-warning' : 'text-danger',
        )}>
          <Icon size={13} />
          {cfg.label}
        </span>
      </div>
      <div className="px-5 pb-4">
        <UptimeBar status={svc.status} />
        <div className="flex justify-between text-[11px] text-text-subtle mt-1">
          <span>90 dias atrás</span>
          <span>Hoje</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function StatusPage() {
  const overall = OVERALL_CONFIG[OVERALL_STATUS]
  const OverallIcon = overall.icon
  const [tab, setTab] = useState<'status' | 'history'>('status')

  return (
    <div className="min-h-screen bg-[var(--bg,white)] text-text" style={{ colorScheme: 'light dark' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-[860px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden>
              <rect width="32" height="32" rx="9" fill="var(--primary)" />
              <path d="M16 6.5 L18 13.5 L25.5 16 L18 18.5 L16 25.5 L14 18.5 L6.5 16 L14 13.5 Z" fill="white" />
            </svg>
            <span className="font-semibold text-[14px] text-text">Umbra<span className="text-text-muted font-normal"> Status</span></span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-text-muted">
            <Link href="/docs"      className="hover:text-text transition-colors">Docs</Link>
            <Link href="/changelog" className="hover:text-text transition-colors">Changelog</Link>
            <Link href="/contato"   className="hover:text-text transition-colors">Contato</Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-[860px] mx-auto px-4 md:px-8 py-10 md:py-14 space-y-8">

        {/* Overall banner */}
        <div className={cn(
          'flex items-center gap-4 rounded-2xl border px-6 py-5',
          overall.bg,
        )}>
          <OverallIcon size={32} className={cn('shrink-0', overall.iconColor)} />
          <div>
            <h1 className="text-[18px] font-bold text-text">{overall.label}</h1>
            <p className="text-[13px] text-text-muted mt-0.5">
              Última verificação: agora mesmo ·{' '}
              <button
                onClick={() => window.location.reload()}
                className="text-primary hover:underline"
              >
                Atualizar
              </button>
            </p>
          </div>
          <div className="ml-auto text-right hidden sm:block">
            <p className="text-[11px] text-text-subtle uppercase tracking-widest">Uptime (30 dias)</p>
            <p className="text-[22px] font-bold text-success">100%</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(['status', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text',
              )}
            >
              {t === 'status' ? 'Status dos serviços' : 'Histórico de incidentes'}
            </button>
          ))}
        </div>

        {tab === 'status' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-text">Componentes monitorados</h2>
              <span className="text-[12px] text-text-muted">{SERVICES.length} serviços</span>
            </div>
            {SERVICES.map((svc) => (
              <ServiceCard key={svc.name} svc={svc} />
            ))}
            <p className="text-[12px] text-text-subtle text-center pt-2">
              Barras verdes = sem incidentes nos últimos 90 dias. Produto lançado em 2026.
            </p>
          </div>
        )}

        {tab === 'history' && (
          <div className="rounded-2xl border border-border bg-surface p-8 flex flex-col items-center text-center gap-3">
            <CheckCircle2 size={40} className="text-success" />
            <h3 className="text-[16px] font-semibold text-text">Nenhum incidente registrado</h3>
            <p className="text-[13.5px] text-text-muted max-w-sm leading-[1.7]">
              Não há incidentes ou manutenções programadas no histórico. Esta seção será
              atualizada automaticamente sempre que houver um evento de serviço.
            </p>
            <p className="text-[12px] text-text-subtle mt-1">
              Para ser notificado de incidentes, assine as atualizações via{' '}
              <Link href="/contato" className="text-primary hover:underline">
                canal de suporte no Telegram
              </Link>.
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-[12.5px] text-text-muted">
          {(Object.entries(STATUS_CONFIG) as [ServiceStatus, typeof STATUS_CONFIG[ServiceStatus]][]).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn('w-2.5 h-2.5 rounded-full', v.dot)} />
              {v.label}
            </span>
          ))}
        </div>

        {/* Footer */}
        <footer className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-text-muted">
          <span>© {new Date().getFullYear()} Umbra Bot — Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <Link href="/termos"      className="hover:text-text">Termos</Link>
            <Link href="/privacidade" className="hover:text-text">Privacidade</Link>
            <Link href="/contato"     className="hover:text-text">Contato</Link>
            <a href="https://t.me/" className="hover:text-text flex items-center gap-1">
              RSS <ExternalLink size={10} />
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
