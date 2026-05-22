import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'
import * as Sentry from '@sentry/nextjs'

// Eventos que ignoram o horário de silêncio quando exceptCritical=true
const CRITICAL_EVENTS = new Set(['bot_down', 'gateway_fail', 'chargeback'])

interface QuietHours {
  enabled: boolean
  from: string
  to: string
  exceptCritical: boolean
}

interface TelegramChannelState {
  linked: boolean
  bot_id?: string
  owner_chat_id?: string
}

interface ChannelStateMap {
  email?: { linked: boolean }
  panel?: { linked: boolean }
  telegram?: TelegramChannelState
}

interface EventPrefs {
  [eventType: string]: { email: boolean; panel: boolean; telegram: boolean }
}

interface NotifPrefsRecord {
  prefs: EventPrefs | null
  channel_state: ChannelStateMap | null
  quiet: QuietHours | null
}

function isInQuietHours(quiet: QuietHours, eventType: string): boolean {
  if (!quiet.enabled) return false
  if (quiet.exceptCritical && CRITICAL_EVENTS.has(eventType)) return false

  const now = new Date()
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  const currentMin = h * 60 + m

  const [fh, fm] = quiet.from.split(':').map(Number)
  const [th, tm] = quiet.to.split(':').map(Number)
  const fromMin = fh * 60 + fm
  const toMin   = th * 60 + tm

  // Cruza meia-noite (ex: 22:00 às 07:00)
  if (fromMin > toMin) return currentMin >= fromMin || currentMin < toMin
  return currentMin >= fromMin && currentMin < toMin
}

// Envia notificação Telegram para o operador do workspace.
// Fire-and-forget seguro — captura qualquer exceção via Sentry.
export async function notifyOwnerTelegram(
  userId: string,
  eventType: string,
  message: string,
): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: prefsRow } = await admin
      .from('notification_prefs')
      .select('prefs, channel_state, quiet')
      .eq('user_id', userId)
      .maybeSingle() as { data: NotifPrefsRecord | null }

    if (!prefsRow) return

    // Verifica se o evento tem Telegram habilitado nas preferências
    const eventPref = prefsRow.prefs?.[eventType]
    if (!eventPref?.telegram) return

    // Verifica horário de silêncio
    const quiet = prefsRow.quiet ?? { enabled: false, from: '22:00', to: '07:00', exceptCritical: true }
    if (isInQuietHours(quiet, eventType)) return

    // Verifica se o canal Telegram está vinculado
    const telegramState = prefsRow.channel_state?.telegram
    if (!telegramState?.linked || !telegramState.owner_chat_id || !telegramState.bot_id) return

    // Carrega o token do bot
    const { data: bot } = await admin
      .from('bots')
      .select('token')
      .eq('id', telegramState.bot_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!bot?.token) return

    const plainToken = decryptToken(bot.token as string)
    await sendTelegramMessage(plainToken, telegramState.owner_chat_id, message)
  } catch (err) {
    Sentry.captureException(err, { extra: { userId, eventType, context: 'notify_owner_telegram' } })
  }
}
