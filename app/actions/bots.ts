'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/crypto'
import { captureEvent } from '@/lib/analytics-server'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'

// ─── validateBotTokenAction ────────────────────────────────────────────────────
// Chama getMe da API do Telegram para validar o token e retornar dados reais do bot.
export async function validateBotTokenAction(token: string): Promise<{
  username: string
  firstName: string
  telegramId: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`validate-token:${user.id}`, 10, 10 * 60 * 1000)
  if (!rl.ok) throw new Error('Muitas tentativas. Aguarde alguns minutos.')

  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`, {
      cache: 'no-store',
    })
  } catch {
    throw new Error('Erro de conexão com a API do Telegram. Verifique sua internet.')
  }

  const data = await res.json() as {
    ok: boolean
    result?: { id: number; first_name: string; username?: string; is_bot?: boolean }
    description?: string
  }

  if (!data.ok) {
    const desc = data.description ?? ''
    if (desc.includes('Unauthorized')) throw new Error('Token inválido. Verifique o token no BotFather.')
    throw new Error(desc || 'Token inválido.')
  }
  if (!data.result?.is_bot) throw new Error('Este token não pertence a um bot.')

  return {
    username: data.result.username ?? '',
    firstName: data.result.first_name,
    telegramId: String(data.result.id),
  }
}

// ─── saveBotAction ─────────────────────────────────────────────────────────────
// Salva o bot no banco com token criptografado (AES-256-GCM).
export async function saveBotAction(params: {
  name: string
  token: string
  username: string
  telegramId: string
  description?: string
  activeFlowId?: string | null
}): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autorizado.')

  const encrypted = encryptToken(params.token.trim())

  const { data, error } = await supabase.from('bots').insert({
    user_id:          user.id,
    name:             params.name.trim(),
    token:            encrypted,
    username:         params.username,
    telegram_id:      params.telegramId,
    description:      params.description ?? '',
    active_flow_id:   params.activeFlowId ?? null,
    status:           'offline',
    welcome_message:  'Olá {nome}! Bem-vindo. Em que posso te ajudar?',
    fallback_message: 'Não entendi sua mensagem. Digite /menu para ver as opções.',
    color:            'var(--primary)',
    webhook_url:      '',
  }).select('id').single()

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/bots')
  return { id: data.id }
}

// ─── registerWebhookAction ─────────────────────────────────────────────────────
// Descriptografa o token, registra o webhook no Telegram e atualiza o status para 'online'.
export async function registerWebhookAction(botId: string): Promise<{ webhookUrl: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`register-webhook:${user.id}`, 10, 10 * 60 * 1000)
  if (!rl.ok) throw new Error('Muitas requisições. Aguarde alguns minutos.')

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, token, webhook_secret')
    .eq('id', botId)
    .eq('user_id', user.id)
    .single()

  if (botError || !bot) throw new Error('Bot não encontrado.')

  const appUrl = process.env.APP_URL
  if (!appUrl) throw new Error('APP_URL não configurada.')

  const plainToken = decryptToken(bot.token as string)
  const webhookUrl = `${appUrl}/api/telegram/webhook?bot_id=${bot.id}`

  let tgRes: Response
  try {
    tgRes = await fetch(`https://api.telegram.org/bot${plainToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:             webhookUrl,
        secret_token:    bot.webhook_secret,
        allowed_updates: ['message', 'callback_query', 'pre_checkout_query', 'successful_payment'],
      }),
      cache: 'no-store',
    })
  } catch {
    throw new Error('Erro de conexão com a API do Telegram.')
  }

  const tgData = await tgRes.json() as { ok: boolean; description?: string }
  if (!tgData.ok) throw new Error(tgData.description ?? 'Erro ao registrar webhook.')

  await supabase.from('bots').update({
    status:      'online',
    webhook_url: webhookUrl,
    last_sync:   new Date().toISOString(),
  }).eq('id', bot.id)

  // Detecta primeiro bot para PostHog
  const { count } = await supabase
    .from('bots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'online')

  await captureEvent(user.id, 'bot_connected', { is_first_bot: (count ?? 0) === 1 })

  revalidatePath('/dashboard/bots')
  return { webhookUrl }
}

// ─── getBotTokenAction ─────────────────────────────────────────────────────────
// Retorna o token descriptografado — chamado apenas quando usuário clica "Revelar".
export async function getBotTokenAction(botId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autorizado.')

  const { data: bot } = await supabase
    .from('bots')
    .select('token')
    .eq('id', botId)
    .eq('user_id', user.id)
    .single()

  if (!bot?.token) throw new Error('Token não encontrado.')
  return decryptToken(bot.token as string)
}

// ─── updateBotAction ───────────────────────────────────────────────────────────
// Atualiza campos do bot no banco com verificação de propriedade.
export async function updateBotAction(
  id: string,
  patch: Partial<{
    name:             string
    description:      string
    status:           'online' | 'offline' | 'banned' | 'paused'
    welcome_message:  string
    fallback_message: string
    active_flow_id:   string | null
  }>,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autorizado.')

  const { error } = await supabase.from('bots')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/bots')
}

// ─── deleteBotAction ───────────────────────────────────────────────────────────
// Remove o bot do banco com verificação de propriedade.
export async function deleteBotAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autorizado.')

  const { error } = await supabase.from('bots')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/bots')
}
