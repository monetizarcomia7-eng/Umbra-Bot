// Tipos, mapeadores, formatadores e constantes compartilhadas do módulo de bots.

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RawBotRow {
  id: string
  name: string
  username: string | null
  status: string
  leads: number | null
  sales: number | null
  conversion: number | string | null
  revenue: number | string | null
  active_flow_id: string | null
  color: string | null
  telegram_id: string | null
  webhook_url: string | null
  last_sync: string | null
  added_at: string | null
  description: string | null
  welcome_message?: string | null
  fallback_message?: string | null
  anti_clone?: boolean | null
}

export interface BotData {
  id: string
  name: string
  username: string
  status: 'online' | 'offline' | 'banned' | 'paused'
  leads: number
  sales: number
  conversion: number
  revenue: number
  activeFlowId: string | null
  color: string
  telegramId: string | null
  webhookUrl: string
  welcomeMessage: string
  fallbackMessage: string
  description: string
  antiClone: boolean
  lastSync: number | null
  addedAt: number
}

export interface FlowData {
  id: string
  name: string
  description: string | null
  status: string
}

export const VALID_STATUSES = ['online', 'offline', 'banned', 'paused'] as const

export function mapRaw(r: RawBotRow): BotData {
  return {
    id:             r.id,
    name:           r.name,
    username:       r.username ?? '',
    status:         (VALID_STATUSES.includes(r.status as typeof VALID_STATUSES[number]) ? r.status : 'offline') as BotData['status'],
    leads:          Number(r.leads ?? 0),
    sales:          Number(r.sales ?? 0),
    conversion:     Number(r.conversion ?? 0),
    revenue:        Number(r.revenue ?? 0),
    activeFlowId:   r.active_flow_id ?? null,
    color:          r.color ?? 'var(--primary)',
    telegramId:     r.telegram_id ?? null,
    webhookUrl:     r.webhook_url ?? '',
    welcomeMessage: r.welcome_message ?? '',
    fallbackMessage:r.fallback_message ?? '',
    description:    r.description ?? '',
    antiClone:      r.anti_clone ?? false,
    lastSync:       r.last_sync ? new Date(r.last_sync).getTime() : null,
    addedAt:        r.added_at ? new Date(r.added_at).getTime() : Date.now(),
  }
}

// ─── Formatters ────────────────────────────────────────────────────────────────

export function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
export function fmtBRLdec(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
export function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }
export function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
export function fmtDateTime(d: number) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

// ─── Constants ─────────────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
  online:  { label: 'Online',  tone: 'success', dot: 'bg-[color:var(--success)]', pulse: true  },
  offline: { label: 'Offline', tone: 'warning', dot: 'bg-[color:var(--warning)]', pulse: false },
  banned:  { label: 'Banido',  tone: 'danger',  dot: 'bg-[color:var(--danger)]',  pulse: false },
  paused:  { label: 'Pausado', tone: 'muted',   dot: 'bg-text-subtle',            pulse: false },
} as const

export const MESSAGE_VARS = ['nome', 'bot', 'produto', 'valor', 'data']

export const DEFAULT_COMMANDS = [
  { command: 'start',   description: 'Iniciar o bot 🚀' },
  { command: 'suporte', description: 'Falar com suporte 💬' },
  { command: 'status',  description: 'Ver status do pedido 📊' },
]

export const BOT_COLORS = [
  '#7C5CFF', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316',
]
