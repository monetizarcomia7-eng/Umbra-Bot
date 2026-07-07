/**
 * Flow Engine — motor de execução de fluxos do Umbra Bot.
 *
 * Antes desta extração, o engine vivia inline no webhook do Telegram.
 * Agora é reutilizado por:
 *   - app/api/telegram/webhook/route.ts (execução em tempo real)
 *   - app/api/cron/process-remarketing/route.ts (retomada de delay)
 *
 * Princípios:
 *   - Side effects sempre via Supabase (passado como dep) — testável
 *   - Cada envio retorna boolean (ok) — telemetria mente menos
 *   - Telemetria fire-and-forget em flow_node_events
 *   - Operadores reais em condition (evaluateCondition)
 *   - Delay agendado via flow_scheduled_sends sentinel __delay__
 */

import { createAdminClient } from './supabase/admin'
import { sendTelegramMessage } from './telegram'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FlowNode {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: number | string | null
  label?: string
}

export interface ContactState {
  id: string
  first_name: string
  tags: string[] | null
  flow_id: string | null
  flow_node_id: string | null
  flow_vars: Record<string, string> | null
}

export type SupabaseAdmin = ReturnType<typeof createAdminClient>

// ─── Telegram primitives — todos retornam boolean ───────────────────────────

async function tgApi(token: string, method: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendTelegramPhoto(
  token: string,
  chatId: number,
  photo: string,
  caption?: string,
): Promise<boolean> {
  return tgApi(token, 'sendPhoto', {
    chat_id: chatId, photo, caption: caption ?? '', parse_mode: 'HTML',
  })
}

export async function sendTelegramVideo(
  token: string,
  chatId: number,
  video: string,
  caption?: string,
): Promise<boolean> {
  return tgApi(token, 'sendVideo', {
    chat_id: chatId, video, caption: caption ?? '', parse_mode: 'HTML',
  })
}

export async function sendTelegramWithKeyboard(
  token: string,
  chatId: number,
  text: string,
  keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>,
): Promise<boolean> {
  return tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text: text || '​', // zero-width space fallback
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  })
}

export async function answerCallbackQuery(token: string, callbackQueryId: string): Promise<boolean> {
  return tgApi(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId })
}

// Wrapper de sendTelegramMessage que retorna boolean (lib/telegram retorna void)
async function sendMessageOk(token: string, chatId: number, text: string): Promise<boolean> {
  try {
    await sendTelegramMessage(token, chatId, text)
    return true
  } catch {
    return false
  }
}

// ─── Flow helpers ────────────────────────────────────────────────────────────

export function buildEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const m = new Map<string, FlowEdge[]>()
  for (const e of edges) {
    if (!m.has(e.source)) m.set(e.source, [])
    m.get(e.source)!.push(e)
  }
  return m
}

export function findStartNode(nodes: FlowNode[], edges: FlowEdge[]): FlowNode | null {
  const hasIncoming = new Set(edges.map(e => e.target))
  return nodes.find(n => !hasIncoming.has(n.id)) ?? null
}

export function subVars(
  text: string,
  flowVars: Record<string, string>,
  firstName: string,
  botName: string,
): string {
  return (text ?? '')
    .replace(/\{nome\}/g,   flowVars['nome']  ?? firstName)
    .replace(/\{email\}/g,  flowVars['email'] ?? '')
    .replace(/\{bot\}/g,    botName)
    .replace(/\{data\}/g,   new Date().toLocaleDateString('pt-BR'))
    .replace(/\{(\w+)\}/g,  (_, k) => flowVars[k] ?? '')
}

export async function clearFlowState(contactId: string, supabase: SupabaseAdmin): Promise<void> {
  await supabase
    .from('contacts')
    .update({ flow_id: null, flow_node_id: null, flow_version: null })
    .eq('id', contactId)
}

// ─── Telemetria (fire-and-forget) ────────────────────────────────────────────

export function logNodeEvent(
  supabase: SupabaseAdmin,
  args: {
    userId: string
    flowId: string
    nodeId: string
    nodeType: string
    contactId: string | null
    event: 'entered' | 'sent' | 'failed' | 'completed' | 'abandoned'
    errorMsg?: string
    latencyMs?: number
  },
): void {
  supabase.from('flow_node_events').insert({
    user_id:    args.userId,
    flow_id:    args.flowId,
    node_id:    args.nodeId,
    node_type:  args.nodeType,
    contact_id: args.contactId,
    event:      args.event,
    error_msg:  args.errorMsg ?? null,
    latency_ms: args.latencyMs ?? null,
  }).then(({ error }) => {
    // Silencioso se tabela ainda não foi criada (mig 103)
    if (error && error.code !== '42P01') {
      console.error('[flow-engine] flow_node_events insert:', error.message)
    }
  })
}

// ─── Condition operators (B5 fix) ────────────────────────────────────────────

export function evaluateCondition(
  operator: string,
  variableValue: string | undefined,
  compareValue: string,
): boolean {
  const v = (variableValue ?? '').toString().trim()
  const c = (compareValue ?? '').toString().trim()

  switch (operator) {
    case 'equals':       return v.toLowerCase() === c.toLowerCase()
    case 'not_equals':   return v.toLowerCase() !== c.toLowerCase()
    case 'contains':     return v.toLowerCase().includes(c.toLowerCase())
    case 'starts_with':  return v.toLowerCase().startsWith(c.toLowerCase())
    case 'ends_with':    return v.toLowerCase().endsWith(c.toLowerCase())
    case 'not_empty':    return v.length > 0
    case 'empty':        return v.length === 0
    case 'gt': {
      const a = Number(v); const b = Number(c)
      return Number.isFinite(a) && Number.isFinite(b) && a > b
    }
    case 'lt': {
      const a = Number(v); const b = Number(c)
      return Number.isFinite(a) && Number.isFinite(b) && a < b
    }
    default:
      return true // fallback: primeiro branch
  }
}

const DELAY_UNIT_MS: Record<string, number> = {
  minutos: 60_000,
  horas:   3_600_000,
  dias:    86_400_000,
}

// ─── Load flow (com snapshot por contato — fix 3.1) ──────────────────────────

export interface LoadedFlow {
  id: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  triggerType: string
  keywords: string[]
  version: number | null
}

/**
 * Carrega um fluxo:
 *   - Se `version` for fornecido, busca o snapshot imutável em `flow_versions`
 *     (uso ideal para retomar um contato em execução)
 *   - Senão, busca o fluxo atual da tabela `flows` (status = 'published')
 *   - Fallback: se a versão pedida não existe, cai no fluxo atual.
 */
export async function loadFlow(
  flowId: string,
  supabase: SupabaseAdmin,
  version?: number | null,
): Promise<LoadedFlow | null> {
  if (version != null) {
    const { data: vRow } = await supabase
      .from('flow_versions')
      .select('flow_id, version, nodes, edges, trigger_type, keywords')
      .eq('flow_id', flowId)
      .eq('version', version)
      .maybeSingle()
    if (vRow) {
      return {
        id:          vRow.flow_id as string,
        nodes:       (vRow.nodes ?? []) as FlowNode[],
        edges:       (vRow.edges ?? []) as FlowEdge[],
        triggerType: ((vRow as Record<string, unknown>).trigger_type as string) ?? 'start',
        keywords:    ((vRow as Record<string, unknown>).keywords as string[]) ?? [],
        version:     Number(vRow.version),
      }
    }
    // Fallback silencioso: versão removida ou inexistente — usa atual
  }

  const { data } = await supabase
    .from('flows')
    .select('id, nodes, edges, trigger_type, keywords')
    .eq('id', flowId)
    .eq('status', 'published')
    .single()
  if (!data) return null
  return {
    id:          data.id as string,
    nodes:       (data.nodes ?? []) as FlowNode[],
    edges:       (data.edges ?? []) as FlowEdge[],
    triggerType: ((data as Record<string, unknown>).trigger_type as string) ?? 'start',
    keywords:    ((data as Record<string, unknown>).keywords as string[]) ?? [],
    version:     null,
  }
}

/**
 * Retorna a versão publicada mais recente do fluxo.
 * Usado quando o contato entra no fluxo pela primeira vez (snapshot).
 */
export async function getLatestFlowVersion(
  flowId: string,
  supabase: SupabaseAdmin,
): Promise<number | null> {
  const { data } = await supabase
    .from('flow_versions')
    .select('version')
    .eq('flow_id', flowId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? Number(data.version) : null
}

// ─── Execution engine ────────────────────────────────────────────────────────

export interface ExecuteOpts {
  nodeId:      string
  nodes:       FlowNode[]
  edgeMap:     Map<string, FlowEdge[]>
  contact:     ContactState
  firstName:   string
  botName:     string
  plainToken:  string
  chatId:      number
  flowId:      string
  flowVersion: number | null
  userId:      string
  supabase:    SupabaseAdmin
  depth?:      number
}

const MAX_DEPTH = 20

export async function executeFlowNode(opts: ExecuteOpts): Promise<void> {
  const {
    nodeId, nodes, edgeMap, contact, firstName, botName, plainToken, chatId,
    flowId, flowVersion, userId, supabase,
  } = opts
  const depth = opts.depth ?? 0

  if (depth > MAX_DEPTH) {
    logNodeEvent(supabase, {
      userId, flowId, nodeId, nodeType: 'system',
      contactId: contact.id, event: 'failed',
      errorMsg: `MAX_DEPTH (${MAX_DEPTH}) atingido`,
    })
    return
  }

  const found = nodes.find(n => n.id === nodeId)
  if (!found) {
    // Nó não existe (ex: fluxo editado após contato entrar e snapshot desatualizado)
    await clearFlowState(contact.id, supabase)
    return
  }
  // Captura imutável para uso dentro das closures (TS narrowing dentro de funções aninhadas)
  const node: FlowNode = found

  const t0 = Date.now()
  logNodeEvent(supabase, {
    userId, flowId, nodeId: node.id, nodeType: node.type,
    contactId: contact.id, event: 'entered',
  })

  const flowVars = contact.flow_vars ?? {}
  const outEdges = edgeMap.get(nodeId) ?? []

  // Helper: registra sent ou failed e segue para próximo nó.
  async function advance(opts: { ok: boolean; errorMsg?: string; edgeIndex?: number }) {
    const eventName = opts.ok ? 'sent' : 'failed'
    logNodeEvent(supabase, {
      userId, flowId, nodeId: node.id, nodeType: node.type,
      contactId: contact.id, event: eventName,
      errorMsg: opts.errorMsg, latencyMs: Date.now() - t0,
    })
    const next = outEdges[opts.edgeIndex ?? 0] ?? outEdges[0]
    if (next) {
      await executeFlowNode({
        ...opts,
        nodeId: next.target,
        nodes, edgeMap, contact, firstName, botName, plainToken, chatId,
        flowId, flowVersion, userId, supabase, depth: depth + 1,
      } as ExecuteOpts)
    } else {
      logNodeEvent(supabase, {
        userId, flowId, nodeId: node.id, nodeType: node.type,
        contactId: contact.id, event: 'completed',
      })
      await clearFlowState(contact.id, supabase)
    }
  }

  // Helper: persiste estado (pausa o fluxo esperando input)
  async function pauseAt(nodeIdToSave: string) {
    await supabase
      .from('contacts')
      .update({ flow_id: flowId, flow_node_id: nodeIdToSave, flow_version: flowVersion })
      .eq('id', contact.id)
  }

  switch (node.type) {
    case 'message': {
      const text = subVars((node.data.text as string) ?? '', flowVars, firstName, botName)
      let ok = true
      if (text.trim()) {
        ok = await sendMessageOk(plainToken, chatId, text)
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendMessage failed' })
      break
    }

    case 'question': {
      const text = subVars((node.data.text as string) ?? '', flowVars, firstName, botName)
      let ok = true
      if (text.trim()) {
        ok = await sendMessageOk(plainToken, chatId, text)
      }
      logNodeEvent(supabase, {
        userId, flowId, nodeId: node.id, nodeType: node.type,
        contactId: contact.id, event: ok ? 'sent' : 'failed',
        errorMsg: ok ? undefined : 'sendMessage failed', latencyMs: Date.now() - t0,
      })
      await pauseAt(nodeId)
      break
    }

    case 'buttons': {
      const text = subVars((node.data.text as string) ?? 'Escolha uma opção:', flowVars, firstName, botName)
      const options = (node.data.options as string[]) ?? []
      let ok = true
      if (options.length > 0) {
        const keyboard = options.map((opt, i) => [{ text: opt, callback_data: `flow_btn_${i}` }])
        ok = await sendTelegramWithKeyboard(plainToken, chatId, text, keyboard)
      }
      logNodeEvent(supabase, {
        userId, flowId, nodeId: node.id, nodeType: node.type,
        contactId: contact.id, event: ok ? 'sent' : 'failed',
        errorMsg: ok ? undefined : 'sendButtons failed', latencyMs: Date.now() - t0,
      })
      await pauseAt(nodeId)
      break
    }

    case 'tag': {
      const tag    = (node.data.tag    as string) ?? ''
      const action = (node.data.action as string) ?? 'add'
      if (tag) {
        const { data: curr } = await supabase
          .from('contacts').select('tags').eq('id', contact.id).single()
        const tags: string[] = curr?.tags ?? []
        if (action === 'remove') {
          await supabase.from('contacts').update({ tags: tags.filter(t => t !== tag) }).eq('id', contact.id)
        } else if (!tags.includes(tag)) {
          await supabase.from('contacts').update({ tags: [...tags, tag] }).eq('id', contact.id)
        }
      }
      await advance({ ok: true })
      break
    }

    case 'delay': {
      const amount = Number(node.data.amount ?? 0)
      const unit   = (node.data.unit as string) ?? 'minutos'
      const nextEdge = outEdges[0]
      if (!nextEdge || amount <= 0) { await advance({ ok: true }); break }

      const ms = amount * (DELAY_UNIT_MS[unit] ?? 60_000)
      const scheduledAt = new Date(Date.now() + ms).toISOString()

      const { data: contactMeta } = await supabase
        .from('contacts').select('user_id, bot_id').eq('id', contact.id).single()

      if (contactMeta?.user_id && contactMeta?.bot_id) {
        supabase.from('flow_scheduled_sends').insert({
          user_id:      contactMeta.user_id,
          bot_id:       contactMeta.bot_id,
          contact_id:   contact.id,
          chat_id:      chatId,
          message:      `__delay__:${nextEdge.target}`,
          scheduled_at: scheduledAt,
          flow_id:      flowId,
        }).then(({ error }) => {
          if (error) console.error('[flow-engine] delay schedule:', error.message)
        })
        await pauseAt(nodeId)
      } else {
        await advance({ ok: true })
      }
      break
    }

    case 'image': {
      // fileId (Biblioteca de Mídia) tem prioridade sobre URL — sendPhoto aceita ambos
      const media   = (node.data.fileId as string) || ((node.data.imageUrl as string) ?? '')
      const caption = subVars((node.data.caption as string) ?? '', flowVars, firstName, botName)
      let ok = true
      if (media) {
        ok = await sendTelegramPhoto(plainToken, chatId, media, caption)
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendPhoto failed' })
      break
    }

    case 'video': {
      // fileId (Biblioteca de Mídia) tem prioridade sobre URL — sendVideo aceita ambos
      const media   = (node.data.fileId as string) || ((node.data.videoUrl as string) ?? '')
      const caption = subVars((node.data.caption as string) ?? '', flowVars, firstName, botName)
      let ok = true
      if (media) {
        ok = await sendTelegramVideo(plainToken, chatId, media, caption)
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendVideo failed' })
      break
    }

    case 'link': {
      const btnText = subVars((node.data.text as string) ?? 'Clique aqui!', flowVars, firstName, botName)
      const url     = (node.data.url as string) ?? ''
      let ok = true
      if (url) {
        ok = await sendTelegramWithKeyboard(plainToken, chatId, '🔗 ' + btnText, [[{ text: btnText, url }]])
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendLink failed' })
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
      let ok = true
      if (lines) ok = await sendMessageOk(plainToken, chatId, lines)
      await advance({ ok, errorMsg: ok ? undefined : 'sendOffer failed' })
      break
    }

    case 'condition': {
      const variable = (node.data.variable as string) ?? ''
      const operator = (node.data.operator as string) ?? 'equals'
      const compare  = (node.data.value    as string) ?? ''
      const value    = flowVars[variable]
      const result   = evaluateCondition(operator, value, compare)
      const desiredHandle = result ? 0 : 1
      const edge =
        outEdges.find(e => Number(e.sourceHandle) === desiredHandle) ??
        outEdges[desiredHandle] ??
        outEdges[0]
      if (edge) {
        logNodeEvent(supabase, {
          userId, flowId, nodeId: node.id, nodeType: node.type,
          contactId: contact.id, event: 'sent',
          latencyMs: Date.now() - t0,
        })
        await executeFlowNode({
          ...opts,
          nodeId: edge.target,
          depth: depth + 1,
        })
      } else {
        await clearFlowState(contact.id, supabase)
      }
      break
    }

    case 'phone': {
      const text = subVars((node.data.text as string) ?? 'Qual é o seu telefone?', flowVars, firstName, botName)
      let ok = true
      if (text.trim()) ok = await sendMessageOk(plainToken, chatId, text)
      logNodeEvent(supabase, {
        userId, flowId, nodeId: node.id, nodeType: node.type,
        contactId: contact.id, event: ok ? 'sent' : 'failed',
        latencyMs: Date.now() - t0,
      })
      await pauseAt(nodeId)
      break
    }

    case 'checkout': {
      const btnText = subVars((node.data.text as string) ?? 'Clique para comprar:', flowVars, firstName, botName)
      const url = (node.data.url as string) ?? ''
      let ok = true
      if (url) {
        ok = await sendTelegramWithKeyboard(plainToken, chatId, btnText, [[{ text: '🛒 Comprar agora', url }]])
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendCheckout failed' })
      break
    }

    case 'remarketing': {
      const rawText     = (node.data.text        as string) ?? ''
      const delayAmount = Number(node.data.delayAmount ?? 1)
      const delayUnit   = (node.data.delayUnit   as string) ?? 'horas'
      const tag         = (node.data.tag         as string) ?? ''

      const ms          = delayAmount * (DELAY_UNIT_MS[delayUnit] ?? 3_600_000)
      const scheduledAt = new Date(Date.now() + ms).toISOString()
      const message     = subVars(rawText, flowVars, firstName, botName)

      // Mídia anexada (imagem/vídeo) — via Biblioteca de Mídia (file_id) ou URL
      const mediaKind = (node.data.mediaKind as string) ?? 'none'
      const mediaRef  = ((node.data.mediaFileId as string) || (node.data.mediaUrl as string) || '')
      const hasMedia  = (mediaKind === 'image' || mediaKind === 'video') && mediaRef !== ''

      const { data: contactMeta } = await supabase
        .from('contacts').select('user_id, bot_id').eq('id', contact.id).single()

      if (contactMeta?.user_id && contactMeta?.bot_id) {
        // Colunas de mídia só entram quando há mídia — assim o remarketing de
        // texto continua funcionando mesmo se a migração 109 não estiver aplicada.
        const payload: Record<string, unknown> = {
          user_id:      contactMeta.user_id,
          bot_id:       contactMeta.bot_id,
          contact_id:   contact.id,
          chat_id:      chatId,
          message,
          scheduled_at: scheduledAt,
          flow_id:      flowId,
        }
        if (hasMedia) {
          payload.media_type = mediaKind
          payload.media_ref  = mediaRef
        }
        supabase.from('flow_scheduled_sends').insert(payload).then(({ error }) => {
          if (error) console.error('[flow-engine] remarketing schedule:', error.message)
        })
      }

      if (tag) {
        const { data: curr } = await supabase.from('contacts').select('tags').eq('id', contact.id).single()
        const tags: string[] = curr?.tags ?? []
        if (!tags.includes(tag)) {
          await supabase.from('contacts').update({ tags: [...tags, tag] }).eq('id', contact.id)
        }
      }
      await advance({ ok: true })
      break
    }

    case 'upsell':
    case 'downsell': {
      const product       = subVars((node.data.product      as string) ?? '', flowVars, firstName, botName)
      const discountPrice = node.data.discountPrice as number | undefined
      const description   = subVars((node.data.description  as string) ?? '', flowVars, firstName, botName)
      const cta           = subVars((node.data.cta          as string) ?? '', flowVars, firstName, botName)
      const url           = (node.data.url as string) ?? ''
      const lines = [
        product && `<b>${product}</b>`,
        discountPrice != null && `💰 R$ ${Number(discountPrice).toFixed(2)}`,
        description,
      ].filter(Boolean).join('\n\n')
      let ok = true
      if (lines) ok = await sendMessageOk(plainToken, chatId, lines)
      if (url && cta && ok) {
        ok = await sendTelegramWithKeyboard(plainToken, chatId, cta, [[{ text: cta, url }]])
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendUpsell failed' })
      break
    }

    case 'orderbump': {
      const product     = subVars((node.data.product     as string) ?? '', flowVars, firstName, botName)
      const price       = node.data.price as number | undefined
      const description = subVars((node.data.description as string) ?? '', flowVars, firstName, botName)
      const cta         = subVars((node.data.cta         as string) ?? '', flowVars, firstName, botName)
      const lines = [
        description,
        product && `📦 <b>${product}</b>`,
        price != null && `➕ por apenas R$ ${Number(price).toFixed(2)}`,
      ].filter(Boolean).join('\n')
      let ok = true
      if (lines) ok = await sendMessageOk(plainToken, chatId, lines)
      if (cta && ok) ok = await sendMessageOk(plainToken, chatId, cta)
      await advance({ ok, errorMsg: ok ? undefined : 'sendOrderbump failed' })
      break
    }

    case 'end':
    case 'handoff':
    default:
      logNodeEvent(supabase, {
        userId, flowId, nodeId: node.id, nodeType: node.type,
        contactId: contact.id, event: 'completed',
      })
      await clearFlowState(contact.id, supabase)
      break
  }
}

// ─── Re-exports úteis ────────────────────────────────────────────────────────

export { sendTelegramMessage } from './telegram'
