import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/crypto'
import * as Sentry from '@sentry/nextjs'

// GET /api/cron/check-bots
// Chamado pelo Vercel Cron a cada 30 min (ver vercel.json).
// Para cada bot, consulta getWebhookInfo na API do Telegram.
// Insere activity_events de 'disconnect' ou 'reconnect' quando o estado muda,
// evitando duplicatas ao comparar com o último evento de status do bot.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: bots, error } = await supabase
    .from('bots')
    .select('id, user_id, token, name, username')
    .not('token', 'is', null)
    .not('user_id', 'is', null)

  if (error || !bots?.length) {
    return NextResponse.json({ checked: 0, disconnected: 0, reconnected: 0 })
  }

  let disconnected = 0
  let reconnected  = 0

  for (const bot of bots) {
    try {
      const token = decryptToken(bot.token as string)

      const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
      if (!res.ok) continue
      const { result: info } = await res.json() as {
        result: { url?: string; last_error_date?: number; last_error_message?: string }
      }

      // Considera offline se: sem URL configurada OU erro nos últimos 30 min
      const hasUrl     = !!info.url
      const recentErr  = info.last_error_date
        ? (Date.now() / 1000 - info.last_error_date) < 1800
        : false
      const isOk = hasUrl && !recentErr

      // Busca o último evento de status deste bot para evitar duplicatas
      const { data: lastEvt } = await supabase
        .from('activity_events')
        .select('type')
        .eq('user_id', bot.user_id)
        .eq('bot_id', bot.id)
        .in('type', ['disconnect', 'reconnect'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastType = lastEvt?.type ?? null
      const displayName = bot.username ? `@${bot.username}` : (bot.name as string)

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
          // Cria alerta crítico de bot offline na aba Alertas
          supabase.from('alerts').insert({
            user_id:     bot.user_id,
            type:        'bot_offline',
            severity:    'critical',
            title:       `${displayName} foi desconectado`,
            description: errDesc,
            context:     [{ icon: 'bot', label: displayName }],
            source:      'cron',
          }),
        ])
        disconnected++
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
          // Auto-resolve alertas de bot_offline pendentes para este bot
          supabase.from('alerts')
            .update({
              resolved:    true,
              resolved_at: new Date().toISOString(),
              resolved_by: 'sistema (auto)',
            })
            .eq('user_id', bot.user_id)
            .eq('type',     'bot_offline')
            .eq('resolved', false)
            .ilike('title', `%${displayName}%`),
        ])
        reconnected++
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { botId: bot.id, context: 'check_bots_cron' } })
    }
  }

  return NextResponse.json({
    checked: bots.length,
    disconnected,
    reconnected,
    message: `${bots.length} bots verificados: ${disconnected} desconectados, ${reconnected} reconectados.`,
  })
}
