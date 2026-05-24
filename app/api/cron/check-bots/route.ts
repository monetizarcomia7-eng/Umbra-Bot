import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import { notifyOwnerTelegram } from '@/lib/notifications'
import * as Sentry from '@sentry/nextjs'

// GET /api/cron/check-bots
// Chamado pelo Vercel Cron a cada 30 min (ver vercel.json).
// Para cada bot, consulta getWebhookInfo na API do Telegram.
// Insere activity_events de 'disconnect', 'reconnect' ou 'banned' quando o estado muda.
// Processa em lotes de CONCURRENCY para não bloquear por 100+ bots sequencialmente.

const CONCURRENCY = 15

type BotRow = {
  id: string
  user_id: string
  token: string
  name: string
  username: string | null
}

type Counters = { disconnected: number; reconnected: number; banned: number }

async function processBot(bot: BotRow, supabase: ReturnType<typeof createAdminClient>, counters: Counters): Promise<void> {
  try {
    const token = decryptToken(bot.token as string)

    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: 'no-store' })
    if (!res.ok) return

    const { result: info } = await res.json() as {
      result: { url?: string; last_error_date?: number; last_error_message?: string }
    }

    const displayName = bot.username ? `@${bot.username}` : (bot.name as string)

    // Detecção de bot banido (Forbidden = removido ou desativado pelo Telegram)
    const isBanned = info.last_error_message?.toLowerCase().includes('forbidden') ?? false

    // Considera offline se: sem URL OU erro nos últimos 30 min
    const hasUrl    = !!info.url
    const recentErr = info.last_error_date
      ? (Date.now() / 1000 - info.last_error_date) < 1800
      : false
    const isOk = hasUrl && !recentErr && !isBanned

    // Último evento de status deste bot (evita duplicatas)
    const { data: lastEvt } = await supabase
      .from('activity_events')
      .select('type')
      .eq('user_id', bot.user_id)
      .eq('bot_id', bot.id)
      .in('type', ['disconnect', 'reconnect', 'banned'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastType = lastEvt?.type ?? null

    if (isBanned && lastType !== 'banned') {
      const errDesc = `${displayName} foi banido ou desativado pelo Telegram`
      await Promise.all([
        supabase.from('bots').update({ status: 'banned' }).eq('id', bot.id),
        supabase.from('activity_events').insert({
          user_id:     bot.user_id,
          bot_id:      bot.id,
          type:        'banned',
          bot:         displayName,
          title:       'Bot banido',
          description: errDesc,
        }),
        supabase.from('alerts').insert({
          user_id:     bot.user_id,
          bot_id:      bot.id,
          type:        'bot_offline',
          severity:    'critical',
          title:       `${displayName} foi banido`,
          description: errDesc,
          context:     [{ icon: 'bot', label: displayName }],
          source:      'cron',
        }),
      ])
      notifyOwnerTelegram(
        bot.user_id as string,
        'bot_down',
        `🚫 <b>Bot banido!</b>\n\n${displayName} foi banido ou desativado pelo Telegram.\n\nEntre em contato com o suporte do Telegram para mais informações.`,
      )
      counters.banned++
      return
    }

    if (!isOk && lastType !== 'disconnect') {
      const errDesc = info.last_error_message
        ? `${displayName}: ${info.last_error_message}`
        : `${displayName} perdeu conexão com a API do Telegram`

      await Promise.all([
        supabase.from('activity_events').insert({
          user_id:     bot.user_id,
          bot_id:      bot.id,
          type:        'disconnect',
          bot:         displayName,
          title:       'Bot desconectado',
          description: errDesc,
        }),
        supabase.from('alerts').insert({
          user_id:     bot.user_id,
          bot_id:      bot.id,
          type:        'bot_offline',
          severity:    'critical',
          title:       `${displayName} foi desconectado`,
          description: errDesc,
          context:     [{ icon: 'bot', label: displayName }],
          source:      'cron',
        }),
      ])
      notifyOwnerTelegram(
        bot.user_id as string,
        'bot_down',
        `⚠️ <b>Bot desconectado!</b>\n\n${displayName} perdeu conexão com a API do Telegram.\n\nAcesse o painel para reconectar.`,
      )
      counters.disconnected++
    } else if (isOk && lastType === 'disconnect') {
      await Promise.all([
        supabase.from('activity_events').insert({
          user_id:     bot.user_id,
          bot_id:      bot.id,
          type:        'reconnect',
          bot:         displayName,
          title:       'Bot reconectado',
          description: `${displayName} voltou a operar normalmente`,
        }),
        // Auto-resolve alertas de bot_offline pendentes — filtra por bot_id (sem .ilike)
        supabase.from('alerts')
          .update({
            resolved:    true,
            resolved_at: new Date().toISOString(),
            resolved_by: 'sistema (auto)',
          })
          .eq('user_id',  bot.user_id)
          .eq('bot_id',   bot.id)
          .eq('type',     'bot_offline')
          .eq('resolved', false),
      ])
      counters.reconnected++
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { botId: bot.id, context: 'check_bots_cron' } })
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const checkInId = Sentry.captureCheckIn({
    monitorSlug: 'check-bots',
    status:      'in_progress',
  })

  // Admin client bypassa RLS — o cron não possui sessão de usuário.
  const supabase = createAdminClient()

  const { data: bots, error } = await supabase
    .from('bots')
    .select('id, user_id, token, name, username')
    .not('token', 'is', null)
    .not('user_id', 'is', null)

  if (error || !bots?.length) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: 'check-bots', status: 'ok' })
    return NextResponse.json({ checked: 0, disconnected: 0, reconnected: 0, banned: 0 })
  }

  const counters: Counters = { disconnected: 0, reconnected: 0, banned: 0 }

  // Processa em chunks paralelos para evitar timeout com muitos bots
  for (let i = 0; i < bots.length; i += CONCURRENCY) {
    const chunk = (bots as BotRow[]).slice(i, i + CONCURRENCY)
    await Promise.allSettled(chunk.map(bot => processBot(bot, supabase, counters)))
  }

  Sentry.captureCheckIn({ checkInId, monitorSlug: 'check-bots', status: 'ok' })

  return NextResponse.json({
    checked:      bots.length,
    disconnected: counters.disconnected,
    reconnected:  counters.reconnected,
    banned:       counters.banned,
    message:      `${bots.length} bots verificados: ${counters.disconnected} desconectados, ${counters.reconnected} reconectados, ${counters.banned} banidos.`,
  })
}
