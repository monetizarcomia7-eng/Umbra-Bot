'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  Zap, Send, CheckCircle2, Target, Clock, Hash, ExternalLink,
  Eye, EyeOff, AlertCircle, RefreshCw, ArrowUpRight, ArrowDownRight,
  Link2, Instagram, MessageSquare, ShoppingBag, ChevronRight,
  Check, X, Circle, BookOpen, Copy, Activity, Pencil, Plug, XCircle,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

interface EventDef { id: string; label: string; desc: string }

interface Pixel {
  id: string
  name: string
  fullName: string
  description: string
  docsUrl: string
  initial: string
  color: string
  pixelId: string | null
  accessToken: string | null
  status: 'healthy' | 'warning' | 'error' | 'inactive'
  eventsSentToday: number
  eventsMatched: number
  lastEvent: number | null
  events: Record<string, boolean>
  capi: boolean
}

interface StatusInfo { label: string; tone: string; dot: string; pulse: boolean; desc: string }

interface LogEntry {
  type: 'system' | 'recv'
  text?: string
  status?: 'ok' | 'error' | 'info'
  label?: string
  user?: string
  time?: string
  valid?: boolean
  isTest?: boolean
}

interface Verdict {
  ok: boolean
  message: string
  eventsReceived: number
  avgLatency: number | null
}

/* ============================================================
   Mock data
   ============================================================ */

const NOW_T = new Date('2026-05-18T15:30:00').getTime()

const eventCatalogs: Record<string, EventDef[]> = {
  meta: [
    { id: 'PageView',         label: 'PageView',         desc: 'Quando um usuário entra no fluxo.' },
    { id: 'ViewContent',      label: 'ViewContent',      desc: 'Visualização de produto / oferta.' },
    { id: 'Lead',             label: 'Lead',             desc: 'Lead capturado (nome ou e-mail).' },
    { id: 'AddToCart',        label: 'AddToCart',        desc: 'Adicionou produto ao carrinho.' },
    { id: 'InitiateCheckout', label: 'InitiateCheckout', desc: 'Iniciou checkout no gateway.' },
    { id: 'Purchase',         label: 'Purchase',         desc: 'Venda concluída — envia valor + moeda.' },
  ],
  tiktok: [
    { id: 'PageView',          label: 'PageView',          desc: 'Visualização inicial.' },
    { id: 'ViewContent',       label: 'ViewContent',       desc: 'Visualizou um produto.' },
    { id: 'AddToCart',         label: 'AddToCart',         desc: 'Adicionou ao carrinho.' },
    { id: 'InitiateCheckout',  label: 'InitiateCheckout',  desc: 'Iniciou checkout.' },
    { id: 'CompletePayment',   label: 'CompletePayment',   desc: 'Pagamento confirmado.' },
    { id: 'SubscribeLead',     label: 'SubscribeLead',     desc: 'Lead capturado.' },
  ],
  google: [
    { id: 'page_view',      label: 'page_view',      desc: 'Visualização de página/fluxo.' },
    { id: 'view_item',      label: 'view_item',      desc: 'Visualizou produto/oferta.' },
    { id: 'add_to_cart',    label: 'add_to_cart',    desc: 'Adicionou ao carrinho.' },
    { id: 'begin_checkout', label: 'begin_checkout', desc: 'Iniciou checkout.' },
    { id: 'purchase',       label: 'purchase',       desc: 'Compra concluída.' },
    { id: 'generate_lead',  label: 'generate_lead',  desc: 'Lead capturado.' },
  ],
}

const MOCK_PIXELS: Pixel[] = [
  {
    id: 'meta', name: 'Meta', fullName: 'Meta Pixel (Facebook + Instagram)',
    description: 'Eventos do Facebook/Instagram Ads via Conversions API.', docsUrl: '#',
    initial: 'f', color: 'oklch(0.55 0.18 260)',
    pixelId: '983201548720394', accessToken: 'EAA*****',
    status: 'healthy', eventsSentToday: 1284, eventsMatched: 1148,
    lastEvent: NOW_T - 2 * 60 * 1000,
    events: Object.fromEntries(eventCatalogs.meta.map((e) => [e.id, ['PageView', 'ViewContent', 'Lead', 'Purchase'].includes(e.id)])),
    capi: true,
  },
  {
    id: 'tiktok', name: 'TikTok', fullName: 'TikTok Pixel',
    description: 'Eventos do TikTok Ads via Events API.', docsUrl: '#',
    initial: 't', color: 'oklch(0.42 0.04 180)',
    pixelId: 'CDABCDEFG12345', accessToken: 'ttk_*****',
    status: 'warning', eventsSentToday: 184, eventsMatched: 102,
    lastEvent: NOW_T - 38 * 60 * 1000,
    events: Object.fromEntries(eventCatalogs.tiktok.map((e) => [e.id, ['PageView', 'CompletePayment'].includes(e.id)])),
    capi: true,
  },
  {
    id: 'google', name: 'Google', fullName: 'Google Tag (GA4 + Ads)',
    description: 'Eventos para Google Analytics 4 e Google Ads via Measurement Protocol.', docsUrl: '#',
    initial: 'G', color: 'oklch(0.66 0.15 60)',
    pixelId: null, accessToken: null,
    status: 'inactive', eventsSentToday: 0, eventsMatched: 0, lastEvent: null,
    events: Object.fromEntries(eventCatalogs.google.map((e) => [e.id, false])),
    capi: false,
  },
]

const statusMapT: Record<string, StatusInfo> = {
  healthy:  { label: 'Saudável',        tone: 'success', dot: 'bg-green-500',   pulse: true,  desc: 'Eventos chegando em tempo real.' },
  warning:  { label: 'Volume baixo',    tone: 'warning', dot: 'bg-yellow-500',  pulse: false, desc: 'Eventos sem chegar há mais de 30 min.' },
  error:    { label: 'Sem eventos',     tone: 'danger',  dot: 'bg-red-500',     pulse: false, desc: 'Nenhum evento recebido há mais de 1h.' },
  inactive: { label: 'Não configurado', tone: 'muted',   dot: 'bg-[var(--text-muted)]', pulse: false, desc: 'Aguardando ID do pixel.' },
}

/* ============================================================
   Helpers
   ============================================================ */

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtPct = (n: number, d = 0) => n.toFixed(d).replace('.', ',') + '%'
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

function relTimeT(dt: number | null) {
  if (!dt) return '—'
  const diff = NOW_T - dt
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  return fmtDate(dt)
}

/* ============================================================
   Micro components
   ============================================================ */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function CheckboxInline({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${checked ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50'}`}
    >
      {checked && <Check size={10} className="text-white" />}
    </button>
  )
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    danger:  'bg-red-500/10 text-red-600 dark:text-red-400',
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    muted:   'bg-[var(--surface-2)] text-[var(--text-muted)]',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium ${cls[tone] ?? cls.muted}`}>
      {children}
    </span>
  )
}

function PixelLogo({ pixel, size = 44 }: { pixel: Pixel; size?: number }) {
  return (
    <div
      className="rounded-xl flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: pixel.color, fontSize: size * 0.5, letterSpacing: '-0.04em' }}
    >
      {pixel.initial}
    </div>
  )
}

function StatT({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">{label}</div>
      <div className={[
        'text-[13px] font-semibold tracking-tight mt-0.5',
        tone === 'success' ? 'text-green-500' : tone === 'warning' ? 'text-yellow-500' : tone === 'muted' ? 'text-[var(--text-muted)]' : 'text-[var(--text)]',
      ].join(' ')}>{value}</div>
    </div>
  )
}

function FieldT({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">{hint}</div>}
    </div>
  )
}

const inputClsTr = 'w-full h-10 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50'

/* ============================================================
   KPI
   ============================================================ */

function KpiTr({ label, value, sub, icon: Icon_, delta, tone, highlight }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  delta?: number; tone?: string; highlight?: boolean
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-[var(--text-muted)] font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tone === 'primary' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : highlight ? 'bg-green-500/10 text-green-500' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}>
          <Icon_ size={14} />
        </div>
      </div>
      <div className={`text-[24px] font-semibold tracking-tight leading-none ${highlight ? 'text-green-500' : 'text-[var(--text)]'}`}>{value}</div>
      <div className="flex items-center gap-2 mt-2.5">
        {delta !== undefined && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium text-[11px] ${positive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {fmtPct(Math.abs(delta))}
          </span>
        )}
        {sub && <span className="text-[11.5px] text-[var(--text-muted)]">{sub}</span>}
      </div>
    </div>
  )
}

/* ============================================================
   Pixel Card
   ============================================================ */

function PixelCard({ pixel, onEdit, onCheck }: { pixel: Pixel; onEdit: (p: Pixel) => void; onCheck: (p: Pixel) => void }) {
  const st = statusMapT[pixel.status]
  const enabledCount = Object.values(pixel.events).filter(Boolean).length
  const total = Object.keys(pixel.events).length
  const matchRate = pixel.eventsSentToday > 0 ? (pixel.eventsMatched / pixel.eventsSentToday) * 100 : 0

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--text-muted)]/40 transition-colors flex flex-col">
      <div className="flex items-start gap-3.5">
        <PixelLogo pixel={pixel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14.5px] font-semibold text-[var(--text)]">{pixel.name}</h3>
            <Badge tone={st.tone}>
              {st.pulse && (
                <span className={`relative w-1.5 h-1.5 rounded-full ${st.dot}`}>
                  <span className={`absolute inset-0 rounded-full ${st.dot} animate-ping opacity-60`} />
                </span>
              )}
              {st.label}
            </Badge>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-snug">{pixel.description}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        {pixel.pixelId ? (
          <div className="flex items-center gap-2 bg-[var(--surface-2)]/50 border border-[var(--border)] rounded-md px-2.5 py-1.5">
            <Hash size={11} className="text-[var(--text-muted)] shrink-0" />
            <span className="text-[10.5px] text-[var(--text-muted)] shrink-0">ID:</span>
            <code className="text-[11.5px] font-mono text-[var(--text)] truncate flex-1">{pixel.pixelId}</code>
            {pixel.capi && <Badge tone="primary">CAPI</Badge>}
          </div>
        ) : (
          <div className="text-[11.5px] text-[var(--text-muted)] italic flex items-center gap-1.5">
            <Circle size={9} />
            Sem ID configurado
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-[var(--border)]">
        <StatT label="Eventos ativos" value={`${enabledCount}/${total}`} />
        <StatT label="Enviados (24h)"  value={pixel.eventsSentToday > 0 ? fmtNum(pixel.eventsSentToday) : '—'} />
        <StatT label="Match rate"
          value={pixel.eventsSentToday > 0 ? fmtPct(matchRate, 1) : '—'}
          tone={matchRate >= 85 ? 'success' : matchRate > 0 ? 'warning' : 'muted'}
        />
      </div>

      <div className="text-[11px] text-[var(--text-muted)] mt-3 flex items-center gap-1.5">
        <Clock size={11} />
        Último evento: <span className="text-[var(--text)]">{relTimeT(pixel.lastEvent)}</span>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2">
        {pixel.pixelId ? (
          <>
            <button
              onClick={() => onCheck(pixel)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              <Activity size={13} />
              Verificar pixel
            </button>
            <button
              onClick={() => onEdit(pixel)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Pencil size={13} />
              Editar
            </button>
          </>
        ) : (
          <button
            onClick={() => onEdit(pixel)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
          >
            <Plug size={13} />
            Configurar {pixel.name}
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Edit Pixel Modal
   ============================================================ */

function EditPixelModal({ open, onClose, pixel, onSave }: {
  open: boolean; onClose: () => void; pixel: Pixel | null; onSave: (id: string, patch: Partial<Pixel>) => void
}) {
  const [pixelId, setPixelId]     = useState('')
  const [accessToken, setToken]   = useState('')
  const [events, setEvents]       = useState<Record<string, boolean>>({})
  const [capi, setCapi]           = useState(true)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    if (open && pixel) {
      setPixelId(pixel.pixelId || '')
      setToken(pixel.accessToken || '')
      setEvents({ ...pixel.events })
      setCapi(pixel.capi)
      setShowToken(false)
    }
  }, [open, pixel])

  if (!pixel) return null
  const catalog = eventCatalogs[pixel.id] ?? []
  const enabledCount = Object.values(events).filter(Boolean).length

  function toggleAll(value: boolean) {
    const next: Record<string, boolean> = {}
    catalog.forEach((e) => { next[e.id] = value })
    setEvents(next)
  }

  function save() {
    const status: Pixel['status'] = pixelId ? (pixel!.eventsSentToday > 0 ? 'healthy' : 'warning') : 'inactive'
    onSave(pixel!.id, { pixelId: pixelId.trim() || null, accessToken: accessToken.trim() || null, events, capi, status })
    onClose()
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              {pixel.pixelId ? `Editar ${pixel.fullName}` : `Configurar ${pixel.fullName}`}
            </h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              {pixel.pixelId ? 'Atualize o ID do pixel e os eventos disparados.' : 'Cole o ID e ative os eventos que devem ser enviados.'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg">
            <PixelLogo pixel={pixel} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--text)]">{pixel.fullName}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{pixel.description}</div>
            </div>
            <a href={pixel.docsUrl} className="text-[11.5px] text-[var(--primary)] hover:underline inline-flex items-center gap-1 shrink-0">
              <ExternalLink size={11} />
              Como obter
            </a>
          </div>

          <FieldT
            label={pixel.id === 'google' ? 'ID de medição GA4' : pixel.id === 'tiktok' ? 'TikTok Pixel ID' : 'Meta Pixel ID'}
            hint={pixel.id === 'google' ? 'Formato: G-XXXXXXXXXX (não confundir com o ID de stream).' : pixel.id === 'tiktok' ? 'Encontre em Ads Manager → Ativos → Eventos.' : 'Encontre no Gerenciador de Eventos do Meta.'}
          >
            <input
              type="text"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder={pixel.id === 'google' ? 'G-XXXXXXXXXX' : pixel.id === 'tiktok' ? 'CXXXXXXXXX' : '123456789012345'}
              autoFocus
              className={inputClsTr + ' font-mono'}
            />
          </FieldT>

          <FieldT
            label="Token de acesso da API (opcional, mas recomendado)"
            hint="Necessário para enviar eventos server-side (CAPI) e atribuir vendas reais. Não trafega no navegador."
          >
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setToken(e.target.value)}
                placeholder={pixel.id === 'meta' ? 'EAAxxxxxxxx' : pixel.id === 'tiktok' ? 'ttk_xxxxxx' : 'API_SECRET_xxx'}
                className={inputClsTr + ' font-mono pr-10'}
              />
              <button
                onClick={() => setShowToken((s) => !s)}
                type="button"
                tabIndex={-1}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </FieldT>

          <div className="flex items-start justify-between gap-3 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg p-3">
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[var(--text)]">Envio server-side (CAPI)</div>
              <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5 leading-snug">Envia eventos pela API server-side além do pixel client. Aumenta o match rate.</div>
            </div>
            <Toggle checked={capi} onChange={setCapi} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[12.5px] font-medium text-[var(--text)]">Eventos enviados ({enabledCount}/{catalog.length})</label>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={() => toggleAll(true)}  className="text-[var(--primary)] hover:underline">Ativar todos</button>
                <span className="text-[var(--text-muted)]">·</span>
                <button onClick={() => toggleAll(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">Limpar</button>
              </div>
            </div>
            <div className="space-y-1.5">
              {catalog.map((e) => (
                <label key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)]/50 cursor-pointer">
                  <CheckboxInline checked={!!events[e.id]} onChange={() => setEvents((v) => ({ ...v, [e.id]: !v[e.id] }))} />
                  <code className="text-[11.5px] font-mono text-[var(--text)] font-medium shrink-0 min-w-[140px]">{e.label}</code>
                  <span className="flex-1 text-[11.5px] text-[var(--text-muted)] truncate">{e.desc}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!pixelId.trim()}
            className="h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Check size={14} />
            Salvar configuração
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Verify Pixel Modal
   ============================================================ */

function LogLine({ log }: { log: LogEntry }) {
  if (log.type === 'system') {
    return (
      <div className="px-3 py-1.5 flex items-center gap-2">
        {log.status === 'ok'    ? <Check  size={10} className="text-green-500" /> :
         log.status === 'error' ? <X      size={10} className="text-red-500" />   :
                                  <Circle size={10} className="text-[var(--text-muted)]" />}
        <span className="text-[var(--text)]">{log.text}</span>
      </div>
    )
  }
  if (log.type === 'recv') {
    return (
      <div className="px-3 py-1.5 flex items-center gap-2">
        <Zap size={10} className={log.valid ? 'text-green-500' : 'text-red-500'} />
        <span className="text-green-500 font-semibold">RECV</span>
        <code className="text-[var(--text)]">{log.label}</code>
        {log.isTest && <Badge tone="primary">teste</Badge>}
        <span className="ml-auto text-[var(--text-muted)]">{log.user} · {log.time}</span>
      </div>
    )
  }
  return null
}

function VerifyPixelModal({ open, onClose, pixel }: { open: boolean; onClose: () => void; pixel: Pixel | null }) {
  const [running, setRunning]     = useState(false)
  const [logs, setLogs]           = useState<LogEntry[]>([])
  const [verdict, setVerdict]     = useState<Verdict | null>(null)
  const [sentTest, setSentTest]   = useState(false)

  useEffect(() => {
    if (open && pixel) {
      setRunning(false)
      setLogs([])
      setVerdict(null)
      setSentTest(false)
      if (pixel.pixelId) setTimeout(() => startVerify(pixel), 200)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pixel])

  function startVerify(px?: Pixel) {
    const p = px ?? pixel
    if (!p || !p.pixelId) return
    setRunning(true)
    setLogs([])
    setVerdict(null)

    const catalog = eventCatalogs[p.id] ?? []
    const activeEvents = catalog.filter((e) => p.events[e.id])
    const baseDelay = 600
    const seedEvents: LogEntry[] = [
      { type: 'system', text: `Conectando ao endpoint do ${p.name}…`, status: 'info' },
      { type: 'system', text: `Pixel ID validado: ${p.pixelId}`, status: 'ok' },
      { type: 'system', text: p.capi ? 'CAPI ativo · enviando server-side' : 'Apenas pixel client', status: 'info' },
    ]
    const recvEvents: LogEntry[] = p.status === 'inactive' ? [] : (activeEvents.length > 0 ? [
      { type: 'recv', label: activeEvents[0]?.label || 'PageView', user: 'usr_a3f2', time: 'há 12 s', valid: true },
      { type: 'recv', label: activeEvents[1]?.label || activeEvents[0]?.label || 'ViewContent', user: 'usr_b8c4', time: 'há 38 s', valid: true },
      { type: 'recv', label: activeEvents[2]?.label || activeEvents[0]?.label || 'Lead', user: 'usr_d1e9', time: 'há 1 min', valid: true },
    ] : [])

    let cumulative = 0
    seedEvents.forEach((ev) => {
      cumulative += baseDelay
      setTimeout(() => setLogs((l) => [...l, ev]), cumulative)
    })
    recvEvents.forEach((ev) => {
      cumulative += baseDelay
      setTimeout(() => setLogs((l) => [...l, ev]), cumulative)
    })
    cumulative += 400
    setTimeout(() => {
      const ok = recvEvents.length > 0 && p.status !== 'error'
      setVerdict({
        ok,
        message: ok
          ? `${p.name} está saudável — ${recvEvents.length} eventos válidos nos últimos minutos.`
          : `${p.name} não está recebendo eventos. Verifique o ID e o token de acesso.`,
        eventsReceived: recvEvents.length,
        avgLatency: ok ? Math.floor(180 + Math.random() * 200) : null,
      })
      setRunning(false)
    }, cumulative)
  }

  function sendTest() {
    setSentTest(true)
    setLogs((l) => [...l, { type: 'recv', label: 'TestEvent', user: 'verificador', time: 'agora', valid: true, isTest: true }])
    setTimeout(() => setSentTest(false), 1500)
  }

  if (!pixel) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Verificar {pixel.fullName}</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Conferindo se o pixel está recebendo eventos em tempo real.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg p-3">
            <PixelLogo pixel={pixel} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-[var(--text)]">{pixel.fullName}</div>
              <code className="text-[11px] font-mono text-[var(--text-muted)]">{pixel.pixelId || 'sem ID'}</code>
            </div>
            <Badge tone={statusMapT[pixel.status].tone}>{statusMapT[pixel.status].label}</Badge>
          </div>

          {!pixel.pixelId && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-[12px] text-[var(--text)] leading-relaxed">
              <AlertCircle size={13} className="text-yellow-500 mt-0.5 shrink-0" />
              <span>Este pixel ainda não tem ID configurado. Configure antes de verificar.</span>
            </div>
          )}

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Logs em tempo real</div>
              {running && <div className="w-3 h-3 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />}
            </div>
            <div className="font-mono text-[11px] divide-y divide-[var(--border)] max-h-[280px] overflow-y-auto">
              {logs.length === 0 && (
                <div className="px-3 py-4 text-[var(--text-muted)] text-center italic">
                  {pixel.pixelId ? 'Aguardando início…' : 'Configure o pixel para iniciar a verificação.'}
                </div>
              )}
              {logs.map((log, i) => <LogLine key={i} log={log} />)}
            </div>
          </div>

          {verdict && (
            <div className={`flex items-start gap-2.5 rounded-lg p-3 border ${verdict.ok ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              {verdict.ok
                ? <CheckCircle2 size={16} className="text-green-500 mt-0.5" />
                : <XCircle size={16} className="text-red-500 mt-0.5" />}
              <div className="text-[12px] flex-1">
                <div className={`font-semibold ${verdict.ok ? 'text-green-500' : 'text-red-500'}`}>
                  {verdict.ok ? 'O pixel está recebendo eventos' : 'O pixel não está recebendo eventos'}
                </div>
                <div className="text-[var(--text-muted)] mt-0.5">{verdict.message}</div>
                {verdict.ok && verdict.avgLatency && (
                  <div className="text-[var(--text-muted)] mt-1 text-[10.5px]">Latência média de envio: {verdict.avgLatency} ms</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2 flex-wrap">
          <button onClick={onClose} className="h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
            Fechar
          </button>
          <button
            onClick={sendTest}
            disabled={!pixel.pixelId || sentTest}
            className="h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Send size={13} />
            {sentTest ? 'Enviado' : 'Enviar evento de teste'}
          </button>
          <button
            onClick={() => startVerify()}
            disabled={running || !pixel.pixelId}
            className="h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={running ? 'animate-spin' : ''} />
            {running ? 'Verificando…' : 'Verificar de novo'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   UTM Section
   ============================================================ */

function UTMSection() {
  const [utm, setUtm] = useState({
    base:     'https://umbra.bot/r/mentoria-vip',
    source:   'instagram',
    medium:   'cpc',
    campaign: 'lancamento-mai-2026',
    term:     '',
    content:  'reels-30s',
  })
  const [copied, setCopied] = useState(false)

  const fullUrl = useMemo(() => {
    const params = (['source', 'medium', 'campaign', 'term', 'content'] as const)
      .filter((k) => utm[k]?.trim())
      .map((k) => `utm_${k}=${encodeURIComponent(utm[k].trim())}`)
      .join('&')
    return params ? `${utm.base}?${params}` : utm.base
  }, [utm])

  function copy() {
    try { navigator.clipboard?.writeText(fullUrl) } catch (_) {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const propagSteps = [
    { icon: Instagram,      label: 'Clique',   desc: 'Captura inicial' },
    { icon: Link2,          label: 'Redirect', desc: 'Persiste no cookie' },
    { icon: MessageSquare,  label: 'Bot',      desc: 'Anexa ao lead' },
    { icon: ShoppingBag,    label: 'Pixel',    desc: 'Envia no Purchase' },
  ]

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
          <Link2 size={18} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Parâmetros UTM</h2>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 max-w-2xl leading-relaxed">
            Os parâmetros UTM são <strong className="text-[var(--text)]">capturados no clique</strong> e <strong className="text-[var(--text)]">propagados automaticamente</strong> pelos fluxos do Telegram, redirecionadores e checkouts — chegam até o evento de venda no pixel, fechando a atribuição.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-5">
        {propagSteps.map((s, i) => (
          <div key={i} className="relative">
            <div className="bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="w-8 h-8 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mx-auto mb-1.5">
                <s.icon size={14} />
              </div>
              <div className="text-[11.5px] font-semibold text-[var(--text)]">{s.label}</div>
              <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{s.desc}</div>
            </div>
            {i < 3 && (
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 z-10 hidden md:flex items-center justify-center text-[var(--text-muted)]">
                <ChevronRight size={12} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-3">Construtor de link com UTM</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UtmField label="URL base"              value={utm.base}     onChange={(v) => setUtm((u) => ({ ...u, base: v }))}     placeholder="https://…" wide />
          <UtmField label="utm_source"            value={utm.source}   onChange={(v) => setUtm((u) => ({ ...u, source: v }))}   placeholder="instagram" />
          <UtmField label="utm_medium"            value={utm.medium}   onChange={(v) => setUtm((u) => ({ ...u, medium: v }))}   placeholder="cpc" />
          <UtmField label="utm_campaign"          value={utm.campaign} onChange={(v) => setUtm((u) => ({ ...u, campaign: v }))} placeholder="black-2026" />
          <UtmField label="utm_term (opcional)"   value={utm.term}     onChange={(v) => setUtm((u) => ({ ...u, term: v }))}     placeholder="palavra-chave" />
          <UtmField label="utm_content (opcional)" value={utm.content} onChange={(v) => setUtm((u) => ({ ...u, content: v }))}  placeholder="reels-30s" />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Link final</div>
            <button onClick={copy} className="text-[11.5px] text-[var(--primary)] hover:underline inline-flex items-center gap-1 rounded px-1">
              {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <code className="block text-[11.5px] font-mono text-[var(--text)] bg-[var(--surface-2)]/50 border border-[var(--border)] rounded-lg p-3 break-all leading-relaxed">
            {fullUrl}
          </code>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-[var(--border)]">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-3">Exemplo: jornada completa</div>
        <div className="space-y-2">
          <JourneyStep n={1} title="Clique no anúncio do Instagram" detail="Lead acessa o link com UTMs anexadas no parâmetro da URL." chip="utm_source=instagram" />
          <JourneyStep n={2} title="Redirect captura e propaga"    detail="O Umbra Bot lê os parâmetros, salva no cookie e anexa ao lead recém-criado." chip="cookie · 30d" />
          <JourneyStep n={3} title="Fluxo do bot processa"          detail="Bot identifica o lead pelo session_id e mantém as UTMs no contexto." chip="bot context" />
          <JourneyStep n={4} title="Pixel envia evento Purchase"    detail="Quando a venda é confirmada, Meta/TikTok/Google recebem o evento com UTMs no payload." chip="event Purchase" />
        </div>
      </div>
    </div>
  )
}

function UtmField({ label, value, onChange, placeholder, wide }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[12.5px] font-mono text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
      />
    </div>
  )
}

function JourneyStep({ n, title, detail, chip }: { n: number; title: string; detail: string; chip?: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg">
      <span className="w-6 h-6 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-[10.5px] font-semibold flex items-center justify-center shrink-0">{n}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-[var(--text)]">{title}</div>
        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{detail}</div>
      </div>
      {chip && (
        <code className="text-[10.5px] font-mono text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0">
          {chip}
        </code>
      )}
    </div>
  )
}

/* ============================================================
   TrackingPage
   ============================================================ */

export default function TrackingPage() {
  const [pixels, setPixels]       = useState<Pixel[]>(MOCK_PIXELS)
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<Pixel | null>(null)
  const [verifying, setVerifying] = useState<Pixel | null>(null)
  const [toast, setToast]         = useState('')

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data, error } = await sb.from('pixels').select('*')
        if (error || !data || data.length === 0) throw new Error('no data')
        setPixels(data as Pixel[])
      } catch { setPixels(MOCK_PIXELS) } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const totals = useMemo(() => {
    const active  = pixels.filter((p) => p.pixelId).length
    const healthy = pixels.filter((p) => p.status === 'healthy').length
    const sent    = pixels.reduce((s, p) => s + (p.eventsSentToday || 0), 0)
    const matched = pixels.reduce((s, p) => s + (p.eventsMatched  || 0), 0)
    const matchRate = sent > 0 ? (matched / sent) * 100 : 0
    return { active, total: pixels.length, healthy, sent, matched, matchRate }
  }, [pixels])

  async function savePixel(id: string, patch: Partial<Pixel>) {
    setPixels((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    setToast('Pixel atualizado com sucesso.')
    try {
      const sb = createClient()
      const updated = pixels.find((p) => p.id === id)
      if (updated) {
        await sb.from('pixels').upsert({
          id,
          pixel_id: patch.pixelId,
          access_token: patch.accessToken,
          status: patch.status,
          events: patch.events,
          capi: patch.capi,
        })
      }
    } catch { /* silent */ }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Trackeamento"
        subtitle="Pixels, UTMs e atribuição multi-canal — Meta, TikTok e Google."
        actions={
          <button className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
            <BookOpen size={14} />
            Documentação
          </button>
        }
      />

      {toast && (
        <div className="mb-4 flex items-center gap-2.5 bg-green-500/10 border border-green-500/30 rounded-lg px-3.5 py-2">
          <CheckCircle2 size={15} className="text-green-500" />
          <div className="text-[12.5px] text-green-600 dark:text-green-400">{toast}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin mr-2" />
          Carregando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiTr label="Pixels ativos"          value={`${totals.active} / ${totals.total}`} sub={`${totals.healthy} saudáveis`} icon={Zap}          tone="primary" />
            <KpiTr label="Eventos enviados (24h)" value={fmtNum(totals.sent)}                                                       icon={Send}         delta={18.4} />
            <KpiTr label="Eventos com match"      value={fmtNum(totals.matched)}                                                    icon={CheckCircle2} />
            <KpiTr label="Match rate"             value={fmtPct(totals.matchRate, 1)}                                               icon={Target}       highlight={totals.matchRate >= 85} />
          </div>

          <section className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Pixels & APIs de conversão</h2>
              <span className="text-[10.5px] text-[var(--text-muted)]">{pixels.length} plataformas</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {pixels.map((p) => (
                <PixelCard key={p.id} pixel={p} onEdit={setEditing} onCheck={setVerifying} />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">UTM & atribuição</h2>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <UTMSection />
          </section>
        </>
      )}

      <EditPixelModal
        open={!!editing}
        onClose={() => setEditing(null)}
        pixel={editing}
        onSave={savePixel}
      />
      <VerifyPixelModal
        open={!!verifying}
        onClose={() => setVerifying(null)}
        pixel={verifying}
      />
    </DashboardLayout>
  )
}
