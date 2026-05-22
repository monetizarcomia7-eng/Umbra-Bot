'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'
import { rateLimit } from '@/lib/rate-limit'
import * as Sentry from '@sentry/nextjs'

type EventPrefs = Record<string, { email: boolean; panel: boolean; telegram: boolean }>
interface QuietHours { enabled: boolean; from: string; to: string; exceptCritical: boolean }
interface TelegramChannelState {
  linked: boolean
  bot_id?: string
  bot_name?: string
  owner_chat_id?: string
  verify_code?: string
  verify_expires?: number
}
interface ChannelStateMap {
  email?: { linked: boolean }
  panel?: { linked: boolean }
  telegram?: TelegramChannelState
}

export async function saveNotificationPrefsAction(
  prefs: EventPrefs,
  channelState: ChannelStateMap,
  quiet: QuietHours,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const rl = await rateLimit(`notif_save:${user.id}`, 20, 60_000)
  if (!rl.ok) return { ok: false, error: 'Muitas tentativas. Aguarde um momento.' }

  const { error } = await supabase
    .from('notification_prefs')
    .upsert(
      {
        user_id:       user.id,
        prefs,
        channel_state: channelState,
        quiet,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    Sentry.captureException(error, { extra: { userId: user.id, context: 'save_notification_prefs' } })
    return { ok: false, error: error.message.length < 80 ? error.message : 'Erro ao salvar.' }
  }

  return { ok: true }
}

// Gera código de verificação de 6 dígitos para vincular o canal Telegram.
// Salva o código (com TTL de 10 min) em channel_state.telegram do banco.
export async function generateTelegramVerifyCodeAction(
  botId: string,
): Promise<{ ok: boolean; code?: string; expiresAt?: number; botName?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const rl = await rateLimit(`notif_verify_gen:${user.id}`, 5, 60_000)
  if (!rl.ok) return { ok: false, error: 'Muitas tentativas. Aguarde um momento.' }

  // Valida que o bot pertence ao usuário
  const { data: bot } = await supabase
    .from('bots')
    .select('id, name, username')
    .eq('id', botId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!bot) return { ok: false, error: 'Bot não encontrado.' }

  const code      = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutos
  const botName   = (bot.username as string | null) ? `@${bot.username as string}` : (bot.name as string)

  // Preserva campos existentes do channel_state
  const { data: current } = await supabase
    .from('notification_prefs')
    .select('channel_state')
    .eq('user_id', user.id)
    .maybeSingle()

  const existingState  = (current?.channel_state ?? {}) as ChannelStateMap
  const existingTg     = existingState.telegram ?? { linked: false }

  const newState: ChannelStateMap = {
    ...existingState,
    telegram: {
      ...existingTg,
      bot_id:         botId,
      bot_name:       botName,
      verify_code:    code,
      verify_expires: expiresAt,
      // Mantém linked=false e limpa owner_chat_id se trocou de bot
      linked:         existingTg.bot_id === botId ? (existingTg.linked ?? false) : false,
      owner_chat_id:  existingTg.bot_id === botId ? existingTg.owner_chat_id : undefined,
    },
  }

  const { error } = await supabase
    .from('notification_prefs')
    .upsert(
      { user_id: user.id, channel_state: newState, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (error) return { ok: false, error: 'Erro ao gerar código.' }
  return { ok: true, code, expiresAt, botName }
}

// Verifica se o webhook já processou o código e vinculou o owner_chat_id.
export async function checkTelegramLinkStatusAction(): Promise<{
  linked: boolean
  botName?: string
  ownerChatId?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { linked: false }

  const { data } = await supabase
    .from('notification_prefs')
    .select('channel_state')
    .eq('user_id', user.id)
    .maybeSingle()

  const tg = (data?.channel_state as ChannelStateMap | null)?.telegram
  if (!tg?.linked || !tg.owner_chat_id) return { linked: false }
  return { linked: true, botName: tg.bot_name, ownerChatId: tg.owner_chat_id }
}

// Desvincula o canal Telegram (remove linked, owner_chat_id, mantém bot_id para referência).
export async function unlinkTelegramChannelAction(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const { data: current } = await supabase
    .from('notification_prefs')
    .select('channel_state')
    .eq('user_id', user.id)
    .maybeSingle()

  const existingState = (current?.channel_state ?? {}) as ChannelStateMap

  const newState: ChannelStateMap = {
    ...existingState,
    telegram: {
      linked:         false,
      bot_id:         existingState.telegram?.bot_id,
      bot_name:       existingState.telegram?.bot_name,
      owner_chat_id:  undefined,
      verify_code:    undefined,
      verify_expires: undefined,
    },
  }

  const { error } = await supabase
    .from('notification_prefs')
    .upsert(
      { user_id: user.id, channel_state: newState, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (error) return { ok: false, error: 'Erro ao desvincular.' }
  return { ok: true }
}

// Envia mensagem de teste para o canal Telegram vinculado.
export async function testTelegramNotificationAction(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const rl = await rateLimit(`notif_test:${user.id}`, 3, 60_000)
  if (!rl.ok) return { ok: false, error: 'Muitas tentativas. Aguarde um momento.' }

  const { data: prefsRow } = await supabase
    .from('notification_prefs')
    .select('channel_state')
    .eq('user_id', user.id)
    .maybeSingle()

  const telegramState = (prefsRow?.channel_state as ChannelStateMap | null)?.telegram
  if (!telegramState?.linked || !telegramState.owner_chat_id || !telegramState.bot_id) {
    return { ok: false, error: 'Canal Telegram não vinculado.' }
  }

  const admin = createAdminClient()
  const { data: bot } = await admin
    .from('bots')
    .select('token')
    .eq('id', telegramState.bot_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!bot?.token) return { ok: false, error: 'Bot não encontrado.' }

  try {
    const plainToken = decryptToken(bot.token as string)
    await sendTelegramMessage(
      plainToken,
      telegramState.owner_chat_id,
      '🔔 <b>Teste de notificação</b>\n\nEsta é uma mensagem de teste do Umbra Bot. Suas notificações estão funcionando corretamente!',
    )
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    Sentry.captureException(err, { extra: { userId: user.id, context: 'test_telegram_notification' } })
    return { ok: false, error: `Falha ao enviar: ${msg.slice(0, 80)}` }
  }
}
