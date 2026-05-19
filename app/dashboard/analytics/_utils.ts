import type { Period } from './_types'

// ── Formatters (usados por Server e Client) ──────────────────

export const fmtNum = (v: number) => v.toLocaleString('pt-BR')

export const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)

export const fmtPct = (v: number, d = 1) => `${v.toFixed(d)}%`

// ── Intervalo de datas por período ──────────────────────────

export function getDateRange(period: Period): {
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
} {
  const now = new Date()
  if (period === 'all') {
    return { start: new Date(0), end: now, prevStart: new Date(0), prevEnd: new Date(0) }
  }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const ms   = days * 86_400_000
  const start    = new Date(now.getTime() - ms)
  const prevEnd  = new Date(start.getTime() - 1)
  const prevStart = new Date(start.getTime() - ms)
  return { start, end: now, prevStart, prevEnd }
}

export const PERIOD_LABELS: Record<Period, string> = {
  '7d':  'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  'all': 'Todo o período',
}
