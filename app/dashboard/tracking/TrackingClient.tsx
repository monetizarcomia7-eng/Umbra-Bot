'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  savePixelAction, testPixelAction, sendTestPixelEvent,
  fetchPixelStats, type PixelPatch, type TestResult,
} from '@/app/actions/pixels'
import { useAnalytics } from '@/hooks/use-analytics'
import type { RawPixelRow, PixelStats } from './page'
import {
  Zap, Send, CheckCircle2, Target, Clock, Hash, ExternalLink,
  Eye, EyeOff, AlertCircle, RefreshCw, ArrowUpRight, ArrowDownRight,
  Link2, Instagram, MessageSquare, ShoppingBag, ChevronRight,
  Check, X, Circle, BookOpen, Copy, Activity, Pencil, Plug, XCircle,
  ShieldCheck, Info, FlaskConical, TrendingUp, Wifi, Download, Code2,
} from 'lucide-react'

/* ============================================================
   Format validation
   ============================================================ */

const FORMAT_REGEX: Record<string, RegExp> = {
  meta:   /^\d{10,16}$/,
  tiktok: /^\d{7,20}$/,
  google: /^G-[A-Z0-9]{4,12}$/i,
}

const FORMAT_HINT: Record<string, string> = {
  meta:   'Deve ter entre 10 e 16 dígitos numéricos.',
  tiktok: 'Advertiser ID: entre 7 e 20 dígitos numéricos.',
  google: 'Deve ser G-XXXXXXXXXX (letras e números após "G-").',
}

/* ============================================================
   Static catalog
   ============================================================ */

interface EventDef { id: string; label: string; desc: string }

interface CatalogEntry {
  name:             string
  fullName:         string
  description:      string
  initial:          string
  color:            string
  externalUrl:      string
  externalLabel:    string
  docsHint:         string
  idPlaceholder:    string
  idLabel:          string
  idHint:           string
  tokenLabel:       string
  tokenPlaceholder: string
  capiLabel:        string
  capiDesc:         string
  eventDefs:        EventDef[]
}

const PIXEL_CATALOG: Record<string, CatalogEntry> = {
  meta: {
    name:          'Meta',
    fullName:      'Meta Pixel (Facebook + Instagram)',
    description:   'Eventos via Conversions API — rastreia vendas e leads do Facebook/Instagram Ads.',
    initial:       'f',
    color:         'oklch(0.55 0.18 260)',
    externalUrl:   'https://business.facebook.com/events_manager',
    externalLabel: 'Gerenciador de Eventos',
    docsHint:      'Encontre no Gerenciador de Eventos do Meta → Configurações do pixel.',
    idLabel:       'Meta Pixel ID',
    idPlaceholder: '123456789012345',
    idHint:        'Número de 15 dígitos — aba "Pixels" no Gerenciador de Eventos.',
    tokenLabel:    'Access Token da Conversions API',
    tokenPlaceholder: 'EAAxxxxxxxx…',
    capiLabel:     'Envio server-side (CAPI)',
    capiDesc:      'Envia eventos pela Conversions API além do pixel client. Aumenta o match rate e burla bloqueadores de anúncios.',
    eventDefs: [
      { id: 'PageView',         label: 'PageView',         desc: 'Usuário entra no fluxo / página.' },
      { id: 'ViewContent',      label: 'ViewContent',      desc: 'Visualização de produto ou oferta.' },
      { id: 'Lead',             label: 'Lead',             desc: 'Lead capturado (nome ou e-mail).' },
      { id: 'AddToCart',        label: 'AddToCart',        desc: 'Adicionou produto ao carrinho.' },
      { id: 'InitiateCheckout', label: 'InitiateCheckout', desc: 'Iniciou checkout no gateway.' },
      { id: 'Purchase',         label: 'Purchase',         desc: 'Venda concluída — envia valor + moeda.' },
    ],
  },
  tiktok: {
    name:          'TikTok',
    fullName:      'TikTok Pixel',
    description:   'Eventos via Events API — rastreia conversões do TikTok Ads.',
    initial:       't',
    color:         'oklch(0.42 0.04 180)',
    externalUrl:   'https://business.tiktok.com/portal/events-manager',
    externalLabel: 'TikTok Events Manager',
    docsHint:      'Encontre em TikTok Ads Manager → Ativos → Eventos.',
    idLabel:       'TikTok Advertiser ID',
    idPlaceholder: '7123456789012345',
    idHint:        'ID numérico do anunciante (Advertiser ID) — TikTok Ads Manager → Configurações da conta. Usado para verificar a conexão.',
    tokenLabel:    'Access Token da Events API',
    tokenPlaceholder: 'ttk_xxxxxx…',
    capiLabel:     'Envio server-side (Events API)',
    capiDesc:      'Envia eventos pela TikTok Events API além do pixel client. Melhora a atribuição e contorna bloqueadores.',
    eventDefs: [
      { id: 'PageView',         label: 'PageView',         desc: 'Visualização inicial do fluxo.' },
      { id: 'ViewContent',      label: 'ViewContent',      desc: 'Visualizou produto / oferta.' },
      { id: 'AddToCart',        label: 'AddToCart',        desc: 'Adicionou ao carrinho.' },
      { id: 'InitiateCheckout', label: 'InitiateCheckout', desc: 'Iniciou checkout.' },
      { id: 'CompletePayment',  label: 'CompletePayment',  desc: 'Pagamento confirmado.' },
      { id: 'SubscribeLead',    label: 'SubscribeLead',    desc: 'Lead capturado.' },
    ],
  },
  google: {
    name:          'Google',
    fullName:      'Google Tag (GA4 + Ads)',
    description:   'Eventos para Google Analytics 4 e Google Ads via Measurement Protocol.',
    initial:       'G',
    color:         'oklch(0.66 0.15 60)',
    externalUrl:   'https://analytics.google.com',
    externalLabel: 'Google Analytics',
    docsHint:      'Formato: G-XXXXXXXXXX — não confundir com o ID de stream.',
    idLabel:       'ID de Medição (Measurement ID)',
    idPlaceholder: 'G-XXXXXXXXXX',
    idHint:        'Admin → Fluxos de dados → selecione o fluxo → ID de medição. Formato: G-XXXXXXXXXX.',
    tokenLabel:    'API Secret do Measurement Protocol',
    tokenPlaceholder: 'xxxxxxxxxxxxxxx…',
    capiLabel:     'Envio server-side (Measurement Protocol)',
    capiDesc:      'Envia eventos pelo Google Measurement Protocol além da tag client. Requer API Secret — crie em Admin → Fluxos de dados → Measurement Protocol.',
    eventDefs: [
      { id: 'page_view',      label: 'page_view',      desc: 'Visualização de página / fluxo.' },
      { id: 'view_item',      label: 'view_item',      desc: 'Visualizou produto / oferta.' },
      { id: 'add_to_cart',    label: 'add_to_cart',    desc: 'Adicionou ao carrinho.' },
      { id: 'begin_checkout', label: 'begin_checkout', desc: 'Iniciou checkout.' },
      { id: 'purchase',       label: 'purchase',       desc: 'Compra concluída.' },
      { id: 'generate_lead',  label: 'generate_lead',  desc: 'Lead capturado.' },
    ],
  },
}

const CATALOG_PROVIDERS = ['meta', 'tiktok', 'google'] as const

/* ============================================================
   Payload preview builder (educacional — client-side)
   ============================================================ */

function buildSamplePayload(provider: string, pixelId: string, pixelCode?: string | null): string {
  if (provider === 'meta') {
    return JSON.stringify({
      data: [{
        event_name:    'Purchase',
        event_time:    Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: {
          client_ip_address: '177.x.x.x',
          client_user_agent: 'Mozilla/5.0...',
          em: ['<sha256(email)>'],
          ph: ['<sha256(telefone)>'],
        },
        custom_data: { currency: 'BRL', value: 97.00 },
      }],
    }, null, 2)
  }
  if (provider === 'tiktok') {
    return JSON.stringify({
      pixel_code: pixelCode || '<Pixel Code>',
      event:      'CompletePayment',
      timestamp:  new Date().toISOString(),
      context: {
        user_agent: 'Mozilla/5.0...',
        ip:         '177.x.x.x',
        user: { email: '<sha256(email)>', phone_number: '<sha256(telefone)>' },
      },
      properties: { currency: 'BRL', value: '97.00' },
    }, null, 2)
  }
  if (provider === 'google') {
    return JSON.stringify({
      client_id: '<telegram_id-do-lead>',
      events: [{
        name:   'purchase',
        params: { currency: 'BRL', value: 97.00, transaction_id: '<uuid-da-transacao>' },
      }],
    }, null, 2)
  }
  return '{}'
}

/* ============================================================
   Internal types
   ============================================================ */

interface PixelItem {
  id:        string | null
  provider:  string
  pixelId:   string | null
  pixelCode: string | null  // TikTok Pixel Code (distinto do Advertiser ID)
  hasToken:  boolean
  events:    Record<string, boolean>
  capi:      boolean
  dbStatus:  string   // status persistido no banco — 'healthy' após verificação
  status:    'healthy' | 'waiting' | 'warning' | 'error' | 'inactive'
  eventsSentToday: number
  eventsMatched:   number
  lastEvent:       number | null
  lastTestAt:      number | null
  name:             string
  fullName:         string
  description:      string
  initial:          string
  color:            string
  externalUrl:      string
  externalLabel:    string
  docsHint:         string
  idLabel:          string
  idPlaceholder:    string
  idHint:           string
  tokenLabel:       string
  tokenPlaceholder: string
  capiLabel:        string
  capiDesc:         string
  eventDefs:        EventDef[]
}

interface StatusInfo { label: string; tone: string; dot: string; pulse: boolean; desc: string }
interface LogEntry { type: 'system' | 'recv'; text?: string; status?: 'ok' | 'error' | 'info'; label?: string; time?: string; valid?: boolean; isTest?: boolean }
interface ToastState { msg: string; type: 'success' | 'error' }

/* ============================================================
   Helpers
   ============================================================ */

function defaultEvents(provider: string): Record<string, boolean> {
  const cat = PIXEL_CATALOG[provider]
  if (!cat) return {}
  return Object.fromEntries(cat.eventDefs.map(e => [e.id, false]))
}

function computeStatus(
  pixelId: string | null,
  dbStatus: string,
  lastEventMs: number | null,
  now: number,
): PixelItem['status'] {
  if (!pixelId) return 'inactive'
  if (!lastEventMs) {
    // Pixel verificado manualmente retorna 'healthy' mesmo sem eventos de checkout ainda
    if (dbStatus === 'healthy') return 'healthy'
    return 'waiting'
  }
  const diff = now - lastEventMs
  if (diff < 30 * 60_000) return 'healthy'
  if (diff < 60 * 60_000) return 'warning'
  return 'error'
}

function mergePixels(rows: RawPixelRow[], stats: PixelStats, now: number): PixelItem[] {
  const lastEventMs = stats.last_event ? new Date(stats.last_event).getTime() : null
  return CATALOG_PROVIDERS.map(provider => {
    const cat = PIXEL_CATALOG[provider]
    const row = rows.find(r => r.provider === provider)
    return {
      id:          row?.id ?? null,
      provider,
      pixelId:     row?.pixel_id ?? null,
      pixelCode:   row?.pixel_code ?? null,
      hasToken:    !!row?.access_token,
      events:      (row?.events as Record<string, boolean>) ?? defaultEvents(provider),
      capi:        row?.capi ?? false,
      dbStatus:    row?.status ?? 'inactive',
      status:      computeStatus(row?.pixel_id ?? null, row?.status ?? 'inactive', lastEventMs, now),
      eventsSentToday: stats.events_sent_today,
      eventsMatched:   stats.events_matched,
      lastEvent:       lastEventMs,
      lastTestAt:      row?.last_test_at ? new Date(row.last_test_at).getTime() : null,
      ...cat,
    }
  })
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtPct = (n: number, d = 0) => n.toFixed(d).replace('.', ',') + '%'

function relTime(ms: number | null, now: number): string {
  if (!ms) return '—'
  const diff = now - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const statusMap: Record<string, StatusInfo> = {
  healthy:  { label: 'Saudável',           tone: 'success',  dot: 'bg-green-500',          pulse: true,  desc: 'Eventos chegando há menos de 30 min.' },
  waiting:  { label: 'Aguardando evento',  tone: 'primary',  dot: 'bg-blue-400',            pulse: false, desc: 'Pixel configurado — aguardando o primeiro evento do checkout.' },
  warning:  { label: 'Volume baixo',       tone: 'warning',  dot: 'bg-yellow-500',          pulse: false, desc: 'Nenhum evento nos últimos 30–60 min.' },
  error:    { label: 'Sem eventos',        tone: 'danger',   dot: 'bg-red-500',             pulse: false, desc: 'Sem eventos há mais de 1 hora.' },
  inactive: { label: 'Não configurado',    tone: 'muted',    dot: 'bg-[var(--text-muted)]', pulse: false, desc: 'Configure o ID do pixel para ativar.' },
}

/* ============================================================
   Micro-components
   ============================================================ */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function CheckboxInline({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="checkbox" aria-checked={checked} onClick={onChange}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${checked ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50'}`}
    >
      {checked && <Check size={10} className="text-white" />}
    </button>
  )
}

function Bdg({ tone, children, title }: { tone: string; children: React.ReactNode; title?: string }) {
  const cls: Record<string, string> = {
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    danger:  'bg-red-500/10 text-red-600 dark:text-red-400',
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    muted:   'bg-[var(--surface-2)] text-[var(--text-muted)]',
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium ${cls[tone] ?? cls.muted} ${title ? 'cursor-help' : ''}`}
    >
      {children}
    </span>
  )
}

function PixelLogo({ initial, color, size = 44 }: { initial: string; color: string; size?: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.5, letterSpacing: '-0.04em' }}>
      {initial}
    </div>
  )
}

function StatT({ label, value, tone, note }: { label: string; value: string; tone?: string; note?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">{label}</div>
      <div className={['text-[13px] font-semibold tracking-tight mt-0.5', tone === 'success' ? 'text-green-500' : tone === 'warning' ? 'text-yellow-500' : tone === 'muted' ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'].join(' ')}>{value}</div>
      {note && <div className="text-[9.5px] text-[var(--text-muted)] mt-0.5">{note}</div>}
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

const inputCls = 'w-full h-10 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50'
const inputErrorCls = 'w-full h-10 px-3 bg-[var(--surface)] border border-red-500/60 rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/60'

/* ============================================================
   KPI card
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

function PixelCard({
  pixel, now, onEdit, onCheck,
}: {
  pixel: PixelItem; now: number; onEdit: (p: PixelItem) => void; onCheck: (p: PixelItem) => void
}) {
  const st = statusMap[pixel.status]
  const enabledCount = Object.values(pixel.events).filter(Boolean).length
  const total = pixel.eventDefs.length
  const matchRate = pixel.eventsSentToday > 0 ? (pixel.eventsMatched / pixel.eventsSentToday) * 100 : 0
  const showMatchTip = pixel.pixelId && pixel.eventsSentToday > 0 && matchRate < 70 && !pixel.hasToken

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--text-muted)]/40 transition-colors flex flex-col">
      <div className="flex items-start gap-3.5">
        <PixelLogo initial={pixel.initial} color={pixel.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14.5px] font-semibold text-[var(--text)]">{pixel.name}</h3>
            <Bdg tone={st.tone} title={st.desc}>
              {st.pulse && (
                <span className={`relative w-1.5 h-1.5 rounded-full ${st.dot}`}>
                  <span className={`absolute inset-0 rounded-full ${st.dot} animate-ping opacity-60`} />
                </span>
              )}
              {!st.pulse && pixel.pixelId && <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />}
              {st.label}
            </Bdg>
            {pixel.capi && pixel.hasToken && <Bdg tone="primary"><ShieldCheck size={9} />CAPI</Bdg>}
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
          </div>
        ) : (
          <div className="text-[11.5px] text-[var(--text-muted)] italic flex items-center gap-1.5">
            <Circle size={9} />Sem ID configurado
          </div>
        )}
        {/* TikTok pixel code indicator */}
        {pixel.provider === 'tiktok' && pixel.pixelCode && (
          <div className="flex items-center gap-2 mt-1.5 bg-[var(--surface-2)]/50 border border-[var(--border)] rounded-md px-2.5 py-1.5">
            <Code2 size={11} className="text-[var(--text-muted)] shrink-0" />
            <span className="text-[10.5px] text-[var(--text-muted)] shrink-0">Pixel:</span>
            <code className="text-[11.5px] font-mono text-[var(--text)] truncate flex-1">{pixel.pixelCode}</code>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-[var(--border)]">
        <StatT label="Eventos ativos" value={`${enabledCount}/${total}`} />
        <StatT
          label="Enviados (24h)"
          value={pixel.pixelId ? fmtNum(pixel.eventsSentToday) : '—'}
          note={pixel.pixelId ? 'global' : undefined}
        />
        <StatT
          label="Match rate"
          value={pixel.pixelId && pixel.eventsSentToday > 0 ? fmtPct(matchRate, 1) : pixel.pixelId ? '0%' : '—'}
          tone={matchRate >= 85 ? 'success' : matchRate > 0 ? 'warning' : 'muted'}
          note={pixel.pixelId && pixel.eventsSentToday > 0 ? 'global' : undefined}
        />
      </div>

      {showMatchTip && (
        <div className="mt-3 flex items-start gap-2 bg-yellow-500/8 border border-yellow-500/20 rounded-lg px-2.5 py-2">
          <TrendingUp size={11} className="text-yellow-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-yellow-600 dark:text-yellow-400 leading-snug">
            Match rate abaixo de 70%. Configure o access token para ativar o envio server-side e melhorar a atribuição.
          </span>
        </div>
      )}

      <div className="text-[11px] text-[var(--text-muted)] mt-3 flex items-center gap-1.5">
        <Clock size={11} />
        Último evento:&nbsp;<span className="text-[var(--text)]">{pixel.pixelId ? relTime(pixel.lastEvent, now) : '—'}</span>
      </div>

      {pixel.lastTestAt && (
        <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1.5">
          <FlaskConical size={11} />
          Último teste:&nbsp;<span className="text-[var(--text)]">{relTime(pixel.lastTestAt, now)}</span>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2">
        {pixel.pixelId ? (
          <>
            <button
              onClick={() => onCheck(pixel)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              <Activity size={13} />Verificar pixel
            </button>
            <button
              onClick={() => onEdit(pixel)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Pencil size={13} />Editar
            </button>
            <a
              href={pixel.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            >
              <ExternalLink size={11} />{pixel.externalLabel}
            </a>
          </>
        ) : (
          <button
            onClick={() => onEdit(pixel)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
          >
            <Plug size={13} />Configurar {pixel.name}
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Edit Pixel Modal
   ============================================================ */

function EditPixelModal({
  open, onClose, pixel, onSave,
}: {
  open: boolean; onClose: () => void; pixel: PixelItem | null
  onSave: (provider: string, patch: PixelPatch) => Promise<void>
}) {
  const [pixelId,    setPixelId]    = useState('')
  const [pixelCode,  setPixelCode]  = useState('')  // TikTok only
  const [tokenVal,   setTokenVal]   = useState('')
  const [clearTok,   setClearTok]   = useState(false)
  const [events,     setEvents]     = useState<Record<string, boolean>>({})
  const [capi,       setCapi]       = useState(true)
  const [showTok,    setShowTok]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [formatErr,  setFormatErr]  = useState('')

  useEffect(() => {
    if (open && pixel) {
      setPixelId(pixel.pixelId || '')
      setPixelCode(pixel.pixelCode || '')
      setTokenVal('')
      setClearTok(false)
      setEvents({ ...pixel.events })
      setCapi(pixel.capi)
      setShowTok(false)
      setSaving(false)
      setFormatErr('')
    }
  }, [open, pixel])

  if (!pixel) return null

  const catalog = pixel.eventDefs
  const enabledCount = Object.values(events).filter(Boolean).length

  function toggleAll(value: boolean) {
    setEvents(Object.fromEntries(catalog.map(e => [e.id, value])))
  }

  function validateFormat(id: string): boolean {
    const trimmed = id.trim()
    if (!trimmed) return true  // empty is allowed (will be null)
    const regex = FORMAT_REGEX[pixel!.provider]
    if (!regex) return true
    if (!regex.test(trimmed)) {
      setFormatErr(FORMAT_HINT[pixel!.provider] ?? 'Formato inválido.')
      return false
    }
    setFormatErr('')
    return true
  }

  async function save() {
    if (!validateFormat(pixelId)) return
    setSaving(true)
    try {
      await onSave(pixel!.provider, {
        pixelId:    pixelId.trim() || null,
        pixelCode:  pixelCode.trim() || null,
        newToken:   tokenVal.trim() || null,
        clearToken: clearTok,
        events,
        capi,
      })
      setSaving(false)
      onClose()
    } catch {
      setSaving(false)
    }
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
              {pixel.pixelId ? 'Atualize o ID e os eventos disparados.' : 'Cole o ID e ative os eventos que devem ser enviados.'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Pixel header */}
          <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg">
            <PixelLogo initial={pixel.initial} color={pixel.color} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--text)]">{pixel.fullName}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{pixel.description}</div>
            </div>
            <a href={pixel.externalUrl} target="_blank" rel="noopener noreferrer"
              className="text-[11.5px] text-[var(--primary)] hover:underline inline-flex items-center gap-1 shrink-0">
              <ExternalLink size={11} />Como obter
            </a>
          </div>

          {/* Pixel ID */}
          <FieldT label={pixel.idLabel} hint={formatErr ? undefined : pixel.idHint}>
            <input
              type="text" value={pixelId}
              onChange={e => { setPixelId(e.target.value); setFormatErr('') }}
              onBlur={() => validateFormat(pixelId)}
              placeholder={pixel.idPlaceholder} autoFocus
              className={(formatErr ? inputErrorCls : inputCls) + ' font-mono'}
            />
            {formatErr && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-red-500">
                <AlertCircle size={11} />{formatErr}
              </div>
            )}
            {!formatErr && pixel.idHint && (
              <div className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">{pixel.idHint}</div>
            )}
          </FieldT>

          {/* TikTok Pixel Code (campo extra — distinto do Advertiser ID) */}
          {pixel.provider === 'tiktok' && (
            <FieldT
              label="TikTok Pixel Code (para envio de eventos)"
              hint="Diferente do Advertiser ID. Encontre em TikTok Events Manager → selecione o pixel → ID do pixel. Formato: C0XXXXXXXXXXXXXXXXX ou numérico. Necessário para enviar eventos via Events API."
            >
              <input
                type="text" value={pixelCode}
                onChange={e => setPixelCode(e.target.value)}
                placeholder="C0XXXXXXXXXXXXXXX"
                className={inputCls + ' font-mono'}
              />
            </FieldT>
          )}

          {/* Access Token */}
          <FieldT
            label={`${pixel.tokenLabel} (opcional, mas recomendado)`}
            hint={pixel.hasToken && !clearTok && !tokenVal
              ? 'Token configurado. Digite para substituir ou marque "Remover token" para apagar.'
              : 'Necessário para envio server-side. Salvo criptografado — nunca exposto ao navegador.'}
          >
            {pixel.hasToken && !clearTok && !tokenVal ? (
              <div className="flex items-center gap-2">
                <div className={inputCls + ' font-mono flex items-center text-[var(--text-muted)] cursor-default'}>
                  <span className="select-none tracking-[0.2em]">●●●●●●●●●●●●●●●●</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTokenVal(' ')}
                  className="shrink-0 h-10 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                >
                  Substituir
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type={showTok ? 'text' : 'password'}
                  value={tokenVal === ' ' ? '' : tokenVal}
                  onChange={e => { setTokenVal(e.target.value); setClearTok(false) }}
                  placeholder={pixel.tokenPlaceholder}
                  className={inputCls + ' font-mono pr-10'}
                />
                <button
                  type="button" tabIndex={-1} onClick={() => setShowTok(s => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                >
                  {showTok ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )}
            {pixel.hasToken && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <CheckboxInline checked={clearTok} onChange={() => { setClearTok(c => !c); setTokenVal('') }} />
                <span className="text-[11.5px] text-[var(--text-muted)]">Remover token salvo</span>
              </label>
            )}
          </FieldT>

          {/* Server-side toggle */}
          <div className="flex items-start justify-between gap-3 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg p-3">
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[var(--text)]">{pixel.capiLabel}</div>
              <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5 leading-snug">{pixel.capiDesc}</div>
            </div>
            <Toggle checked={capi} onChange={setCapi} />
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[12.5px] font-medium text-[var(--text)]">Eventos enviados ({enabledCount}/{catalog.length})</label>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={() => toggleAll(true)} className="text-[var(--primary)] hover:underline">Ativar todos</button>
                <span className="text-[var(--text-muted)]">·</span>
                <button onClick={() => toggleAll(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">Limpar</button>
              </div>
            </div>
            <div className="space-y-1.5">
              {catalog.map(e => (
                <label key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)]/50 cursor-pointer">
                  <CheckboxInline checked={!!events[e.id]} onChange={() => setEvents(v => ({ ...v, [e.id]: !v[e.id] }))} />
                  <code className="text-[11.5px] font-mono text-[var(--text)] font-medium shrink-0 min-w-[150px]">{e.label}</code>
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
            disabled={!pixelId.trim() || saving || !!formatErr}
            className="h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {saving ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Check size={14} />}
            {saving ? 'Salvando…' : 'Salvar configuração'}
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
        <span className="text-[var(--text)] text-[11px]">{log.text}</span>
      </div>
    )
  }
  if (log.type === 'recv') {
    return (
      <div className="px-3 py-1.5 flex items-center gap-2">
        <Zap size={10} className={log.valid ? 'text-green-500' : 'text-red-500'} />
        <span className="text-green-500 font-semibold text-[10px]">RECV</span>
        <code className="text-[var(--text)] text-[11px]">{log.label}</code>
        {log.isTest && <Bdg tone="primary">teste</Bdg>}
        <span className="ml-auto text-[var(--text-muted)] text-[10px]">{log.time}</span>
      </div>
    )
  }
  return null
}

function VerifyPixelModal({
  open, onClose, pixel, onVerifyTrack, onTestSent,
}: {
  open: boolean; onClose: () => void; pixel: PixelItem | null
  onVerifyTrack: (ok: boolean) => void
  onTestSent: (provider: string) => void
}) {
  const [running,     setRunning]     = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [logs,        setLogs]        = useState<LogEntry[]>([])
  const [verdict,     setVerdict]     = useState<TestResult | null>(null)
  const [tab,         setTab]         = useState<'verify' | 'preview'>('verify')

  const appendLog = useCallback((log: LogEntry) => setLogs(l => [...l, log]), [])

  useEffect(() => {
    if (open && pixel?.id) {
      setRunning(false); setSendingTest(false); setLogs([]); setVerdict(null); setTab('verify')
      if (pixel.pixelId) runVerify()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pixel?.id])

  async function runVerify() {
    if (!pixel?.id || !pixel.pixelId) return
    setRunning(true)
    setLogs([])
    setVerdict(null)

    appendLog({ type: 'system', text: `Conectando ao endpoint do ${pixel.name}…`, status: 'info' })
    appendLog({ type: 'system', text: `ID: ${pixel.pixelId}`, status: 'ok' })
    if (pixel.capi && pixel.hasToken) {
      appendLog({ type: 'system', text: `${pixel.capiLabel} ativo — verificando credenciais`, status: 'info' })
    } else if (!pixel.hasToken) {
      appendLog({ type: 'system', text: 'Sem access token — verificação limitada ao formato do ID', status: 'info' })
    }

    try {
      const result = await testPixelAction(pixel.id)
      appendLog({
        type: 'system',
        text: result.ok ? 'Verificação concluída com sucesso.' : `Erro: ${result.message}`,
        status: result.ok ? 'ok' : 'error',
      })
      if (result.ok && result.latency !== null && result.latency > 0) {
        appendLog({ type: 'recv', label: 'verification_ping', time: `${result.latency} ms`, valid: true })
      }
      setVerdict(result)
      onVerifyTrack(result.ok)
    } catch {
      appendLog({ type: 'system', text: 'Erro inesperado ao verificar o pixel.', status: 'error' })
      setVerdict({ ok: false, message: 'Erro interno. Tente novamente.', latency: null })
      onVerifyTrack(false)
    } finally {
      setRunning(false)
    }
  }

  async function runTestEvent() {
    if (!pixel?.id || !pixel.pixelId || sendingTest) return
    setSendingTest(true)
    appendLog({ type: 'system', text: `Enviando evento de teste Purchase para ${pixel.name}…`, status: 'info' })

    try {
      const result = await sendTestPixelEvent(pixel.id)
      appendLog({
        type: 'system',
        text: result.ok ? result.message : `Erro: ${result.message}`,
        status: result.ok ? 'ok' : 'error',
      })
      if (result.ok) {
        appendLog({ type: 'recv', label: 'test_event · Purchase', time: result.latency ? `${result.latency} ms` : '', valid: true, isTest: true })
        onTestSent(pixel.provider)
      }
      setVerdict(result)
    } catch {
      appendLog({ type: 'system', text: 'Erro inesperado ao enviar evento de teste.', status: 'error' })
    } finally {
      setSendingTest(false)
    }
  }

  if (!pixel) return null

  const canSendTest = !!pixel.pixelId && !!pixel.id && pixel.hasToken && !running && !sendingTest
  const samplePayload = pixel.pixelId
    ? buildSamplePayload(pixel.provider, pixel.pixelId, pixel.pixelCode)
    : null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Verificar {pixel.fullName}</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              {pixel.hasToken ? 'Testando credenciais contra a API do provider.' : 'Validando formato do ID.'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Tab selector */}
          <div className="flex items-center gap-1 bg-[var(--surface-2)]/50 rounded-lg p-0.5">
            <button
              onClick={() => setTab('verify')}
              className={`flex-1 h-7 text-[11.5px] font-medium rounded-md transition-colors ${tab === 'verify' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              Verificação
            </button>
            <button
              onClick={() => setTab('preview')}
              className={`flex-1 h-7 text-[11.5px] font-medium rounded-md transition-colors ${tab === 'preview' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              Prévia do payload
            </button>
          </div>

          {/* Pixel summary */}
          <div className="flex items-center gap-3 bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg p-3">
            <PixelLogo initial={pixel.initial} color={pixel.color} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-[var(--text)]">{pixel.fullName}</div>
              <code className="text-[11px] font-mono text-[var(--text-muted)]">{pixel.pixelId || 'sem ID'}</code>
            </div>
            <Bdg tone={statusMap[pixel.status].tone} title={statusMap[pixel.status].desc}>
              {statusMap[pixel.status].label}
            </Bdg>
          </div>

          {tab === 'verify' && (
            <>
              {!pixel.pixelId && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-[12px] leading-relaxed">
                  <AlertCircle size={13} className="text-yellow-500 mt-0.5 shrink-0" />
                  <span className="text-[var(--text)]">Configure o ID do pixel antes de verificar.</span>
                </div>
              )}

              {!pixel.hasToken && pixel.pixelId && pixel.provider !== 'google' && (
                <div className="flex items-start gap-2 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-lg p-3 text-[12px] leading-relaxed">
                  <Info size={13} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                  <span className="text-[var(--text-muted)]">Sem access token: apenas o formato do ID pode ser validado. Para verificar e enviar eventos de teste, adicione o token na edição do pixel.</span>
                </div>
              )}

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between">
                  <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Logs de verificação</div>
                  {(running || sendingTest) && <div className="w-3 h-3 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />}
                </div>
                <div className="font-mono divide-y divide-[var(--border)] max-h-[220px] overflow-y-auto">
                  {logs.length === 0 && (
                    <div className="px-3 py-4 text-[var(--text-muted)] text-center italic text-[11px]">
                      {pixel.pixelId ? 'Iniciando verificação…' : 'Configure o pixel para iniciar.'}
                    </div>
                  )}
                  {logs.map((log, i) => <LogLine key={i} log={log} />)}
                </div>
              </div>

              {verdict && (
                <div className={`flex items-start gap-2.5 rounded-lg p-3 border ${verdict.ok ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  {verdict.ok
                    ? <CheckCircle2 size={16} className="text-green-500 mt-0.5" />
                    : <XCircle      size={16} className="text-red-500 mt-0.5" />}
                  <div className="text-[12px] flex-1">
                    <div className={`font-semibold ${verdict.ok ? 'text-green-500' : 'text-red-500'}`}>
                      {verdict.ok ? 'Verificação bem-sucedida' : 'Falha na verificação'}
                    </div>
                    <div className="text-[var(--text-muted)] mt-0.5">{verdict.message}</div>
                    {verdict.ok && verdict.latency !== null && verdict.latency > 0 && (
                      <div className="text-[var(--text-muted)] mt-1 text-[10.5px]">Latência: {verdict.latency} ms</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-[var(--primary)]/8 border border-[var(--primary)]/20 rounded-lg p-3 text-[12px] leading-relaxed">
                <Info size={13} className="text-[var(--primary)] mt-0.5 shrink-0" />
                <span className="text-[var(--text-muted)]">
                  Exemplo do payload enviado para um evento <strong className="text-[var(--text)]">Purchase</strong>. Dados reais incluem hash SHA-256 do e-mail e telefone do comprador.
                  {pixel.provider === 'tiktok' && !pixel.pixelCode && (
                    <span className="text-yellow-600 dark:text-yellow-400"> Configure o Pixel Code para envio de eventos.</span>
                  )}
                </span>
              </div>

              {samplePayload ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex items-center justify-between">
                    <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                      Payload de exemplo — evento Purchase
                    </div>
                    <Bdg tone="muted">JSON</Bdg>
                  </div>
                  <pre className="text-[10.5px] font-mono text-[var(--text)] p-3 overflow-x-auto max-h-[320px] overflow-y-auto leading-relaxed whitespace-pre">
                    {samplePayload}
                  </pre>
                </div>
              ) : (
                <div className="text-[12px] text-[var(--text-muted)] italic text-center py-6">
                  Configure o ID do pixel para ver o payload.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center gap-2">
          {tab === 'verify' && (
            <button
              onClick={runTestEvent}
              disabled={!canSendTest}
              title={!pixel.hasToken ? 'Configure o access token para enviar evento de teste' : 'Envia um evento Purchase de teste ao provider'}
              className="h-9 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <FlaskConical size={13} className={sendingTest ? 'animate-pulse' : ''} />
              {sendingTest ? 'Enviando…' : 'Enviar evento de teste'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
            Fechar
          </button>
          {tab === 'verify' && (
            <button
              onClick={runVerify}
              disabled={running || !pixel.pixelId}
              className="h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={running ? 'animate-spin' : ''} />
              {running ? 'Verificando…' : 'Verificar de novo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   UTM Section
   ============================================================ */

function UTMSection({ onCopy }: { onCopy: (hasUtm: boolean) => void }) {
  const [utm, setUtm] = useState({ base: '', source: '', medium: '', campaign: '', term: '', content: '' })
  const [copied, setCopied] = useState(false)
  const [urlError, setUrlError] = useState(false)

  const fullUrl = useMemo(() => {
    const b = utm.base.trim()
    if (!b) return ''
    const params = (['source', 'medium', 'campaign', 'term', 'content'] as const)
      .filter(k => utm[k]?.trim())
      .map(k => `utm_${k}=${encodeURIComponent(utm[k].trim())}`)
      .join('&')
    return params ? `${b}${b.includes('?') ? '&' : '?'}${params}` : b
  }, [utm])

  const hasUtm = !!(utm.source.trim() || utm.medium.trim() || utm.campaign.trim())

  function handleBaseChange(v: string) {
    setUtm(u => ({ ...u, base: v }))
    setUrlError(false)
  }

  function copy() {
    if (!fullUrl) return
    const baseOk = isValidUrl(utm.base.trim())
    if (!baseOk) { setUrlError(true); return }
    try { navigator.clipboard?.writeText(fullUrl) } catch {}
    setCopied(true)
    onCopy(hasUtm)
    setTimeout(() => setCopied(false), 1800)
  }

  const propagSteps = [
    { icon: Instagram,     label: 'Clique',   desc: 'Captura inicial' },
    { icon: Link2,         label: 'Redirect', desc: 'Persiste no cookie' },
    { icon: MessageSquare, label: 'Bot',      desc: 'Anexa ao lead' },
    { icon: ShoppingBag,   label: 'Pixel',    desc: 'Envia no Purchase' },
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
            Os parâmetros UTM são <strong className="text-[var(--text)]">capturados no clique</strong> e <strong className="text-[var(--text)]">propagados automaticamente</strong> pelos fluxos, redirecionadores e checkouts — chegam até o evento de venda no pixel, fechando a atribuição.
          </p>
        </div>
      </div>

      {/* Jornada visual */}
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

      {/* Construtor */}
      <div className="border-t border-[var(--border)] pt-4">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-3">Construtor de link com UTM</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-1">URL base *</label>
            <input
              type="text" value={utm.base} onChange={e => handleBaseChange(e.target.value)}
              placeholder="https://www.umbrabot.com.br/r/meu-link"
              className={`w-full h-9 px-2.5 bg-[var(--surface)] border rounded-md text-[12.5px] font-mono text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 transition-colors ${urlError ? 'border-red-500 focus:border-red-500' : 'border-[var(--border)] focus:border-[var(--primary)]/50'}`}
            />
            {urlError && (
              <div className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={10} />URL inválida. Deve começar com http:// ou https://
              </div>
            )}
          </div>
          <UtmField label="utm_source"             value={utm.source}   onChange={v => setUtm(u => ({ ...u, source: v }))}   placeholder="instagram" />
          <UtmField label="utm_medium"             value={utm.medium}   onChange={v => setUtm(u => ({ ...u, medium: v }))}   placeholder="cpc" />
          <UtmField label="utm_campaign"           value={utm.campaign} onChange={v => setUtm(u => ({ ...u, campaign: v }))} placeholder="black-2026" />
          <UtmField label="utm_term (opcional)"    value={utm.term}     onChange={v => setUtm(u => ({ ...u, term: v }))}     placeholder="palavra-chave" />
          <UtmField label="utm_content (opcional)" value={utm.content}  onChange={v => setUtm(u => ({ ...u, content: v }))}  placeholder="reels-30s" />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Link final</div>
            <button
              onClick={copy}
              disabled={!fullUrl}
              className="text-[11.5px] text-[var(--primary)] hover:underline inline-flex items-center gap-1 rounded px-1 disabled:opacity-40"
            >
              {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          {fullUrl ? (
            <code className="block text-[11.5px] font-mono text-[var(--text)] bg-[var(--surface-2)]/50 border border-[var(--border)] rounded-lg p-3 break-all leading-relaxed">
              {fullUrl}
            </code>
          ) : (
            <div className="text-[11.5px] text-[var(--text-muted)] italic bg-[var(--surface-2)]/40 border border-[var(--border)] rounded-lg p-3">
              Preencha a URL base para gerar o link…
            </div>
          )}
        </div>
      </div>

      {/* Jornada completa */}
      <div className="mt-5 pt-5 border-t border-[var(--border)]">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-3">Exemplo: jornada completa</div>
        <div className="space-y-2">
          <JourneyStep n={1} title="Clique no anúncio do Instagram"   detail="Lead acessa o link com UTMs anexadas no parâmetro da URL."                                     chip="utm_source=instagram" />
          <JourneyStep n={2} title="Redirect captura e propaga"       detail="O Umbra Bot lê os parâmetros, salva no cookie e anexa ao lead recém-criado no Telegram."       chip="cookie · 30d" />
          <JourneyStep n={3} title="Fluxo do bot processa o lead"     detail="Bot identifica o lead pelo telegram_id e mantém as UTMs no contexto da transação."             chip="bot context" />
          <JourneyStep n={4} title="Pixel envia evento de Purchase"   detail="Quando a venda é confirmada, Meta/TikTok/Google recebem o evento com UTMs no payload."          chip="event Purchase" />
        </div>
      </div>
    </div>
  )
}

function UtmField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-1">{label}</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
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
      {chip && <code className="text-[10.5px] font-mono text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0">{chip}</code>}
    </div>
  )
}

/* ============================================================
   SnippetCard — snippets browser-side por provider
   ============================================================ */

function buildBrowserSnippet(provider: string, pixelId: string | null, pixelCode?: string | null): string {
  if (!pixelId) return ''
  if (provider === 'meta') {
    return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`
  }
  if (provider === 'tiktok') {
    const code = pixelCode || pixelId
    return `<!-- TikTok Pixel Code -->
<script>
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once",
"ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){
t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)
ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,
ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");
o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${code}');
ttq.page();
}(window,document,'ttq');
</script>
<!-- End TikTok Pixel Code -->`
  }
  if (provider === 'google') {
    return `<!-- Google Tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${pixelId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${pixelId}');
</script>
<!-- End Google Tag -->`
  }
  return ''
}

function SnippetCard({ pixels }: { pixels: PixelItem[] }) {
  const [copiedProvider, setCopiedProvider] = useState<string | null>(null)

  const configured = pixels.filter(p => p.pixelId)
  if (configured.length === 0) return null

  function handleCopy(provider: string, code: string) {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedProvider(provider)
    setTimeout(() => setCopiedProvider(null), 2000)
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
          <Code2 size={16} className="text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Snippet de instalação</h2>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            Cole o código abaixo no <code className="font-mono text-[11px] bg-[var(--surface-2)] px-1 rounded">&lt;head&gt;</code> de cada página de checkout para ativar o rastreamento browser-side.
          </p>
        </div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {configured.map(p => {
          const snippet = buildBrowserSnippet(p.provider, p.pixelId, p.pixelCode)
          if (!snippet) return null
          const isCopied = copiedProvider === p.provider
          return (
            <div key={p.provider} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ background: p.color }}>{p.initial.toUpperCase()}</div>
                  <span className="text-[13px] font-medium text-[var(--text)]">{p.name}</span>
                  <code className="text-[10.5px] font-mono text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5">{p.pixelId}</code>
                </div>
                <button
                  onClick={() => handleCopy(p.provider, snippet)}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  {isCopied ? <><Check size={12} className="text-green-500" />Copiado!</> : <><Copy size={12} />Copiar</>}
                </button>
              </div>
              <pre className="text-[10.5px] font-mono leading-relaxed text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                {snippet}
              </pre>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================
   TrackingClient — main component
   ============================================================ */

interface Props {
  initialPixels: RawPixelRow[]
  initialStats:  PixelStats
  userId:        string
}

export default function TrackingClient({ initialPixels, initialStats, userId }: Props) {
  const { track } = useAnalytics()
  const router     = useRouter()

  const [now,       setNow]       = useState(() => Date.now())
  const [stats,     setStats]     = useState<PixelStats>(initialStats)
  const [pixels,    setPixels]    = useState<PixelItem[]>(() => mergePixels(initialPixels, initialStats, Date.now()))
  const [editing,   setEditing]   = useState<PixelItem | null>(null)
  const [verifying, setVerifying] = useState<PixelItem | null>(null)
  const [toast,     setToast]     = useState<ToastState | null>(null)

  const statsRef        = useRef(stats)
  const pendingVerifyRef = useRef<PixelItem | null>(null)

  useEffect(() => { statsRef.current = stats }, [stats])

  // Auto-open verify when edit modal closes (after saving a new pixel)
  useEffect(() => {
    if (!editing && pendingVerifyRef.current) {
      const pixel = pendingVerifyRef.current
      pendingVerifyRef.current = null
      setVerifying(pixel)
    }
  }, [editing])

  // Tick — timestamps relativos corretos
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Toast auto-close
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3_500)
    return () => clearTimeout(t)
  }, [toast])

  // Auto-refresh de stats a cada 5 minutos
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const fresh = await fetchPixelStats()
        setStats(fresh)
        const lastEventMs = fresh.last_event ? new Date(fresh.last_event).getTime() : null
        const nowTs = Date.now()
        setPixels(prev => prev.map(p => ({
          ...p,
          eventsSentToday: fresh.events_sent_today,
          eventsMatched:   fresh.events_matched,
          lastEvent:       lastEventMs,
          status:          computeStatus(p.pixelId, p.dbStatus, lastEventMs, nowTs),
        })))
      } catch { /* silencioso — não quebra a UI */ }
    }, 5 * 60_000)
    return () => clearInterval(t)
  }, [])

  // Realtime — pixels (INSERT/UPDATE/DELETE)
  useEffect(() => {
    const sb  = createClient()
    const ch  = sb.channel('pixels-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pixels', filter: `user_id=eq.${userId}` },
        payload => {
          const lastEventMs = statsRef.current.last_event
            ? new Date(statsRef.current.last_event).getTime()
            : null
          const nowTs = Date.now()

          if (payload.eventType === 'DELETE') {
            const deletedProvider = (payload.old as { provider: string }).provider
            setPixels(prev => prev.map(p =>
              p.provider === deletedProvider
                ? { ...p, id: null, pixelId: null, pixelCode: null, hasToken: false, capi: false, events: defaultEvents(p.provider), status: 'inactive' as const, lastTestAt: null }
                : p
            ))
          } else {
            const row = payload.new as RawPixelRow
            setPixels(prev => prev.map(p =>
              p.provider === row.provider
                ? {
                    ...p,
                    id:         row.id,
                    pixelId:    row.pixel_id,
                    pixelCode:  row.pixel_code,
                    hasToken:   !!row.access_token,
                    events:     (row.events as Record<string, boolean>) || p.events,
                    capi:       row.capi,
                    lastTestAt: row.last_test_at ? new Date(row.last_test_at).getTime() : p.lastTestAt,
                    dbStatus:   row.status,
                    status:     computeStatus(row.pixel_id, row.status, lastEventMs, nowTs),
                  }
                : p
            ))
          }
        }
      )
      .subscribe()

    // Realtime — checkout_events: incrementa contador ao vivo
    const ch2 = sb.channel('checkout-events-tracking')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkout_events', filter: `user_id=eq.${userId}` },
        () => {
          setStats(s => ({ ...s, events_sent_today: s.events_sent_today + 1 }))
          setPixels(prev => prev.map(p => ({ ...p, eventsSentToday: p.eventsSentToday + 1 })))
        }
      )
      .subscribe()

    return () => {
      sb.removeChannel(ch)
      sb.removeChannel(ch2)
    }
  }, [userId])

  // ---- Handlers ----

  async function handleSavePixel(provider: string, patch: PixelPatch) {
    const wasNew = !editing?.id
    const currentEditing = editing!
    try {
      const result = await savePixelAction(provider, patch)
      router.refresh()
      const enabledCount = Object.values(patch.events).filter(Boolean).length
      track('pixel_configured', {
        provider,
        has_capi:             patch.capi && !patch.clearToken,
        events_enabled_count: enabledCount,
      })
      setToast({ msg: 'Pixel salvo com sucesso.', type: 'success' })

      // Se era pixel novo com ID configurado, abre verify após fechar o edit modal
      if (wasNew && patch.pixelId?.trim()) {
        const provisionalPixel: PixelItem = {
          ...currentEditing,
          id:         result.id,
          pixelId:    patch.pixelId.trim(),
          pixelCode:  patch.pixelCode?.trim() || null,
          hasToken:   !!(patch.newToken?.trim()),
          events:     patch.events,
          capi:       patch.capi,
          status:     'waiting',
          lastTestAt: null,
        }
        pendingVerifyRef.current = provisionalPixel
      }
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Erro ao salvar pixel.', type: 'error' })
      throw err
    }
  }

  function handleVerifyTrack(ok: boolean) {
    if (!verifying) return
    track('pixel_verified', { provider: verifying.provider, status: ok ? 'ok' : 'error' })
  }

  function handleTestSent(provider: string) {
    track('pixel_test_sent', { provider })
    // Atualiza lastTestAt localmente após teste bem-sucedido
    const nowTs = Date.now()
    setPixels(prev => prev.map(p => p.provider === provider ? { ...p, lastTestAt: nowTs } : p))
    if (verifying?.provider === provider) {
      setVerifying(v => v ? { ...v, lastTestAt: nowTs } : v)
    }
  }

  function handleUtmCopy(hasUtm: boolean) {
    track('utm_link_copied', { has_utm: hasUtm })
  }

  function handleExportJson() {
    const config = pixels
      .filter(p => p.pixelId)
      .map(p => ({
        provider:      p.provider,
        pixelId:       p.pixelId,
        pixelCode:     p.pixelCode,
        events:        p.events,
        capi:          p.capi,
        status:        p.status,
        lastTestAt:    p.lastTestAt ? new Date(p.lastTestAt).toISOString() : null,
        exportedAt:    new Date().toISOString(),
      }))

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `pixels-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- Totals ----

  const totals = useMemo(() => {
    const configured = pixels.filter(p => p.pixelId)
    const healthy    = pixels.filter(p => p.status === 'healthy').length
    const sent       = stats.events_sent_today
    const matched    = stats.events_matched
    const matchRate  = sent > 0 ? (matched / sent) * 100 : 0
    return { configured: configured.length, total: pixels.length, healthy, sent, matched, matchRate }
  }, [pixels, stats])

  const hasAnyPixelConfigured = totals.configured > 0

  // ---- Render ----

  return (
    <>
      <PageHeader
        title="Trackeamento"
        subtitle="Pixels, UTMs e atribuição multi-canal — Meta, TikTok e Google."
        actions={
          <div className="flex items-center gap-2">
            {hasAnyPixelConfigured && (
              <button
                onClick={handleExportJson}
                title="Exportar configurações dos pixels como JSON"
                className="inline-flex items-center gap-2 h-9 px-3 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <Download size={13} />Exportar JSON
              </button>
            )}
            <Link
              href="/dashboard/docs/07-analytics/visao-geral-analytics"
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <BookOpen size={14} />Documentação
            </Link>
          </div>
        }
      />

      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2.5 border rounded-lg px-3.5 py-2 ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} className="text-green-500" />
            : <XCircle      size={15} className="text-red-500" />}
          <div className={`text-[12.5px] ${toast.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{toast.msg}</div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiTr
          label="Pixels ativos"
          value={`${totals.configured} / ${totals.total}`}
          sub={totals.healthy > 0 ? `${totals.healthy} saudáve${totals.healthy === 1 ? 'l' : 'is'}` : 'nenhum saudável'}
          icon={Zap} tone="primary"
        />
        <KpiTr
          label="Eventos enviados (24h)"
          value={fmtNum(totals.sent)}
          sub="checkout_events · ao vivo"
          icon={Send}
        />
        <KpiTr
          label="Eventos com match"
          value={fmtNum(totals.matched)}
          sub="e-mail ou telefone"
          icon={CheckCircle2}
        />
        <KpiTr
          label="Match rate"
          value={totals.sent > 0 ? fmtPct(totals.matchRate, 1) : '—'}
          sub={totals.matchRate >= 85 ? 'excelente atribuição' : totals.sent > 0 ? 'configure CAPI para melhorar' : 'aguardando eventos'}
          icon={Target}
          highlight={totals.matchRate >= 85}
        />
      </div>

      {/* Banner: stats globais */}
      <div className="mb-5 flex items-center gap-2.5 bg-[var(--surface-2)]/50 border border-[var(--border)] rounded-lg px-3.5 py-2.5">
        <Wifi size={13} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-[12px] text-[var(--text-muted)]">
          {hasAnyPixelConfigured
            ? 'Estatísticas compartilhadas entre todos os pixels — os mesmos eventos de checkout são enviados para cada provider ativo. Contadores atualizam em tempo real via Supabase Realtime e a cada 5 minutos automaticamente.'
            : 'Configure um pixel para começar a rastrear conversões. Os eventos de venda, lead e checkout são enviados automaticamente para cada provider ativo.'}
        </span>
      </div>

      {/* Pixels section — sempre exibe os 3 cards */}
      <section className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Pixels & APIs de conversão</h2>
          <span className="text-[10.5px] text-[var(--text-muted)]">{pixels.length} plataformas</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {pixels.map(p => (
            <PixelCard key={p.provider} pixel={p} now={now} onEdit={setEditing} onCheck={setVerifying} />
          ))}
        </div>
      </section>

      {/* UTM section */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">UTM & atribuição</h2>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>
        <UTMSection onCopy={handleUtmCopy} />
      </section>

      {/* Snippets section */}
      {hasAnyPixelConfigured && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Instalação browser-side</h2>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <SnippetCard pixels={pixels} />
        </section>
      )}

      {/* Modals */}
      <EditPixelModal
        open={!!editing}
        onClose={() => setEditing(null)}
        pixel={editing}
        onSave={handleSavePixel}
      />
      <VerifyPixelModal
        open={!!verifying}
        onClose={() => setVerifying(null)}
        pixel={verifying}
        onVerifyTrack={handleVerifyTrack}
        onTestSent={handleTestSent}
      />
    </>
  )
}
