'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  saveNotificationPrefsAction,
  generateTelegramVerifyCodeAction,
  checkTelegramLinkStatusAction,
  unlinkTelegramChannelAction,
  testTelegramNotificationAction,
  testPanelNotificationAction,
} from '@/app/actions/notifications'
import {
  ShoppingBag, Clock, Undo2, XCircle, AlertTriangle, UserPlus, ShoppingCart, UserX,
  WifiOff, CreditCard, Globe, Gauge, Calendar, CalendarDays, CalendarRange,
  Users, Shield, Mail, Bell, BellRing, Send, Save, X, Check, Loader2,
  ChevronDown, RefreshCw, Unplug,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

type ChannelId = 'email' | 'panel' | 'telegram'

interface TelegramChannelState {
  linked: boolean
  bot_id?: string
  bot_name?: string
  owner_chat_id?: string
}

type ChannelStateEntry = { linked: boolean } | TelegramChannelState
type ChannelMap = Record<ChannelId, ChannelStateEntry>
type EventPrefs = Record<string, { email: boolean; panel: boolean; telegram: boolean }>
interface QuietHours { enabled: boolean; from: string; to: string; exceptCritical: boolean }

export interface RawNotifPrefs {
  prefs: EventPrefs | null
  channel_state: Record<string, unknown> | null
  quiet: QuietHours | null
}

export interface RawBotOption {
  id: string
  name: string
  username: string | null
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

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

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

function buildDefaultChannels(): ChannelMap {
  return {
    email:    { linked: true },
    panel:    { linked: true },
    telegram: { linked: false, bot_id: undefined, bot_name: undefined, owner_chat_id: undefined },
  }
}

function parseTelegramState(raw: Record<string, unknown> | null): TelegramChannelState {
  const tg = raw?.telegram as Record<string, unknown> | undefined
  return {
    linked:        (tg?.linked as boolean) ?? false,
    bot_id:        (tg?.bot_id  as string | undefined),
    bot_name:      (tg?.bot_name as string | undefined),
    owner_chat_id: (tg?.owner_chat_id as string | undefined),
  }
}

/* ============================================================
   Shared UI
   ============================================================ */

function Btn({ variant = 'secondary', size = 'sm', icon, disabled = false, loading = false, onClick, children }: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  children?: React.ReactNode
}) {
  const sz = size === 'md' ? 'h-9 px-4 text-[12.5px]' : 'h-8 px-3 text-[12px]'
  const v = variant === 'primary' ? 'bg-primary text-white hover:opacity-90'
    : variant === 'danger'  ? 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20'
    : variant === 'ghost'   ? 'text-text-muted hover:bg-surface-2 hover:text-text'
    : 'bg-surface-2 text-text border border-border hover:bg-surface-3'
  return (
    <button type="button" disabled={disabled || loading} onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${v}`}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon}{children}
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
   TelegramChannelCard — fluxo de vinculação via código
   ============================================================ */

type TgFlowStep = 'linked' | 'idle' | 'select_bot' | 'code_pending' | 'verifying'

function TelegramChannelCard({
  tgState,
  bots,
  onLinked,
  onUnlinked,
}: {
  tgState:   TelegramChannelState
  bots:      RawBotOption[]
  onLinked:  (updated: TelegramChannelState) => void
  onUnlinked:() => void
}) {
  const [step,        setStep]        = useState<TgFlowStep>(tgState.linked ? 'linked' : 'idle')
  const [selectedBot, setSelectedBot] = useState(bots[0]?.id ?? '')
  const [code,        setCode]        = useState('')
  const [codeExpiry,  setCodeExpiry]  = useState(0)
  const [botName,     setBotName]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testMsg,     setTestMsg]     = useState<{ ok: boolean; msg: string } | null>(null)
  const [error,       setError]       = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const testMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Calcula segundos restantes até o código expirar
  const [secsLeft, setSecsLeft] = useState(0)
  useEffect(() => {
    if (step !== 'code_pending' || !codeExpiry) return
    const tick = () => setSecsLeft(Math.max(0, Math.ceil((codeExpiry - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [step, codeExpiry])

  // Polling enquanto aguarda verificação
  useEffect(() => {
    if (step !== 'code_pending' && step !== 'verifying') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(async () => {
      const res = await checkTelegramLinkStatusAction()
      if (res.linked) {
        if (pollRef.current) clearInterval(pollRef.current)
        setStep('linked')
        onLinked({ linked: true, bot_id: selectedBot || tgState.bot_id, bot_name: res.botName ?? botName, owner_chat_id: res.ownerChatId })
      }
    }, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Limpa timer do testMsg no unmount
  useEffect(() => () => { if (testMsgTimerRef.current) clearTimeout(testMsgTimerRef.current) }, [])

  async function handleGenerateCode() {
    if (!selectedBot) { setError('Selecione um bot para continuar.'); return }
    setLoading(true); setError('')
    const res = await generateTelegramVerifyCodeAction(selectedBot)
    setLoading(false)
    if (!res.ok) { setError(res.error ?? 'Erro ao gerar código.'); return }
    setCode(res.code!)
    setCodeExpiry(res.expiresAt!)
    setBotName(res.botName ?? '')
    setStep('code_pending')
  }

  async function handleUnlink() {
    setLoading(true)
    await unlinkTelegramChannelAction()
    setLoading(false)
    setStep('idle')
    setCode('')
    onUnlinked()
  }

  async function handleTest() {
    setTestLoading(true)
    const res = await testTelegramNotificationAction()
    setTestLoading(false)
    setTestMsg({ ok: res.ok, msg: res.ok ? 'Mensagem enviada com sucesso!' : (res.error ?? 'Falha ao enviar.') })
    if (testMsgTimerRef.current) clearTimeout(testMsgTimerRef.current)
    testMsgTimerRef.current = setTimeout(() => setTestMsg(null), 4000)
  }

  function handleCancel() {
    setStep('idle'); setCode(''); setError('')
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const displayName = tgState.bot_name || botName || (bots.find(b => b.id === (tgState.bot_id || selectedBot))?.username
    ? `@${bots.find(b => b.id === (tgState.bot_id || selectedBot))!.username!}`
    : bots.find(b => b.id === (tgState.bot_id || selectedBot))?.name ?? 'bot')

  return (
    <div className="bg-surface border border-border rounded-lg p-3.5">
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${step === 'linked' ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-text-muted'}`}>
          <Send size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text">Telegram</div>
          <div className="text-[10.5px] text-text-muted truncate">
            {step === 'linked' ? displayName : 'Receba alertas no seu bot'}
          </div>
        </div>
      </div>

      {/* ── Estado: Vinculado ── */}
      {step === 'linked' && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border bg-success-soft text-success border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> Vinculado
            </span>
            <div className="flex items-center gap-1">
              <Btn variant="secondary" size="sm" icon={<Send size={11} />} loading={testLoading} onClick={handleTest}>Testar</Btn>
              <Btn variant="ghost" size="sm" icon={<Unplug size={11} />} loading={loading} onClick={handleUnlink}>Desvincular</Btn>
            </div>
          </div>
          {testMsg && (
            <div className={`text-[11px] px-2.5 py-1.5 rounded-md ${testMsg.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
              {testMsg.msg}
            </div>
          )}
        </div>
      )}

      {/* ── Estado: Ocioso ── */}
      {step === 'idle' && (
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border bg-warning-soft text-warning border-warning/20">
            Não vinculado
          </span>
          {bots.length === 0 ? (
            <span className="text-[11px] text-text-muted">Nenhum bot configurado</span>
          ) : (
            <Btn variant="secondary" size="sm" icon={<Send size={12} />} onClick={() => setStep('select_bot')}>Vincular</Btn>
          )}
        </div>
      )}

      {/* ── Estado: Seleção de bot ── */}
      {step === 'select_bot' && (
        <div className="mt-3 space-y-2.5">
          <div>
            <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-1">Bot para receber alertas</label>
            <div className="relative">
              <select
                value={selectedBot}
                onChange={e => setSelectedBot(e.target.value)}
                className="w-full h-9 pl-3 pr-8 bg-surface border border-border rounded-lg text-[12.5px] text-text appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {bots.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.username ? `@${b.username}` : b.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>
          {error && <div className="text-[11px] text-danger">{error}</div>}
          <div className="flex items-center gap-2">
            <Btn variant="primary" size="sm" loading={loading} onClick={handleGenerateCode}>Gerar código</Btn>
            <Btn variant="ghost" size="sm" onClick={handleCancel}>Cancelar</Btn>
          </div>
        </div>
      )}

      {/* ── Estado: Código gerado ── */}
      {step === 'code_pending' && (
        <div className="mt-3 space-y-3">
          <div className="bg-surface-2 rounded-lg px-4 py-3 text-center space-y-1">
            <div className="text-[11px] text-text-muted">Envie este código para <span className="font-semibold text-text">{botName}</span></div>
            <div className="text-[28px] font-mono font-bold tracking-[0.3em] text-primary">{code}</div>
            {secsLeft > 0
              ? <div className="text-[10.5px] text-text-muted">Expira em {secsLeft}s</div>
              : <div className="text-[10.5px] text-danger">Código expirado</div>
            }
          </div>
          <div className="text-[11px] text-text-muted leading-relaxed">
            Abra o Telegram, encontre <span className="font-medium text-text">{botName}</span>, inicie uma conversa e envie o código acima. A vinculação será confirmada automaticamente.
          </div>
          {secsLeft === 0 ? (
            <div className="flex items-center gap-2">
              <Btn variant="primary" size="sm" loading={loading} icon={<RefreshCw size={11} />} onClick={handleGenerateCode}>Gerar novo código</Btn>
              <Btn variant="ghost" size="sm" onClick={handleCancel}>Cancelar</Btn>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Loader2 size={11} className="animate-spin text-primary" />
                Aguardando verificação…
              </div>
              <Btn variant="ghost" size="sm" onClick={handleCancel}>Cancelar</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   ChannelsCard
   ============================================================ */

function ChannelsCard({
  tgState,
  bots,
  userEmail,
  onTgLinked,
  onTgUnlinked,
}: {
  tgState:    TelegramChannelState
  bots:       RawBotOption[]
  userEmail:  string
  onTgLinked: (updated: TelegramChannelState) => void
  onTgUnlinked: () => void
}) {
  const [panelTestLoading, setPanelTestLoading] = useState(false)
  const [panelTestMsg,     setPanelTestMsg]     = useState<{ ok: boolean; msg: string } | null>(null)
  const [emailTestMsg,     setEmailTestMsg]     = useState<{ ok: boolean; msg: string } | null>(null)
  const panelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (panelTimerRef.current) clearTimeout(panelTimerRef.current)
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current)
  }, [])

  async function handlePanelTest() {
    setPanelTestLoading(true)
    const res = await testPanelNotificationAction()
    setPanelTestLoading(false)
    setPanelTestMsg({
      ok:  res.ok,
      msg: res.ok ? 'Notificação criada! Veja em Alertas.' : (res.error ?? 'Erro ao criar notificação.'),
    })
    if (panelTimerRef.current) clearTimeout(panelTimerRef.current)
    panelTimerRef.current = setTimeout(() => setPanelTestMsg(null), 4000)
  }

  function handleEmailTest() {
    setEmailTestMsg({ ok: false, msg: 'Envio de e-mails em breve.' })
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current)
    emailTimerRef.current = setTimeout(() => setEmailTestMsg(null), 3000)
  }

  return (
    <Card title="Canais de envio" subtitle="Onde você recebe as notificações.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* E-mail */}
        <div className="bg-surface border border-border rounded-lg p-3.5">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-primary/10 text-primary">
              <Mail size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-text">E-mail</div>
              <div className="text-[10.5px] text-text-muted truncate">{userEmail || 'Seu e-mail de cadastro'}</div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border bg-success-soft text-success border-success/20">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> Ativo
              </span>
              <Btn variant="secondary" size="sm" icon={<Mail size={11} />} onClick={handleEmailTest}>Testar</Btn>
            </div>
            {emailTestMsg && (
              <div className="text-[11px] px-2.5 py-1.5 rounded-md bg-surface-2 text-text-muted">
                {emailTestMsg.msg}
              </div>
            )}
          </div>
        </div>

        {/* Painel */}
        <div className="bg-surface border border-border rounded-lg p-3.5">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-primary/10 text-primary">
              <Bell size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-text">Painel</div>
              <div className="text-[10.5px] text-text-muted truncate">Sino + página de Alertas</div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border bg-success-soft text-success border-success/20">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> Ativo
              </span>
              <Btn variant="secondary" size="sm" icon={<Bell size={11} />} loading={panelTestLoading} onClick={handlePanelTest}>Testar</Btn>
            </div>
            {panelTestMsg && (
              <div className={`text-[11px] px-2.5 py-1.5 rounded-md ${panelTestMsg.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                {panelTestMsg.msg}
              </div>
            )}
          </div>
        </div>

        {/* Telegram — fluxo especial */}
        <TelegramChannelCard
          tgState={tgState}
          bots={bots}
          onLinked={onTgLinked}
          onUnlinked={onTgUnlinked}
        />
      </div>
    </Card>
  )
}

/* ============================================================
   PreferencesTable
   ============================================================ */

function PreferencesTable({ prefs, setPrefs, channelState, tgState }: {
  prefs: EventPrefs
  setPrefs: React.Dispatch<React.SetStateAction<EventPrefs>>
  channelState: ChannelMap
  tgState: TelegramChannelState
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
                const linked = c.id === 'telegram'
                  ? tgState.linked
                  : ((channelState[c.id] as { linked: boolean })?.linked ?? false)
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
                        const channelOff = c.id === 'telegram'
                          ? !tgState.linked
                          : !((channelState[c.id] as { linked: boolean })?.linked ?? false)
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
  const [fromErr, setFromErr] = useState(false)
  const [toErr,   setToErr]   = useState(false)

  function handleFrom(v: string) {
    setQuiet(q => ({ ...q, from: v }))
    setFromErr(!!v && !TIME_REGEX.test(v))
  }

  function handleTo(v: string) {
    setQuiet(q => ({ ...q, to: v }))
    setToErr(!!v && !TIME_REGEX.test(v))
  }

  return (
    <Card title="Horário de silêncio" subtitle="Pausa notificações em determinado período do dia (exceto eventos críticos).">
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <div className="text-[12.5px] font-medium text-text">Ativar horário de silêncio</div>
            <div className="text-[11.5px] text-text-muted">
              {quiet.enabled
                ? `Silêncio das ${quiet.from} às ${quiet.to} (America/Sao_Paulo).`
                : 'Receber notificações 24/7.'}
            </div>
          </div>
          <Toggle checked={quiet.enabled} onChange={v => setQuiet(q => ({ ...q, enabled: v }))} />
        </label>

        {quiet.enabled && (
          <div className="grid grid-cols-2 gap-3 max-w-md pt-2 border-t border-border">
            <div>
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-1">De</label>
              <input
                type="time"
                value={quiet.from}
                onChange={e => handleFrom(e.target.value)}
                className={`${TIME_INPUT} ${fromErr ? 'border-danger/60 ring-2 ring-danger/20' : ''}`}
              />
              {fromErr && <div className="text-[10.5px] text-danger mt-0.5">Horário inválido (HH:MM)</div>}
            </div>
            <div>
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-1">Até</label>
              <input
                type="time"
                value={quiet.to}
                onChange={e => handleTo(e.target.value)}
                className={`${TIME_INPUT} ${toErr ? 'border-danger/60 ring-2 ring-danger/20' : ''}`}
              />
              {toErr && <div className="text-[10.5px] text-danger mt-0.5">Horário inválido (HH:MM)</div>}
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
  bots,
}: {
  userId:       string
  userEmail:    string
  initialPrefs: RawNotifPrefs | null
  bots:         RawBotOption[]
}) {
  const { track } = useAnalytics()

  const initTgState  = parseTelegramState(initialPrefs?.channel_state ?? null)
  const defaultChans = buildDefaultChannels()

  // email e panel são sempre ativos — sem toggle (sem backend de envio de e-mail por ora)
  const buildChannelMap = (_raw: Record<string, unknown> | null): ChannelMap => ({
    email:    { linked: true },
    panel:    { linked: true },
    telegram: { linked: false }, // telegram gerenciado pelo tgState separadamente
  })

  const [prefs,        setPrefs]        = useState<EventPrefs>(initialPrefs?.prefs    ?? DEFAULT_PREFS)
  const [channelState, setChannelState] = useState<ChannelMap>(buildChannelMap(initialPrefs?.channel_state ?? null))
  const [tgState,      setTgState]      = useState<TelegramChannelState>(initTgState)
  const [quiet,        setQuiet]        = useState<QuietHours>(initialPrefs?.quiet    ?? DEFAULT_QUIET)

  const [snapshot, setSnapshot] = useState({
    prefs:    initialPrefs?.prefs    ?? DEFAULT_PREFS,
    channels: buildChannelMap(initialPrefs?.channel_state ?? null),
    tg:       initTgState,
    quiet:    initialPrefs?.quiet    ?? DEFAULT_QUIET,
  })

  const [saved,             setSaved]             = useState(false)
  const [saving,            setSaving]            = useState(false)
  const [error,             setError]             = useState('')
  const [resetConfirmOpen,  setResetConfirmOpen]  = useState(false)

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
  }, [])

  // Dirty check memoizado — não recalcula a cada render
  const dirty = useMemo(() => (
    JSON.stringify(prefs)        !== JSON.stringify(snapshot.prefs)    ||
    JSON.stringify(channelState) !== JSON.stringify(snapshot.channels) ||
    JSON.stringify(tgState)      !== JSON.stringify(snapshot.tg)       ||
    JSON.stringify(quiet)        !== JSON.stringify(snapshot.quiet)
  ), [prefs, channelState, tgState, quiet, snapshot])

  function buildFullChannelState(): Record<string, unknown> {
    return {
      email:    channelState.email,
      panel:    channelState.panel,
      telegram: {
        linked:        tgState.linked,
        bot_id:        tgState.bot_id,
        bot_name:      tgState.bot_name,
        owner_chat_id: tgState.owner_chat_id,
      },
    }
  }

  async function save() {
    // Valida horários de silêncio
    if (quiet.enabled && (!TIME_REGEX.test(quiet.from) || !TIME_REGEX.test(quiet.to))) {
      setError('Corrija os horários de silêncio antes de salvar.')
      return
    }

    setSaving(true); setError('')
    const res = await saveNotificationPrefsAction(prefs, buildFullChannelState() as Parameters<typeof saveNotificationPrefsAction>[1], quiet)
    setSaving(false)

    if (!res.ok) {
      setError(res.error ?? 'Erro ao salvar.')
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      errorTimerRef.current = setTimeout(() => setError(''), 5000)
      return
    }

    setSnapshot({ prefs, channels: channelState, tg: tgState, quiet })
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2500)
    if (JSON.stringify(quiet) !== JSON.stringify(snapshot.quiet)) {
      track('notifications_quiet_hours_set', {})
    }
    track('notifications_saved', { channels_enabled: Object.values(channelState).filter(c => (c as { linked: boolean }).linked).length + (tgState.linked ? 1 : 0), telegram_linked: tgState.linked })
  }

  function discard() {
    setPrefs(snapshot.prefs); setChannelState(snapshot.channels); setTgState(snapshot.tg); setQuiet(snapshot.quiet)
  }

  function reset() {
    setPrefs(DEFAULT_PREFS); setChannelState(defaultChans)
    setTgState({ linked: false }); setQuiet(DEFAULT_QUIET)
    track('notifications_reset_to_default', {})
  }

  const handleTgLinked = useCallback((updated: TelegramChannelState) => {
    setTgState(updated)
    setSnapshot(s => ({ ...s, tg: updated }))
    track('notifications_channel_toggled', { channel: 'telegram', linked: true })
  }, [track])

  const handleTgUnlinked = useCallback(() => {
    setTgState({ linked: false })
    setSnapshot(s => ({ ...s, tg: { linked: false } }))
    track('notifications_channel_toggled', { channel: 'telegram', linked: false })
  }, [track])

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
              <span className="text-[12px] text-danger flex items-center gap-1 mr-1">{error}</span>
            )}
            <Btn variant="ghost" size="md" onClick={() => setResetConfirmOpen(true)}>Restaurar padrão</Btn>
            {dirty && !saved && <Btn variant="ghost" size="md" onClick={discard}>Descartar</Btn>}
            <Btn
              variant="primary" size="md"
              icon={<Save size={13} />}
              loading={saving}
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
          <span className="font-semibold text-text">{totals.enabled}</span> de{' '}
          <span>{totals.total}</span> notificações ligadas
          {' · '}
          horário de silêncio{' '}
          {quiet.enabled
            ? <span className="text-text">das {quiet.from} às {quiet.to}</span>
            : <span>desativado</span>}
        </span>
      </div>

      <div className="space-y-4 max-w-[1100px]">
        <ChannelsCard
          tgState={tgState}
          bots={bots}
          userEmail={userEmail}
          onTgLinked={handleTgLinked}
          onTgUnlinked={handleTgUnlinked}
        />
        <PreferencesTable prefs={prefs} setPrefs={setPrefs} channelState={channelState} tgState={tgState} />
        <QuietHoursCard quiet={quiet} setQuiet={setQuiet} />

        <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-xl px-4 py-3">
          <div className="text-[11.5px] text-text-muted leading-relaxed">
            Alterações entram em vigor imediatamente após salvar.
            {dirty && <span className="text-warning"> · Você tem alterações não salvas.</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {dirty && !saved && (
              <Btn variant="ghost" size="sm" onClick={discard}><X size={12} />Descartar</Btn>
            )}
            <Btn
              variant="primary" size="sm"
              icon={<Save size={13} />}
              loading={saving}
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? 'Salvando…' : 'Salvar preferências'}
            </Btn>
          </div>
        </div>
      </div>

      {/* Confirmação de restaurar padrão */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-warning/15 flex items-center justify-center">
                <AlertTriangle size={18} className="text-warning" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-text">Restaurar padrão?</div>
                <div className="text-[12.5px] text-text-muted mt-1 leading-relaxed">
                  Todas as suas preferências de notificação serão redefinidas para os valores padrão.
                  Essa ação não pode ser desfeita.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setResetConfirmOpen(false)}>Cancelar</Btn>
              <Btn
                variant="primary" size="sm"
                onClick={() => { reset(); setResetConfirmOpen(false) }}
              >
                Restaurar padrão
              </Btn>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
