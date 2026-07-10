import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'
import { dispatchWebhookEvent } from '@/lib/webhooks'
import { rateLimit } from '@/lib/rate-limit'
import {
  type ContactState,
  type FlowNode,
  buildEdgeMap,
  findStartNode,
  loadFlow,
  getLatestFlowVersion,
  executeFlowNode,
  answerCallbackQuery,
  resumeFlowAfterPayment,
} from '@/lib/flow-engine'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

interface TelegramVideo {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  duration: number
  thumbnail?: TelegramPhotoSize
  thumb?: TelegramPhotoSize
  file_size?: number
}

interface TelegramMessage {
  message_id: number
  from?: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
  }
  chat: { id: number; type: string }
  text?: string
  caption?: string
  photo?: TelegramPhotoSize[]
  video?: TelegramVideo
  date: number
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  channel_post?: TelegramMessage
  edited_channel_post?: TelegramMessage
  callback_query?: {
    id: string
    from: { id: number; first_name: string; last_name?: string; username?: string }
    message?: TelegramMessage
    data?: string
  }
}

// ─── Biblioteca de mídia ────────────────────────────────────────────────────────
// Captura imagens/vídeos postados em um canal onde o bot é admin.
// O file_id resultante é específico deste bot e pode ser reenviado nos fluxos.
async function captureChannelMedia(
  supabase: ReturnType<typeof createAdminClient>,
  bot: { id: string; user_id: string },
  post: TelegramMessage,
): Promise<void> {
  const caption = post.caption ?? null
  const sourceChat = String(post.chat.id)

  let row:
    | {
        media_type: 'image' | 'video'
        file_id: string
        thumb_file_id: string | null
        file_unique_id: string
        width: number | null
        height: number | null
        duration: number | null
      }
    | null = null

  if (Array.isArray(post.photo) && post.photo.length > 0) {
    const largest  = post.photo[post.photo.length - 1]
    const smallest = post.photo[0]
    row = {
      media_type:     'image',
      file_id:        largest.file_id,
      thumb_file_id:  smallest.file_id,
      file_unique_id: largest.file_unique_id,
      width:          largest.width,
      height:         largest.height,
      duration:       null,
    }
  } else if (post.video) {
    const v = post.video
    row = {
      media_type:     'video',
      file_id:        v.file_id,
      thumb_file_id:  (v.thumbnail ?? v.thumb)?.file_id ?? null,
      file_unique_id: v.file_unique_id,
      width:          v.width,
      height:         v.height,
      duration:       v.duration,
    }
  }

  if (!row) return

  // Dedup por (bot_id, file_unique_id)
  const { data: existing } = await supabase
    .from('media_library')
    .select('id')
    .eq('bot_id', bot.id)
    .eq('file_unique_id', row.file_unique_id)
    .maybeSingle()
  if (existing) return

  await supabase.from('media_library').insert({
    user_id:        bot.user_id,
    bot_id:         bot.id,
    source_chat_id: sourceChat,
    caption,
    ...row,
  })
}

// ─── Route handler ─────────────────────────────────────────────────────────────

// POST /api/telegram/webhook?bot_id=<uuid>
export async function POST(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  if (!botId) return NextResponse.json({ error: 'bot_id required' }, { status: 400 })

  // Admin client bypassa RLS — segurança garantida pelo webhook_secret abaixo.
  const supabase = createAdminClient()

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, user_id, token, webhook_secret, name, username, welcome_message, fallback_message, status, active_flow_id, anti_clone')
    .eq('id', botId)
    .single()

  if (botError || !bot) {
    return NextResponse.json({ error: 'bot not found' }, { status: 404 })
  }

  // Verify Telegram secret token
  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!incomingSecret || incomingSecret !== bot.webhook_secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // ── Captura de mídia de canal (Biblioteca de Mídia) ──────────────────────────
  const channelPost = update.channel_post ?? update.edited_channel_post
  if (channelPost) {
    try {
      await captureChannelMedia(supabase, bot, channelPost)
    } catch {
      // fire-and-forget — nunca bloqueia o 200 para o Telegram
    }
    return new NextResponse(null, { status: 200 })
  }

  const msg = update.message
  const cbq = update.callback_query

  // ── Handle callback_query (button press) ──────────────────────────────────────
  if (cbq) {
    const cbChatId = cbq.message?.chat.id
    if (!cbChatId) return new NextResponse(null, { status: 200 })

    const plainToken = decryptToken(bot.token as string)
    await answerCallbackQuery(plainToken, cbq.id)

    const cbData = cbq.data ?? ''

    // ── Verificar Status do Pagamento (PIX no chat) ────────────────────────────
    if (cbData.startsWith('pix_check_')) {
      const txId = cbData.slice('pix_check_'.length)
      const { data: tx } = await supabase
        .from('transactions')
        .select('status')
        .eq('id', txId)
        .maybeSingle()
      let msg = '⏳ Ainda não identifiquei seu pagamento. Assim que ele cair, você recebe a confirmação aqui! 😊'
      if (tx?.status === 'approved')       msg = '✅ <b>Pagamento confirmado!</b> Obrigado pela sua compra. 🎉'
      else if (tx?.status === 'cancelled') msg = '❌ Este PIX expirou. Gere um novo para concluir o pagamento.'
      await sendTelegramMessage(plainToken, cbChatId, msg).catch(() => {})
      // Retoma o fluxo na saída "Pago"/"Não pago" (entrega). Idempotente — só entrega uma vez.
      if (tx?.status === 'approved' || tx?.status === 'cancelled') {
        await resumeFlowAfterPayment({ txId, paid: tx.status === 'approved', supabase }).catch(() => {})
      }
      return new NextResponse(null, { status: 200 })
    }

    if (!cbData.startsWith('flow_btn_')) return new NextResponse(null, { status: 200 })

    const btnIdx = parseInt(cbData.replace('flow_btn_', ''), 10)
    const cbTgId = String(cbq.from.id)

    // Rate limit por contato — evita loop de callback_query (7.3)
    const rl = await rateLimit(`flow-exec:${bot.id}:${cbTgId}`, 60, 60_000)
    if (!rl.ok) return new NextResponse(null, { status: 429 })

    // Load contact flow state (inclui flow_version — fix 3.1)
    const { data: cbContact } = await supabase
      .from('contacts')
      .select('id, first_name, tags, flow_id, flow_node_id, flow_vars, flow_version')
      .eq('bot_id', bot.id)
      .eq('telegram_id', cbTgId)
      .maybeSingle()

    if (cbContact?.flow_node_id && cbContact.flow_id) {
      // Carrega snapshot da versão em execução (não a versão atual!)
      const flow = await loadFlow(
        cbContact.flow_id,
        supabase,
        (cbContact as Record<string, unknown>).flow_version as number | null,
      )
      if (flow) {
        const edgeMap = buildEdgeMap(flow.edges)
        const outEdges = edgeMap.get(cbContact.flow_node_id) ?? []
        const targetEdge =
          outEdges.find(e => Number(e.sourceHandle) === btnIdx) ??
          outEdges[btnIdx] ??
          outEdges[0]

        if (targetEdge) {
          await supabase.from('contacts').update({ flow_node_id: null }).eq('id', cbContact.id)
          const contactState: ContactState = {
            id:            cbContact.id,
            first_name:    cbContact.first_name,
            tags:          cbContact.tags ?? null,
            flow_id:       cbContact.flow_id,
            flow_node_id:  null,
            flow_vars:     (cbContact.flow_vars as Record<string, string>) ?? null,
          }
          await executeFlowNode({
            nodeId:      targetEdge.target,
            nodes:       flow.nodes,
            edgeMap,
            contact:     contactState,
            firstName:   cbContact.first_name,
            botName:     bot.name as string,
            plainToken,
            chatId:      cbChatId,
            flowId:      flow.id,
            flowVersion: flow.version,
            userId:      bot.user_id as string,
            supabase,
            protectContent: Boolean(bot.anti_clone),
          })
        }
      }
    }

    return new NextResponse(null, { status: 200 })
  }

  // ── Handle message ────────────────────────────────────────────────────────────
  if (!msg?.from) return new NextResponse(null, { status: 200 })

  const telegramId = String(msg.from.id)
  const firstName  = msg.from.first_name
  const lastName   = msg.from.last_name ?? ''
  const username   = msg.from.username ?? null
  const chatId     = msg.chat.id
  const text       = msg.text ?? ''

  // Rate limit por contato (7.3)
  const rl = await rateLimit(`flow-exec:${bot.id}:${telegramId}`, 60, 60_000)
  if (!rl.ok) return new NextResponse(null, { status: 429 })

  const plainToken = decryptToken(bot.token as string)

  // Fetch existing contact (with flow state)
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, first_name, tags, flow_id, flow_node_id, flow_vars, flow_version')
    .eq('bot_id', bot.id)
    .eq('telegram_id', telegramId)
    .maybeSingle()

  const isNewContact = !existingContact

  // Upsert contact (always keep info up to date)
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const { data: upserted, error: upsertError } = await supabase
    .from('contacts')
    .upsert(
      {
        user_id:     bot.user_id,
        bot_id:      bot.id,
        telegram_id: telegramId,
        name:        fullName || firstName,
        first_name:  firstName,
        last_name:   lastName,
        username,
        language:    msg.from.language_code ?? 'pt',
      },
      { onConflict: 'bot_id,telegram_id', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  if (upsertError) {
    console.error('[webhook] upsert contact error:', upsertError.message, upsertError.details)
  }

  const contactId = existingContact?.id ?? upserted?.id ?? null
  const existingFlowVersion =
    existingContact ? ((existingContact as Record<string, unknown>).flow_version as number | null) : null

  const contactState: ContactState = {
    id:           contactId ?? '',
    first_name:   firstName,
    tags:         existingContact?.tags ?? null,
    flow_id:      existingContact?.flow_id ?? null,
    flow_node_id: existingContact?.flow_node_id ?? null,
    flow_vars:    (existingContact?.flow_vars as Record<string, string>) ?? null,
  }

  // Log "Novo lead" only on first contact
  if (isNewContact) {
    await supabase.from('activity_events').insert({
      user_id:     bot.user_id,
      bot_id:      bot.id,
      contact_id:  contactId,
      type:        'lead',
      bot:         bot.username ? `@${bot.username}` : bot.name,
      title:       'Novo lead',
      description: `${firstName} iniciou conversa`,
    })
    dispatchWebhookEvent(bot.user_id as string, 'lead.created', {
      contact_id:  contactId,
      first_name:  firstName,
      last_name:   lastName || null,
      username:    username,
      bot_id:      bot.id,
      bot_name:    bot.username ? `@${bot.username as string}` : bot.name as string,
    })
  }

  // ── /start command ────────────────────────────────────────────────────────────
  // Reenvia boas-vindas/fluxo em TODO /start (não só no primeiro contato).
  if (text.startsWith('/start')) {
    // Evento de funil só na primeira conversa — evita inflar em /start repetidos.
    if (isNewContact) {
      supabase.from('checkout_events').insert({
        user_id:      bot.user_id,
        bot_id:       bot.id,
        contact_id:   contactId,
        event_type:   'conversation_started',
        product_name: '',
      }).then(({ error }) => {
        if (error) console.error('[webhook] conversation_started error:', error.message)
      })
    }

    if (bot.active_flow_id) {
      // FIX 3.1: pega a última versão publicada (snapshot imutável)
      const ver = await getLatestFlowVersion(bot.active_flow_id as string, supabase)
      const flow = await loadFlow(bot.active_flow_id as string, supabase, ver)
      if (flow && flow.nodes.length > 0) {
        const edgeMap = buildEdgeMap(flow.edges)
        const startNode = findStartNode(flow.nodes, flow.edges)
        if (startNode) {
          supabase.rpc('increment_flow_executions', { p_flow_id: flow.id }).then(({ error }) => {
            if (error) console.error('[webhook] increment_flow_executions error:', error.message)
          })
          await executeFlowNode({
            nodeId:      startNode.id,
            nodes:       flow.nodes,
            edgeMap,
            contact:     contactState,
            firstName,
            botName:     bot.name as string,
            plainToken,
            chatId,
            flowId:      flow.id,
            flowVersion: flow.version,
            userId:      bot.user_id as string,
            supabase,
            protectContent: Boolean(bot.anti_clone),
          })
          return new NextResponse(null, { status: 200 })
        }
      }
    }

    // Fallback: send welcome_message from bot config
    const storedWelcome = (bot.welcome_message as string | null) ?? ''
    const welcomeText = storedWelcome.trim()
      ? storedWelcome
          .replace(/\{nome\}/g,    firstName)
          .replace(/\{bot\}/g,     bot.name as string)
          .replace(/\{produto\}/g, '')
          .replace(/\{valor\}/g,   '')
          .replace(/\{data\}/g,    new Date().toLocaleDateString('pt-BR'))
      : `Olá, <b>${firstName}</b>! 👋\n\nSeja bem-vindo ao <b>${bot.name}</b>. Em breve você receberá mais informações.`

    await sendTelegramMessage(plainToken, chatId, welcomeText, 'HTML', Boolean(bot.anti_clone)).catch(() => {})
    return new NextResponse(null, { status: 200 })
  }

  // ── Telegram notification channel verification code ─────────────────────────
  if (/^\d{6}$/.test(text.trim())) {
    const { data: prefsRow } = await supabase
      .from('notification_prefs')
      .select('user_id, channel_state')
      .filter('channel_state->telegram->>bot_id',     'eq', bot.id)
      .filter('channel_state->telegram->>verify_code', 'eq', text.trim())
      .maybeSingle()

    if (prefsRow) {
      const rawTg  = (prefsRow.channel_state as Record<string, unknown>)?.telegram as Record<string, unknown>
      const expires = Number(rawTg?.verify_expires ?? 0)

      if (expires > Date.now()) {
        const newState = {
          ...(prefsRow.channel_state as Record<string, unknown>),
          telegram: {
            ...rawTg,
            linked:         true,
            owner_chat_id:  String(chatId),
            verify_code:    null,
            verify_expires: null,
          },
        }
        await supabase
          .from('notification_prefs')
          .update({ channel_state: newState, updated_at: new Date().toISOString() })
          .eq('user_id', prefsRow.user_id)

        await sendTelegramMessage(
          plainToken, chatId,
          '✅ <b>Canal Telegram vinculado com sucesso!</b>\n\nVocê receberá notificações do Umbra Bot diretamente aqui.',
        ).catch(() => {})
      } else {
        await sendTelegramMessage(
          plainToken, chatId,
          '❌ Código expirado. Gere um novo código nas configurações de Notificações.',
        ).catch(() => {})
      }

      return new NextResponse(null, { status: 200 })
    }
  }

  // ── Continue active flow (answer to a question node) ─────────────────────────
  if (!text.startsWith('/') && contactState.flow_node_id && contactState.flow_id) {
    // Carrega versão snapshot (não a atual!) — fix 3.1
    const flow = await loadFlow(contactState.flow_id, supabase, existingFlowVersion)
    if (flow) {
      const edgeMap     = buildEdgeMap(flow.edges)
      const currentNode = flow.nodes.find((n: FlowNode) => n.id === contactState.flow_node_id)

      if (currentNode?.type === 'question' || currentNode?.type === 'phone') {
        const varName = (currentNode.data.variable as string) || (currentNode.type === 'phone' ? 'telefone' : 'resposta')
        const newVars = { ...(contactState.flow_vars ?? {}), [varName]: text }

        await supabase
          .from('contacts')
          .update({ flow_vars: newVars, flow_node_id: null })
          .eq('id', contactState.id)

        if (varName === 'nome' && text.trim()) {
          await supabase.from('contacts').update({ first_name: text.trim() }).eq('id', contactState.id)
          contactState.first_name = text.trim()
        }
        if (currentNode.type === 'phone' && text.trim()) {
          await supabase.from('contacts').update({ phone: text.trim() }).eq('id', contactState.id)
        }

        contactState.flow_vars    = newVars
        contactState.flow_node_id = null

        const outEdges = edgeMap.get(currentNode.id) ?? []
        const nextEdge = outEdges[0]
        if (nextEdge) {
          await executeFlowNode({
            nodeId:      nextEdge.target,
            nodes:       flow.nodes,
            edgeMap,
            contact:     contactState,
            firstName:   contactState.first_name,
            botName:     bot.name as string,
            plainToken,
            chatId,
            flowId:      flow.id,
            flowVersion: flow.version,
            userId:      bot.user_id as string,
            supabase,
            protectContent: Boolean(bot.anti_clone),
          })
        } else {
          await supabase
            .from('contacts')
            .update({ flow_id: null, flow_node_id: null, flow_version: null })
            .eq('id', contactState.id)
        }
      }
    }
    return new NextResponse(null, { status: 200 })
  }

  // ── Keyword trigger ──────────────────────────────────────────────────────────
  if (!text.startsWith('/')) {
    const { data: keywordFlows } = await supabase
      .from('flows')
      .select('id, nodes, edges, trigger_type, keywords')
      .eq('user_id', bot.user_id)
      .eq('status', 'published')
      .eq('trigger_type', 'keyword')

    if (keywordFlows && keywordFlows.length > 0) {
      const lowerText = text.toLowerCase().trim()
      let matchedFlowId: string | null = null

      for (const row of keywordFlows) {
        const kws = ((row as Record<string, unknown>).keywords as string[]) ?? []
        const hit = kws.some(k => lowerText === k.toLowerCase().trim() || lowerText.includes(k.toLowerCase().trim()))
        if (hit) {
          matchedFlowId = row.id as string
          break
        }
      }

      if (matchedFlowId) {
        // Snapshot da versão atual (fix 3.1)
        const ver = await getLatestFlowVersion(matchedFlowId, supabase)
        const flow = await loadFlow(matchedFlowId, supabase, ver)
        if (flow && flow.nodes.length > 0) {
          const edgeMap   = buildEdgeMap(flow.edges)
          const startNode = findStartNode(flow.nodes, flow.edges)
          if (startNode) {
            supabase.rpc('increment_flow_executions', { p_flow_id: flow.id }).then(({ error }) => {
              if (error) console.error('[webhook] increment_flow_executions (keyword) error:', error.message)
            })
            await executeFlowNode({
              nodeId:      startNode.id,
              nodes:       flow.nodes,
              edgeMap,
              contact:     contactState,
              firstName,
              botName:     bot.name as string,
              plainToken,
              chatId,
              flowId:      flow.id,
              flowVersion: flow.version,
              userId:      bot.user_id as string,
              supabase,
              protectContent: Boolean(bot.anti_clone),
            })
            return new NextResponse(null, { status: 200 })
          }
        }
      }
    }
  }

  // ── Fallback message ─────────────────────────────────────────────────────────
  if (!text.startsWith('/')) {
    const fallback = (bot.fallback_message as string | null) ?? ''
    if (fallback.trim()) {
      await sendTelegramMessage(
        plainToken, chatId,
        fallback.replace(/\{nome\}/g, firstName).replace(/\{bot\}/g, bot.name as string),
      ).catch(() => {})
    }
  }

  return new NextResponse(null, { status: 200 })
}
