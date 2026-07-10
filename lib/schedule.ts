/**
 * Janela de envio (dias da semana + faixa de horário) para o Remarketing.
 * Usado pelo cron (campanhas "Não respondeu") e pelo nó "Sem resposta" dos fluxos.
 * Todos os cálculos no fuso America/Sao_Paulo.
 */

// 0 = Domingo ... 6 = Sábado
export function parseDays(raw: string | number | number[] | undefined | null): number[] {
  if (Array.isArray(raw)) {
    const arr = raw.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
    return arr.length ? arr : [0, 1, 2, 3, 4, 5, 6]
  }
  if (typeof raw === 'number') return [raw]
  if (!raw) return [0, 1, 2, 3, 4, 5, 6]
  const arr = String(raw)
    .split(',')
    .map(x => Number(x.trim()))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
  return arr.length ? arr : [0, 1, 2, 3, 4, 5, 6]
}

// Dia da semana (0-6) e hora (0-23) no fuso de São Paulo.
export function saoPauloDayHour(now: Date = new Date()): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const wd = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0'
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { day: dayMap[wd] ?? 0, hour: Number(hourStr) % 24 }
}

/**
 * true se `now` está dentro da janela (dias permitidos + hora entre start e end).
 * endHour é exclusivo. Sem configuração (start 0 / end 24 e todos os dias) → sempre true.
 */
export function isWithinWindow(
  days: number[],
  startHour: number,
  endHour: number,
  now: Date = new Date(),
): boolean {
  const { day, hour } = saoPauloDayHour(now)
  if (days.length > 0 && !days.includes(day)) return false

  const s = Number.isFinite(startHour) ? Math.max(0, Math.min(23, startHour)) : 0
  const e = Number.isFinite(endHour) ? Math.max(1, Math.min(24, endHour)) : 24
  if (s === 0 && e >= 24) return true          // janela cheia → sempre
  if (s >= e) return true                       // config inválida → não bloqueia
  return hour >= s && hour < e
}

// Lê a janela de um objeto de config solto (trigger_config da campanha ou node.data).
export function readWindow(cfg: Record<string, unknown> | null | undefined): {
  days: number[]; startHour: number; endHour: number
} {
  const c = cfg ?? {}
  return {
    days:      parseDays(c.days as string | number | number[] | undefined),
    startHour: Number(c.startHour ?? 0),
    endHour:   Number(c.endHour ?? 24),
  }
}
