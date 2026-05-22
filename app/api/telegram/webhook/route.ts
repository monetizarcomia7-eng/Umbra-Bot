import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'
import { dispatchWebhookEvent } from '@/lib/webhooks'

// ─── Telegram API helpers ──────────────────────────────────────────────────────

async function tgApi(token: string, method: string, body: Record<string, unknown>) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function sendTelegramPhoto(token: string, chatId: number, photo: string, caption?: string) {
  await tgApi(token, 'sendPhoto', {
    chat_id: chatId,
    photo,
    caption: caption ?? '',
    parse_mode: 'HTML',
  }).catch(() => {})
}

async function sendTelegramWithKeyboard(
  token: string,
  chatId: number,
  text: string,
  keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>,
) {
  await tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text: text || '​', // zero-width space fallback
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  }).catch(() => {})
}

async function answerCallbackQuery(token: string, callbackQueryId: string) {
  await tgApi(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId }).catch(() => {})
}

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  date: number
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: { id: number; first_name: string; last_name?: string; username?: string }
    message?: TelegramMessage
    data?: string
  }
}

interface FlowNode {
  id: string
  type: string
  data: Record<string, unknown>
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: number | string | null
  label?: string
}

interface ContactState {
  id: string
  first_name: string
  tags: string[] | null
  flow_id: string | null
  flow_node_id: string | null
  flow_vars: Record<string, string> | null
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>

// ─── Flow helpers ──────────────────────────────────────────────────────────────

function buildEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const m = new Map<string, FlowEdge[]>()
  for (const e of edges) {
    if (!m.has(e.source)) m.set(e.source, [])
    m.get(e.source)!.push(e)
  }
  return m
}

function findStartNode(nodes: FlowNode[], edges: FlowEdge[]): FlowNode | null {
  const hasIncoming = new Set(edges.map(e => e.target))
  return nodes.find(n => !hasIncoming.has(n.id)) ?? null
}

function subVars(
  text: string,
  flowVars: Record<string, string>,
  firstName: string,
  botName: string,
): string {
  return text
    .replace(/\{nome\}/g,   flowVars['nome']  ?? firstName)
    .replace(/\{email\}/g,  flowVars['email'] ?? '')
    .replace(/\{bot\}/g,    botName)
    .replace(/\{data\}/g,   new Date().toLocaleDateString('pt-BR'))
    .replace(/\{(\w+)\}/g,  (_, k) => flowVars[k] ?? '')
}

async function clearFlowState(contactId: string, supabase: SupabaseAdmin) {
  await supabase
    .from('contacts')
    .update({ flow_id: null, flow_node_id: null })
    .eq('id', contactId)
}

// ─── Flow execution engine ─────────────────────────────────────────────────────

async function executeFlowNode(
  nodeId: string,
  nodes: FlowNode[],
  edgeMap: Map<string, FlowEdge[]>,
  contact: ContactState,
  firstName: string,
  botName: string,
  plainToken: string,
  chatId: number,
  flowId: string,
  supabase: SupabaseAdmin,
  depth = 0,
): Promise<void> {
  if (depth > 20) return // guard against infinite loops

  const node = nodes.find(n => n.id === nodeId)
  if (!node) {
    await clearFlowState(contact.id, supabase)
    return
  }

  const flowVars = contact.flow_vars ?? {}
  const outEdges = edgeMap.get(nodeId) ?? []

  async function advance(edgeIndex = 0) {
    // Prefer edge at given index, fallback to first
    const next = outEdges[edgeIndex] ?? outEdges[0]
    if (next) {
      await executeFlowNode(
        next.target, nodes, edgeMap, contact, firstName, botName,
        plainToken, chatId, flowId, supabase, depth + 1,
      )
    } else {
      await clearFlowState(contact.id, supabase)
    }
  }

  switch (node.type) {
    case 'message': {
      const text = subVars((node.data.text as string) ?? '', flowVars, firstName, botName)
      if (text.trim()) {
        await sendTelegramMessage(plainToken, chatId, text).catch(() => {})
      }
      await advance()
      break
    }

    case 'question': {
      const text = subVars((node.data.text as string) ?? '', flowVars, firstName, botName)
      if (text.trim()) {
        await sendTelegramMessage(plainToken, chatId, text).catch(() => {})
      }
      // Pause: save current node so next message is treated as the answer
      await supabase
        .from('contacts')
        .update({ flow_id: flowId, flow_node_id: nodeId })
        .eq('id', contact.id)
      break
    }

    case 'buttons': {
      const text = subVars((node.data.text as string) ?? 'Escolha uma opção:', flowVars, firstName, botName)
      const options = (node.data.options as string[]) ?? []
      if (options.length > 0) {
        // Each button in its own row
        const keyboard = options.map((opt, i) => [{ text: opt, callback_data: `flow_btn_${i}` }])
        await sendTelegramWithKeyboard(plainToken, chatId, text, keyboard)
      }
      // Pause: waiting for callback_query (button press)
      await supabase
        .from('contacts')
        .update({ flow_id: flowId, flow_node_id: nodeId })
        .eq('id', contact.id)
      break
    }

    case 'tag': {
      const tag    = (node.data.tag    as string) ?? ''
      const action = (node.data.action as string) ?? 'add'
      if (tag) {
        const { data: curr } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', contact.id)
          .single()
        const tags: string[] = curr?.tags ?? []
        if (action === 'remove') {
          await supabase.from('contacts').update({ tags: tags.filter((t: string) => t !== tag) }).eq('id', contact.id)
        } else if (!tags.includes(tag)) {
          await supabase.from('contacts').update({ tags: [...tags, tag] }).eq('id', contact.id)
        }
      }
      await advance()
      break
    }

    case 'delay': {
      // Serverless: skip the wait, advance immediately
      await advance()
      break
    }

    case 'image': {
      const url     = (node.data.imageUrl as string) ?? ''
      const caption = subVars((node.data.caption as string) ?? '', flowVars, firstName, botName)
      if (url) {
        await sendTelegramPhoto(plainToken, chatId, url, caption)
      }
      await advance()
      break
    }

    case 'link': {
      const btnText = subVars((node.data.text as string) ?? 'Clique aqui!', flowVars, firstName, botName)
      const url     = (node.data.url as string) ?? ''
      if (url) {
        await sendTelegramWithKeyboard(plainToken, chatId, '🔗 ' + btnText, [[{ text: btnText, url }]])
      }
      await advance()
      break
    }

    case 'offer': {
      const product = subVars((node.data.product as string) ?? '', flowVars, firstName, botName)
      const price   = node.data.price as number | undefined
      const cta     = subVars((node.data.cta as string) ?? '', flowVars, firstName, botName)
      const lines = [
        product && `<b>${product}</b>`,
        price != null && `💰 R$ ${Number(price).toFixed(2)}`,
        cta,
      ].filter(Boolean).join('\n\n')
      if (lines) await sendTelegramMessage(plainToken, chatId, lines).catch(() => {})
      await advance()
      break
    }

    case 'condition': {
      // Basic: take first edge (true branch). Full evaluation is future work.
      await advance(0)
      break
    }

    case 'end':
    case 'handoff':
    default:
      await clearFlowState(contact.id, supabase)
      break
  }
}

// ─── Load flow and build helpers ───────────────────────────────────────────────

async function loadFlow(flowId: string, supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from('flows')
    .select('id, nodes, edges')
    .eq('id', flowId)
    .eq('status', 'published')
    .single()
  if (!data) return null
  return {
    id: data.id as string,
    nodes: (data.nodes ?? []) as FlowNode[],
    edges: (data.edges ?? []) as FlowEdge[],
  }
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
    .select('id, user_id, token, webhook_secret, name, username, welcome_message, fallback_message, status, active_flow_id')
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

  // Always return 200 to Telegram (retries on non-200)
  const msg = update.message
  const cbq = update.callback_query

  // ── Handle callback_query (button press) ──────────────────────────────────────
  if (cbq) {
    const cbChatId = cbq.message?.chat.id
    if (!cbChatId) return new NextResponse(null, { status: 200 })

    // Dismiss loading spinner on button
    await answerCallbackQuery(decryptToken(bot.token as string), cbq.id)

    const cbData = cbq.data ?? ''
    if (!cbData.startsWith('flow_btn_')) return new NextResponse(null, { status: 200 })

    const btnIdx    = parseInt(cbData.replace('flow_btn_', ''), 10)
    const cbTgId    = String(cbq.from.id)
    const plainToken = decryptToken(bot.token as string)

    // Load contact flow state
    const { data: cbContact } = await supabase
      .from('contacts')
      .select('id, first_name, tags, flow_id, flow_node_id, flow_vars')
      .eq('bot_id', bot.id)
      .eq('telegram_id', cbTgId)
      .maybeSingle()

    if (cbContact?.flow_node_id && cbContact.flow_id) {
      const flow = await loadFlow(cbContact.flow_id, supabase)
      if (flow) {
        const edgeMap = buildEdgeMap(flow.edges)
        const outEdges = edgeMap.get(cbContact.flow_node_id) ?? []
        // Match by sourceHandle index, fallback to position
        const targetEdge =
          outEdges.find(e => Number(e.sourceHandle) === btnIdx) ??
          outEdges[btnIdx] ??
          outEdges[0]

        if (targetEdge) {
          // Clear waiting state before advancing (next node will re-set if needed)
          await supabase.from('contacts').update({ flow_node_id: null }).eq('id', cbContact.id)
          const contactState: ContactState = {
            id:            cbContact.id,
            first_name:    cbContact.first_name,
            tags:          cbContact.tags ?? null,
            flow_id:       cbContact.flow_id,
            flow_node_id:  null,
            flow_vars:     (cbContact.flow_vars as Record<string, string>) ?? null,
          }
          await executeFlowNode(
            targetEdge.target, flow.nodes, edgeMap, contactState,
            cbContact.first_name, bot.name as string,
            plainToken, cbChatId, flow.id, supabase,
          )
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

  const plainToken = decryptToken(bot.token as string)

  // Fetch existing contact (with flow state)
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, first_name, tags, flow_id, flow_node_id, flow_vars')
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

  // Build contact state object for flow engine
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
    // Dispara evento de webhook para integrações externas (fire-and-forget)
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
  if (text.startsWith('/start') && isNewContact) {
    // Register conversation_started in funnel (fire-and-forget)
    supabase.from('checkout_events').insert({
      user_id:      bot.user_id,
      bot_id:       bot.id,
      contact_id:   contactId,
      event_type:   'conversation_started',
      product_name: '',
    }).then(({ error }) => {
      if (error) console.error('[webhook] conversation_started error:', error.message)
    })

    // If bot has a published active flow, run it instead of welcome_message
    if (bot.active_flow_id) {
      const flow = await loadFlow(bot.active_flow_id as string, supabase)
      if (flow && flow.nodes.length > 0) {
        const edgeMap   = buildEdgeMap(flow.edges)
        const startNode = findStartNode(flow.nodes, flow.edges)
        if (startNode) {
          await executeFlowNode(
            startNode.id, flow.nodes, edgeMap, contactState,
            firstName, bot.name as string,
            plainToken, chatId, flow.id, supabase,
          )
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

    await sendTelegramMessage(plainToken, chatId, welcomeText).catch(() => {})
    return new NextResponse(null, { status: 200 })
  }

  // ── Continue active flow (answer to a question node) ─────────────────────────
  if (!text.startsWith('/') && contactState.flow_node_id && contactState.flow_id) {
    const flow = await loadFlow(contactState.flow_id, supabase)
    if (flow) {
      const edgeMap     = buildEdgeMap(flow.edges)
      const currentNode = flow.nodes.find(n => n.id === contactState.flow_node_id)

      if (currentNode?.type === 'question') {
        const varName = (currentNode.data.variable as string) || 'resposta'
        const newVars = { ...(contactState.flow_vars ?? {}), [varName]: text }

        // Persist captured variable
        await supabase
          .from('contacts')
          .update({ flow_vars: newVars, flow_node_id: null })
          .eq('id', contactState.id)

        // If capturing 'nome', update the contact's first_name too
        if (varName === 'nome' && text.trim()) {
          await supabase.from('contacts').update({ first_name: text.trim() }).eq('id', contactState.id)
          contactState.first_name = text.trim()
        }

        contactState.flow_vars    = newVars
        contactState.flow_node_id = null

        // Advance to next node
        const outEdges = edgeMap.get(currentNode.id) ?? []
        const nextEdge = outEdges[0]
        if (nextEdge) {
          await executeFlowNode(
            nextEdge.target, flow.nodes, edgeMap, contactState,
            contactState.first_name, bot.name as string,
            plainToken, chatId, flow.id, supabase,
          )
        } else {
          await clearFlowState(contactState.id, supabase)
        }
      }
      // If currentNode is 'buttons', ignore text — wait for callback_query
    }
    return new NextResponse(null, { status: 200 })
  }

  // ── Fallback message (no active flow, not /start) ─────────────────────────────
  if (!text.startsWith('/')) {
    const fallback = (bot.fallback_message as string | null) ?? ''
    if (fallback.trim()) {
      await sendTelegramMessage(
        plainToken,
        chatId,
        fallback
          .replace(/\{nome\}/g, firstName)
          .replace(/\{bot\}/g,  bot.name as string),
      ).catch(() => {})
    }
  }

  return new NextResponse(null, { status: 200 })
}
