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

// ─── getBotTelegramProfileAction ──────────────────────────────────────────────
// Busca o perfil atual do bot no Telegram: nome, descrição, short desc, comandos e foto.
// A foto é retornada como data URL (base64) para não expor o token no src da imagem.
export async function getBotTelegramProfileAction(botId: string): Promise<{
  name: string
  description: string
  shortDescription: string
  commands: Array<{ command: string; description: string }>
  photoDataUrl: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`tg-profile:${user.id}`, 10, 60 * 1000)
  if (!rl.ok) throw new Error('Muitas requisições. Aguarde um momento.')

  const { data: bot } = await supabase
    .from('bots')
    .select('token, telegram_id')
    .eq('id', botId)
    .eq('user_id', user.id)
    .single()

  if (!bot?.token) throw new Error('Bot não encontrado.')
  const token = decryptToken(bot.token as string)

  async function tgGet(method: string, qs = '') {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}${qs}`, { cache: 'no-store' })
    return r.json() as Promise<Record<string, unknown>>
  }

  type TgResult<T> = { ok: boolean; result?: T }

  const [meRes, descRes, shortRes, cmdRes, photosRes] = await Promise.allSettled([
    tgGet('getMe'),
    tgGet('getMyDescription'),
    tgGet('getMyShortDescription'),
    tgGet('getMyCommands'),
    bot.telegram_id
      ? tgGet('getUserProfilePhotos', `?user_id=${bot.telegram_id}&limit=1`)
      : Promise.resolve(null),
  ])

  const meData     = meRes.status    === 'fulfilled' ? meRes.value    as TgResult<{ first_name: string }> : null
  const descData   = descRes.status  === 'fulfilled' ? descRes.value  as TgResult<{ description: string }> : null
  const shortData  = shortRes.status === 'fulfilled' ? shortRes.value as TgResult<{ short_description: string }> : null
  const cmdData    = cmdRes.status   === 'fulfilled' ? cmdRes.value   as TgResult<Array<{ command: string; description: string }>> : null
  const photosData = photosRes.status === 'fulfilled' && photosRes.value
    ? photosRes.value as TgResult<{ photos: Array<Array<{ file_id: string }>> }>
    : null

  const name             = meData?.result?.first_name ?? ''
  const description      = descData?.result?.description ?? ''
  const shortDescription = shortData?.result?.short_description ?? ''
  const commands         = Array.isArray(cmdData?.result) ? cmdData!.result! : []

  // Busca foto como base64 — evita expor token no URL
  let photoDataUrl: string | null = null
  const photos = photosData?.result?.photos
  if (photos && photos.length > 0) {
    const largest = photos[0].at(-1)
    if (largest?.file_id) {
      try {
        const fileRes  = await tgGet('getFile', `?file_id=${largest.file_id}`)
        const filePath = (fileRes as TgResult<{ file_path: string }>)?.result?.file_path
        if (filePath) {
          const imgRes    = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, { cache: 'no-store' })
          const imgBuf    = await imgRes.arrayBuffer()
          const imgBase64 = Buffer.from(imgBuf).toString('base64')
          const ct        = imgRes.headers.get('content-type') ?? 'image/jpeg'
          photoDataUrl    = `data:${ct};base64,${imgBase64}`
        }
      } catch {
        // foto não disponível — não bloqueia
      }
    }
  }

  return { name, description, shortDescription, commands, photoDataUrl }
}

// ─── saveBotTelegramProfileAction ─────────────────────────────────────────────
// Atualiza nome, descrição, short description e comandos via Telegram Bot API.
// Retorna { ok, error } em vez de lançar — evita sanitização do Next.js em produção.
export async function saveBotTelegramProfileAction(
  botId: string,
  data: {
    name?: string
    description?: string
    shortDescription?: string
    commands?: Array<{ command: string; description: string }>
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false, error: 'Não autorizado.' }

    const rl = await rateLimit(`tg-profile-save:${user.id}`, 5, 60 * 1000)
    if (!rl.ok) return { ok: false, error: 'Muitas requisições. Aguarde um momento.' }

    const { data: bot } = await supabase
      .from('bots')
      .select('token')
      .eq('id', botId)
      .eq('user_id', user.id)
      .single()

    if (!bot?.token) return { ok: false, error: 'Bot não encontrado.' }
    const token = decryptToken(bot.token as string)

    async function tgPost(method: string, body: Record<string, unknown>) {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      })
      const d = await r.json() as { ok: boolean; description?: string }
      if (!d.ok) throw new Error(d.description ?? `Erro em ${method}`)
    }

    const calls: Promise<void>[] = []
    if (data.name             !== undefined) calls.push(tgPost('setMyName',             { name: data.name }))
    if (data.description      !== undefined) calls.push(tgPost('setMyDescription',      { description: data.description }))
    if (data.shortDescription !== undefined) calls.push(tgPost('setMyShortDescription', { short_description: data.shortDescription }))
    if (data.commands         !== undefined) calls.push(tgPost('setMyCommands',          { commands: data.commands }))

    const results = await Promise.allSettled(calls)
    const failed  = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failed.length > 0) return { ok: false, error: failed[0].reason?.message ?? 'Erro ao salvar no Telegram.' }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar.' }
  }
}

// ─── setBotPhotoAction ─────────────────────────────────────────────────────────
// Define a foto de perfil do bot no Telegram via multipart upload.
// Retorna { ok, error } em vez de lançar — evita sanitização do Next.js em produção.
export async function setBotPhotoAction(botId: string, photo: File): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false, error: 'Não autorizado.' }

    const rl = await rateLimit(`tg-photo:${user.id}`, 3, 60 * 1000)
    if (!rl.ok) return { ok: false, error: 'Muitas requisições. Aguarde um momento.' }

    if (!['image/jpeg', 'image/png', 'image/gif'].includes(photo.type))
      return { ok: false, error: 'Formato inválido. Use JPG, PNG ou GIF.' }
    if (photo.size > 10 * 1024 * 1024)
      return { ok: false, error: 'Imagem muito grande. Máximo 10MB.' }

    const { data: bot } = await supabase
      .from('bots')
      .select('token')
      .eq('id', botId)
      .eq('user_id', user.id)
      .single()

    if (!bot?.token) return { ok: false, error: 'Bot não encontrado.' }
    const token = decryptToken(bot.token as string)

    const fd  = new FormData()
    const buf = await photo.arrayBuffer()
    fd.append('photo', new Blob([buf], { type: photo.type }), photo.name)

    const res = await fetch(`https://api.telegram.org/bot${token}/setMyPhoto`, {
      method: 'POST',
      body: fd,
      cache: 'no-store',
    })
    const d = await res.json() as { ok: boolean; description?: string }
    if (!d.ok) return { ok: false, error: d.description ?? 'Telegram recusou a foto.' }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao enviar foto.' }
  }
}
