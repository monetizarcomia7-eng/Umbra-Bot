'use client'

import React, { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  ShoppingBag, Clock, Undo2, XCircle, AlertTriangle, UserPlus, ShoppingCart, UserX,
  WifiOff, CreditCard, Globe, Gauge, Calendar, CalendarDays, CalendarRange,
  Users, Shield, Mail, Bell, BellRing, Send, Save, Plug, X, Check, Loader2,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

type ChannelId = 'email' | 'panel' | 'telegram'
interface ChannelState { linked: boolean }
type ChannelMap = Record<ChannelId, ChannelState>
type EventPrefs = Record<string, { email: boolean; panel: boolean; telegram: boolean }>
interface QuietHours { enabled: boolean; from: string; to: string; exceptCritical: boolean }

export interface RawNotifPrefs {
  prefs: EventPrefs | null
  channel_state: ChannelMap | null
  quiet: QuietHours | null
}

/* ============================================================
   Catalog
   ============================================================ */

const CHANNELS: { id: ChannelId; label: string; icon: React.ElementType }[] = [
  { id: 'email',    label: 'E-mail',   icon: Mail },
  { id: 'panel',    label: 'Painel',   icon: Bell },
  { id: 'telegram', label: 'Telegram', icon: Send },
]

const ICON_MAP: Record<string, React.ElementType> = {
  'shopping-bag':   ShoppingBag,
  'clock':          Clock,
  'undo-2':         Undo2,
  'x-circle':       XCircle,
  'alert-triangle': AlertTriangle,
  'user-plus':      UserPlus,
  'shopping-cart':  ShoppingCart,
  'user-x':         UserX,
  'wifi-off':       WifiOff,
  'credit-card':    CreditCard,
  'webhook':        Globe,
  'gauge':          Gauge,
  'calendar':       Calendar,
  'calendar-days':  CalendarDays,
  'calendar-range': CalendarRange,
  'users':          Users,
  'shield':         Shield,
}

function DynIcon({ name, size = 11, className }: { name: string; size?: number; className?: string }) {
  const Comp = ICON_MAP[name] ?? Globe
  return <Comp size={size} className={className} />
}

const EVENT_CATALOG: { group: string; items: { id: string; label: string; severity: string; icon: string; desc: string }[] }[] = [
  {
    group: 'Vendas e pagamentos',
    items: [
      { id: 'sale_approved',  label: 'Nova venda aprovada',    severity: 'success', icon: 'shopping-bag',   desc: 'Venda confirmada e paga.' },
      { id: 'sale_pending',   label: 'Venda pendente',         severity: 'info',    icon: 'clock',          desc: 'Pix gerado, aguardando pagamento.' },
      { id: 'sale_refunded',  label: 'Estorno solicitado',     severity: 'warning', icon: 'undo-2',         desc: 'Cliente solicitou ou gateway estornou.' },
      { id: 'payment_failed', label: 'Pagamento falhou',       severity: 'danger',  icon: 'x-circle',       desc: 'Tentativa de cobrança rejeitada.' },
      { id: 'chargeback',     label: 'Chargeback recebido',    severity: 'danger',  icon: 'alert-triangle', desc: 'Contestação no cartão de crédito.' },
    ],
  },
  {
    group: 'Leads e contatos',
    items: [
      { id: 'lead_created',   label: 'Novo lead capturado',    severity: 'info',    icon: 'user-plus',      desc: 'Lead entrou em um funil.' },
      { id: 'cart_abandoned', label: 'Carrinho abandonado',    severity: 'warning', icon: 'shopping-cart',  desc: 'Iniciou checkout sem concluir.' },
      { id: 'lead_blocked',   label: 'Lead bloqueou o bot',    severity: 'muted',   icon: 'user-x',         desc: 'Cliente bloqueou ou parou o bot.' },
    ],
  },
  {
    group: 'Sistema e integrações',
    items: [
      { id: 'bot_down',       label: 'Bot desconectado',       severity: 'danger',  icon: 'wifi-off',       desc: 'Bot perdeu conexão com Telegram.' },
      { id: 'gateway_fail',   label: 'Gateway com falha',      severity: 'danger',  icon: 'credit-card',    desc: 'Erros consecutivos no gateway.' },
      { id: 'webhook_fail',   label: 'Webhook falhando',       severity: 'warning', icon: 'webhook',        desc: 'Endpoint retornou erros recentes.' },
      { id: 'quota_warning',  label: 'Limite do plano próximo',severity: 'warning', icon: 'gauge',          desc: 'Uso ≥ 80% do plano contratado.' },
    ],
  },
  {
    group: 'Resumos',
    items: [
      { id: 'daily_recap',    label: 'Resumo diário',          severity: 'info',    icon: 'calendar',       desc: 'Resumo das vendas e leads do dia.' },
      { id: 'weekly_recap',   label: 'Resumo semanal',         severity: 'info',    icon: 'calendar-days',  desc: 'Performance semanal consolidada.' },
      { id: 'monthly_recap',  label: 'Fechamento mensal',      severity: 'info',    icon: 'calendar-range', desc: 'Relatório financeiro do mês.' },
    ],
  },
  {
    group: 'Equipe',
    items: [
      { id: 'team_invite',    label: 'Convite aceito',         severity: 'info',    icon: 'users',          desc: 'Quando um membro aceita o convite.' },
      { id: 'role_change',    label: 'Mudança de papel',       severity: 'info',    icon: 'shield',         desc: 'Um membro teve o papel alterado.' },
    ],
  },
]

const SEVERITY_CLS: Record<string, string> = {
  success: 'text-success', info: 'text-primary',
  warning: 'text-warning', danger: 'text-danger', muted: 'text-text-muted',
}

const TOTAL_EVENTS = EVENT_CATALOG.reduce((s, g) => s + g.items.length, 0)

/* ============================================================
   Default state
   ============================================================ */

const DEFAULT_PREFS: EventPrefs = {
  sale_approved:  { email: true,  panel: true,  telegram: true  },
  sale_pending:   { email: false, panel: true,  telegram: false },
  sale_refunded:  { email: true,  panel: true,  telegram: true  },
  payment_failed: { email: true,  panel: true,  telegram: true  },
  chargeback:     { email: true,  panel: true,  telegram: true  },
  lead_created:   { email: false, panel: true,  telegram: false },
  cart_abandoned: { email: false, panel: true,  telegram: true  },
  lead_blocked:   { email: false, panel: true,  telegram: false },
  bot_down:       { email: true,  panel: true,  telegram: true  },
  gateway_fail:   { email: true,  panel: true,  telegram: true  },
  webhook_fail:   { email: true,  panel: true,  telegram: false },
  quota_warning:  { email: true,  panel: true,  telegram: false },
  daily_recap:    { email: true,  panel: false, telegram: false },
  weekly_recap:   { email: true,  panel: false, telegram: false },
  monthly_recap:  { email: true,  panel: false, telegram: false },
  team_invite:    { email: true,  panel: true,  telegram: false },
  role_change:    { email: false, panel: true,  telegram: false },
}

const DEFAULT_QUIET: QuietHours = { enabled: true, from: '22:00', to: '07:00', exceptCritical: true }

function buildDefaultChannels(hasBot: boolean): ChannelMap {
  return {
    email:    { linked: true },
    panel:    { linked: true },
    telegram: { linked: hasBot },
  }
}

/* ============================================================
   Shared UI
   ============================================================ */

function Btn({ variant = 'secondary', size = 'sm', icon, disabled = false, onClick, children }: {
  variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md'
  icon?: React.ReactNode; disabled?: boolean; onClick?: () => void; children?: React.ReactNode
}) {
  const sz = size === 'md' ? 'h-9 px-4 text-[12.5px]' : 'h-8 px-3 text-[12px]'
  const v = variant === 'primary' ? 'bg-primary text-white hover:opacity-90'
    : variant === 'ghost' ? 'text-text-muted hover:bg-surface-2 hover:text-text'
    : 'bg-surface-2 text-text border border-border hover:bg-surface-3'
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${v}`}>
      {icon}{children}
    </button>
  )
}

function Card({ title, subtitle, children, noPadding = false }: {
  title: string; subtitle?: string; children: React.ReactNode; noPadding?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-[13.5px] font-semibold text-text">{title}</div>
        {subtitle && <div className="text-[11.5px] text-text-muted mt-0.5">{subtitle}</div>}
      </div>
      <div className={noPadding ? '' : 'px-5 py-5'}>{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-2 border border-border'}`}>
      <span className="pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  )
}

function ToggleBox({ enabled, disabled }: { enabled: boolean; disabled: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center w-9 h-5 rounded-full transition-colors ${
      disabled ? 'bg-surface-2 cursor-not-allowed opacity-40'
      : enabled ? 'bg-primary' : 'bg-surface-3 border border-border'
    }`}>
      <span className="w-3.5 h-3.5 rounded-full bg-white transition-transform"
        style={{ transform: enabled ? 'translateX(8px)' : 'translateX(-8px)', boxShadow: '0 1px 2px rgb(0 0 0/.15)' }} />
    </span>
  )
}

/* ============================================================
   ChannelsCard
   ============================================================ */

function ChannelsCard({ channelState, descs, onUpdate }: {
  channelState: ChannelMap
  descs: Record<ChannelId, string>
  onUpdate: (id: ChannelId, patch: Partial<ChannelState>) => void
}) {
  return (
    <Card title="Canais de envio" subtitle="Onde você recebe as notificações.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CHANNELS.map(c => {
          const linked = channelState[c.id]?.linked
          const Icon = c.icon
          return (
            <div key={c.id} className="bg-surface border border-border rounded-lg p-3.5">
              <div className="flex items-start gap-2.5">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${linked ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-text-muted'}`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text">{c.label}</div>
                  <div className="text-[10.5px] text-text-muted truncate">{descs[c.id]}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {linked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border bg-success-soft text-success border-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> Vinculado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border bg-warning-soft text-warning border-warning/20">
                    Não vinculado
                  </span>
                )}
                {linked ? (
                  <Btn variant="ghost" size="sm" onClick={() => onUpdate(c.id, { linked: false })}>Desvincular</Btn>
                ) : (
                  <Btn variant="secondary" size="sm" icon={<Plug size={12} />} onClick={() => onUpdate(c.id, { linked: true })}>Vincular</Btn>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ============================================================
   PreferencesTable — events × channels matrix
   ============================================================ */

function PreferencesTable({ prefs, setPrefs, channelState }: {
  prefs: EventPrefs
  setPrefs: React.Dispatch<React.SetStateAction<EventPrefs>>
  channelState: ChannelMap
}) {
  function toggle(eventId: string, channelId: ChannelId) {
    setPrefs(p => ({ ...p, [eventId]: { ...p[eventId], [channelId]: !p[eventId]?.[channelId] } }))
  }

  function toggleColumn(channelId: ChannelId, value: boolean) {
    setPrefs(p => {
      const next = { ...p }
      EVENT_CATALOG.forEach(g => g.items.forEach(e => {
        next[e.id] = { ...next[e.id], [channelId]: value }
      }))
      return next
    })
  }

  function toggleRow(eventId: string, value: boolean) {
    setPrefs(p => ({ ...p, [eventId]: { email: value, panel: value, telegram: value } }))
  }

  const counts = useMemo(() => {
    const out: Record<ChannelId, number> = { email: 0, panel: 0, telegram: 0 }
    EVENT_CATALOG.forEach(g => g.items.forEach(e => {
      CHANNELS.forEach(c => { if (prefs[e.id]?.[c.id]) out[c.id]++ })
    }))
    return out
  }, [prefs])

  return (
    <Card title="Preferências por evento" subtitle="Escolha quais canais alertam você em cada tipo de evento." noPadding>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] border-collapse min-w-[700px]">
          <thead>
            <tr className="border-t border-border bg-surface-2/30">
              <th className="text-left pl-5 pr-2 py-3 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">Evento</th>
              {CHANNELS.map(c => {
                const allOn  = counts[c.id] === TOTAL_EVENTS
                const noneOn = counts[c.id] === 0
                const linked = channelState[c.id]?.linked
                const Icon = c.icon
                return (
                  <th key={c.id} className="px-2 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-text">
                        <Icon size={12} className={linked ? 'text-primary' : 'text-text-muted'} />
                        {c.label}
                        {!linked && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-warning-soft text-warning border border-warning/20">off</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-text-muted">{counts[c.id]}/{TOTAL_EVENTS}</span>
                        <span className="text-text-muted">·</span>
                        <button onClick={() => toggleColumn(c.id, true)} disabled={allOn}
                          className="text-primary hover:underline disabled:opacity-30">tudo</button>
                        <span className="text-text-muted">·</span>
                        <button onClick={() => toggleColumn(c.id, false)} disabled={noneOn}
                          className="text-text-muted hover:text-text disabled:opacity-30">nenhum</button>
                      </div>
                    </div>
                  </th>
                )
              })}
              <th className="px-3 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {EVENT_CATALOG.map(group => (
              <React.Fragment key={group.group}>
                <tr className="bg-surface-2/20 border-t border-border">
                  <td colSpan={CHANNELS.length + 2} className="pl-5 pr-3 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">
                    {group.group}
                  </td>
                </tr>
                {group.items.map(e => {
                  const rowOn = CHANNELS.every(c => prefs[e.id]?.[c.id])
                  return (
                    <tr key={e.id} className="border-t border-border hover:bg-surface-2/40">
                      <td className="pl-5 pr-2 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
                            <DynIcon name={e.icon} size={11} className={SEVERITY_CLS[e.severity]} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-text">{e.label}</div>
                            <div className="text-[10.5px] text-text-muted truncate max-w-xs">{e.desc}</div>
                          </div>
                        </div>
                      </td>
                      {CHANNELS.map(c => {
                        const enabled    = prefs[e.id]?.[c.id] ?? false
                        const channelOff = !channelState[c.id]?.linked
                        return (
                          <td key={c.id} className="px-2 py-2.5 text-center">
                            <button onClick={() => toggle(e.id, c.id)} disabled={channelOff}
                              title={channelOff ? `Canal ${c.label} não vinculado` : ''}
                              className="inline-flex items-center justify-center">
                              <ToggleBox enabled={enabled} disabled={channelOff} />
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => toggleRow(e.id, !rowOn)}
                          className="text-[10px] text-text-muted hover:text-text focus:outline-none rounded px-1">
                          {rowOn ? 'desligar' : 'ligar todos'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ============================================================
   QuietHoursCard
   ============================================================ */

const TIME_INPUT = 'w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60'

function QuietHoursCard({ quiet, setQuiet }: {
  quiet: QuietHours
  setQuiet: React.Dispatch<React.SetStateAction<QuietHours>>
}) {
  return (
    <Card title="Horário de silêncio" subtitle="Pausa notificações em determinado período do dia (exceto eventos críticos).">
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-[12.5px] font-medium text-text">Ativar horário de silêncio</div>
            <div className="text-[11.5px] text-text-muted">
              {quiet.enabled
                ? `Silêncio das ${quiet.from} às ${quiet.to} no fuso America/Sao_Paulo.`
                : 'Receber notificações 24/7.'}
            </div>
          </div>
          <Toggle checked={quiet.enabled} onChange={v => setQuiet(q => ({ ...q, enabled: v }))} />
        </label>

        {quiet.enabled && (
          <div className="grid grid-cols-2 gap-3 max-w-md pt-2 border-t border-border">
            <div>
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-1">De</label>
              <input type="time" value={quiet.from}
                onChange={e => setQuiet(q => ({ ...q, from: e.target.value }))}
                className={TIME_INPUT} />
            </div>
            <div>
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-1">Até</label>
              <input type="time" value={quiet.to}
                onChange={e => setQuiet(q => ({ ...q, to: e.target.value }))}
                className={TIME_INPUT} />
            </div>
          </div>
        )}

        {quiet.enabled && (
          <label className="flex items-center justify-between gap-4 cursor-pointer pt-2 border-t border-border">
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-text">Exceto eventos críticos</div>
              <div className="text-[11.5px] text-text-muted leading-snug">
                Bot desconectado, gateway com falha e chargeback continuam alertando.
              </div>
            </div>
            <Toggle checked={quiet.exceptCritical} onChange={v => setQuiet(q => ({ ...q, exceptCritical: v }))} />
          </label>
        )}
      </div>
    </Card>
  )
}

/* ============================================================
   NotificationsClient
   ============================================================ */

export function NotificationsClient({
  userId,
  userEmail,
  initialPrefs,
  firstBot,
}: {
  userId: string
  userEmail: string
  initialPrefs: RawNotifPrefs | null
  firstBot: { name: string; username: string | null } | null
}) {
  const defaultChannels = useMemo(() => buildDefaultChannels(!!firstBot), [firstBot])

  const [prefs, setPrefs]               = useState<EventPrefs>(initialPrefs?.prefs    ?? DEFAULT_PREFS)
  const [channelState, setChannelState] = useState<ChannelMap>(initialPrefs?.channel_state ?? defaultChannels)
  const [quiet, setQuiet]               = useState<QuietHours>(initialPrefs?.quiet    ?? DEFAULT_QUIET)
  const [snapshot, setSnapshot]         = useState({
    prefs:    initialPrefs?.prefs    ?? DEFAULT_PREFS,
    channels: initialPrefs?.channel_state ?? defaultChannels,
    quiet:    initialPrefs?.quiet    ?? DEFAULT_QUIET,
  })
  const [saved,  setSaved]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Descrições dinâmicas dos canais baseadas nos dados reais do usuário
  const channelDescs: Record<ChannelId, string> = {
    email:    userEmail || 'Seu e-mail de cadastro',
    panel:    'Sino + página de Atividade',
    telegram: firstBot
      ? `Bot @${firstBot.username ?? firstBot.name}`
      : 'Nenhum bot configurado',
  }

  const dirty = JSON.stringify({ prefs, channelState, quiet }) !== JSON.stringify({ prefs: snapshot.prefs, channelState: snapshot.channels, quiet: snapshot.quiet })

  async function save() {
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: dbError } = await supabase
        .from('notification_prefs')
        .upsert(
          {
            user_id:       userId,
            prefs,
            channel_state: channelState,
            quiet,
            updated_at:    new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
      if (dbError) throw dbError
      setSnapshot({ prefs, channels: channelState, quiet })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('[NotificationsClient] save error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.length < 80 ? msg : 'Erro ao salvar. Tente novamente.')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    setPrefs(snapshot.prefs)
    setChannelState(snapshot.channels)
    setQuiet(snapshot.quiet)
  }

  function reset() {
    setPrefs(DEFAULT_PREFS)
    setChannelState(defaultChannels)
    setQuiet(DEFAULT_QUIET)
  }

  function updateChannel(id: ChannelId, patch: Partial<ChannelState>) {
    setChannelState(s => ({ ...s, [id]: { ...s[id], ...patch } }))
  }

  const totals = useMemo(() => {
    let total = 0, enabled = 0
    EVENT_CATALOG.forEach(g => g.items.forEach(e => {
      CHANNELS.forEach(c => { total++; if (prefs[e.id]?.[c.id]) enabled++ })
    }))
    return { total, enabled }
  }, [prefs])

  return (
    <DashboardLayout>
      <PageHeader
        title="Notificações"
        subtitle="Escolha quando e como você quer ser avisado pelo Umbra Bot."
        actions={
          <>
            {saved && (
              <span className="text-[12px] text-success flex items-center gap-1 mr-1">
                <Check size={12} /> Preferências salvas
              </span>
            )}
            {error && (
              <span className="text-[12px] text-danger flex items-center gap-1 mr-1">
                {error}
              </span>
            )}
            <Btn variant="ghost" size="md" onClick={reset}>Restaurar padrão</Btn>
            {dirty && !saved && <Btn variant="ghost" size="md" onClick={discard}>Descartar</Btn>}
            <Btn
              variant="primary" size="md"
              icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? 'Salvando…' : 'Salvar preferências'}
            </Btn>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2 text-[11.5px] text-text-muted">
        <BellRing size={12} className="text-primary" />
        <span>
          <span className="font-semibold text-text">{totals.enabled}</span> de <span>{totals.total}</span> notificações ligadas
          {' · '}
          horário de silêncio {quiet.enabled
            ? <span className="text-text">das {quiet.from} às {quiet.to}</span>
            : <span>desativado</span>}
        </span>
      </div>

      <div className="space-y-4 max-w-[1100px]">
        <ChannelsCard channelState={channelState} descs={channelDescs} onUpdate={updateChannel} />
        <PreferencesTable prefs={prefs} setPrefs={setPrefs} channelState={channelState} />
        <QuietHoursCard quiet={quiet} setQuiet={setQuiet} />

        <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-xl px-4 py-3">
          <div className="text-[11.5px] text-text-muted leading-relaxed">
            Alterações em preferências entram em vigor imediatamente após salvar.
            {dirty && <span className="text-warning"> · Você tem alterações não salvas.</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {dirty && !saved && <Btn variant="ghost" size="sm" onClick={discard}><X size={12} />Descartar</Btn>}
            <Btn
              variant="primary" size="sm"
              icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? 'Salvando…' : 'Salvar preferências'}
            </Btn>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
