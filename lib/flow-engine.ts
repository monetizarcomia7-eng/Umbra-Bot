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
import { decryptToken } from './crypto'

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
  protect = false,
): Promise<boolean> {
  return tgApi(token, 'sendPhoto', {
    chat_id: chatId, photo, caption: caption ?? '', parse_mode: 'HTML', protect_content: protect,
  })
}

export async function sendTelegramVideo(
  token: string,
  chatId: number,
  video: string,
  caption?: string,
  protect = false,
): Promise<boolean> {
  return tgApi(token, 'sendVideo', {
    chat_id: chatId, video, caption: caption ?? '', parse_mode: 'HTML', protect_content: protect,
  })
}

// Envia várias mídias como álbum (2-10). 1 item → cai em sendPhoto/Video.
export async function sendTelegramMediaGroup(
  token: string,
  chatId: number,
  items: Array<{ kind: string; ref: string }>,
  caption?: string,
  protect = false,
): Promise<boolean> {
  const valid = items.filter(i => i.ref).slice(0, 10)
  if (valid.length === 0) return true
  if (valid.length === 1) {
    return valid[0].kind === 'video'
      ? sendTelegramVideo(token, chatId, valid[0].ref, caption, protect)
      : sendTelegramPhoto(token, chatId, valid[0].ref, caption, protect)
  }
  const media = valid.map((i, idx) => ({
    type:  i.kind === 'video' ? 'video' : 'photo',
    media: i.ref,
    ...(idx === 0 && caption ? { caption, parse_mode: 'HTML' } : {}),
  }))
  return tgApi(token, 'sendMediaGroup', { chat_id: chatId, media, protect_content: protect })
}

// Envia uma imagem (base64 PNG) via multipart — usado pelo QR do PIX no chat.
export async function sendTelegramPhotoUpload(
  token: string,
  chatId: number,
  base64Png: string,
  caption?: string,
  protect = false,
): Promise<boolean> {
  try {
    const buf = Buffer.from(base64Png, 'base64')
    const form = new FormData()
    form.append('chat_id', String(chatId))
    form.append('photo', new Blob([buf], { type: 'image/png' }), 'pix.png')
    if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML') }
    if (protect) form.append('protect_content', 'true')
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form })
    return res.ok
  } catch {
    return false
  }
}

export async function sendTelegramWithKeyboard(
  token: string,
  chatId: number,
  text: string,
  keyboard: Array<Array<{ text: string; callback_data?: string; url?: string; copy_text?: { text: string } }>>,
  protect = false,
): Promise<boolean> {
  return tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text: text || '​', // zero-width space fallback
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
    protect_content: protect,
  })
}

export async function answerCallbackQuery(token: string, callbackQueryId: string): Promise<boolean> {
  return tgApi(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId })
}

// Wrapper de sendTelegramMessage que retorna boolean (lib/telegram retorna void)
async function sendMessageOk(token: string, chatId: number, text: string, protect = false): Promise<boolean> {
  try {
    await sendTelegramMessage(token, chatId, text, 'HTML', protect)
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
  protectContent?: boolean   // Proteção anti-clonagem (protect_content no Telegram)
}

const MAX_DEPTH = 20

export async function executeFlowNode(opts: ExecuteOpts): Promise<void> {
  const {
    nodeId, nodes, edgeMap, contact, firstName, botName, plainToken, chatId,
    flowId, flowVersion, userId, supabase,
  } = opts
  const depth = opts.depth ?? 0
  const protect = opts.protectContent ?? false   // anti-clonagem

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
        protectContent: protect,
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
        ok = await sendMessageOk(plainToken, chatId, text, protect)
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendMessage failed' })
      break
    }

    case 'question': {
      const text = subVars((node.data.text as string) ?? '', flowVars, firstName, botName)
      let ok = true
      if (text.trim()) {
        ok = await sendMessageOk(plainToken, chatId, text, protect)
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
        ok = await sendTelegramWithKeyboard(plainToken, chatId, text, keyboard, protect)
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
        ok = await sendTelegramPhoto(plainToken, chatId, media, caption, protect)
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
        ok = await sendTelegramVideo(plainToken, chatId, media, caption, protect)
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendVideo failed' })
      break
    }

    case 'gallery': {
      // Álbum: várias imagens/vídeos de uma vez (até 10)
      const items = (node.data.galleryItems as Array<{ kind?: string; url?: string; fileId?: string }> | undefined) ?? []
      const caption = subVars((node.data.caption as string) ?? '', flowVars, firstName, botName)
      const refs = items.map(i => ({
        kind: i.kind === 'video' ? 'video' : 'image',
        ref:  (i.fileId || i.url || ''),
      })).filter(i => i.ref)
      let ok = true
      if (refs.length > 0) {
        ok = await sendTelegramMediaGroup(plainToken, chatId, refs, caption, protect)
      }
      await advance({ ok, errorMsg: ok ? undefined : 'sendMediaGroup failed' })
      break
    }

    case 'link': {
      const btnText = subVars((node.data.text as string) ?? 'Clique aqui!', flowVars, firstName, botName)
      const url     = (node.data.url as string) ?? ''
      let ok = true
      if (url) {
        ok = await sendTelegramWithKeyboard(plainToken, chatId, '🔗 ' + btnText, [[{ text: btnText, url }]], protect)
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
      if (lines) ok = await sendMessageOk(plainToken, chatId, lines, protect)
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
      if (text.trim()) ok = await sendMessageOk(plainToken, chatId, text, protect)
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

    case 'pix': {
      // Gera o PIX direto no chat (QR + copia-e-cola + botões) usando o gateway do dono.
      const product = subVars((node.data.product as string) ?? 'Produto', flowVars, firstName, botName)
      const price   = Number(node.data.price ?? 0)
      const cpf     = String(node.data.cpf ?? '').replace(/\D/g, '')

      // Token do Mercado Pago do dono (OAuth) — fallback para env em dev
      const { data: gw } = await supabase
        .from('gateways')
        .select('credentials')
        .eq('user_id', userId)
        .eq('provider', 'mercadopago')
        .eq('connected', true)
        .maybeSingle()
      let accessToken: string | null = null
      const rawTok = (gw?.credentials as Record<string, unknown> | null)?.token
      if (typeof rawTok === 'string') { try { accessToken = decryptToken(rawTok) } catch { /* ignora */ } }
      if (!accessToken) accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? null

      if (!accessToken || price <= 0) {
        await sendMessageOk(plainToken, chatId, '⚠️ Pagamento indisponível no momento. Fale com o suporte.', protect)
        await advance({ ok: false, errorMsg: 'pix: sem gateway ou preço inválido' })
        break
      }

      const { data: cMeta } = await supabase.from('contacts').select('bot_id').eq('id', contact.id).single()
      const botId = (cMeta?.bot_id as string | null) ?? null

      // Cria o pagamento PIX no Mercado Pago
      let mpData: {
        id?: number | string
        point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } }
      } | null = null
      let mpErrMsg = ''
      try {
        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'X-Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            transaction_amount: price,
            description: product,
            payment_method_id: 'pix',
            payer: {
              email: `pix${chatId}@umbrabot.com.br`,
              first_name: firstName || 'Cliente',
              ...((cpf.length === 11 || cpf.length === 14)
                ? { identification: { type: cpf.length === 14 ? 'CNPJ' : 'CPF', number: cpf } }
                : {}),
            },
          }),
        })
        if (mpRes.ok) {
          mpData = await mpRes.json()
        } else {
          const errBody = await mpRes.text().catch(() => '')
          console.error(`[flow-engine] pix MP ${mpRes.status}:`, errBody.slice(0, 600))
          try {
            const j = JSON.parse(errBody)
            mpErrMsg = j.message || j.cause?.[0]?.description || j.error || ''
          } catch { mpErrMsg = errBody.slice(0, 160) }
        }
      } catch (e) {
        console.error('[flow-engine] pix MP fetch error:', e instanceof Error ? e.message : String(e))
      }

      const pixInfo = mpData?.point_of_interaction?.transaction_data
      if (!mpData?.id || !pixInfo?.qr_code) {
        const usingOwnerGateway = typeof rawTok === 'string'
        let hint: string
        if (!usingOwnerGateway) {
          hint = '⚠️ Pagamento indisponível: conecte o Mercado Pago em Gateways.'
        } else if (/key enabled|without key|qr render|chave/i.test(mpErrMsg)) {
          hint = '⚠️ Sua conta Mercado Pago não tem uma CHAVE PIX habilitada para cobrar via API. Cadastre uma chave Pix no app do Mercado Pago e tente de novo.'
        } else if (/identification|document|cpf/i.test(mpErrMsg)) {
          hint = '⚠️ CPF inválido para o Mercado Pago. Verifique o CPF do nó.'
        } else if (/token|unauthorized|forbidden/i.test(mpErrMsg)) {
          hint = '⚠️ Token do Mercado Pago inválido ou sem permissão. Reconecte o gateway (Renovar token).'
        } else if (mpErrMsg) {
          hint = `⚠️ Não consegui gerar o PIX. Motivo do Mercado Pago: ${mpErrMsg.slice(0, 140)}`
        } else {
          hint = '⚠️ Não consegui gerar o PIX. Verifique o gateway e o CPF.'
        }
        await sendMessageOk(plainToken, chatId, hint, protect)
        await advance({ ok: false, errorMsg: `pix: MP falhou ${mpErrMsg.slice(0, 80)}` })
        break
      }

      const fee = Math.round(price * 0.0099 * 100) / 100
      const net = price - fee
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

      const { data: txRow } = await supabase.from('transactions').insert({
        user_id:              userId,
        bot_id:               botId,
        flow_id:              flowId,
        gateway:              'mercadopago',
        gateway_payment_id:   String(mpData.id),
        amount:               price,
        fee,
        net,
        type:                 'sale',
        payment_method:       'pix',
        status:               'pending',
        pix_qr_code:          pixInfo.qr_code_base64 ?? null,
        pix_copy_paste:       pixInfo.qr_code,
        pix_expires_at:       expiresAt,
        product_name:         product,
        customer_name:        firstName || null,
        customer_telegram_id: String(chatId),
      }).select('id').single()

      const txId = txRow?.id ?? ''

      // Evento cart_added no funil (fire-and-forget)
      supabase.from('checkout_events').insert({
        user_id: userId, bot_id: botId, flow_id: flowId,
        transaction_id: txId || null, event_type: 'cart_added', product_name: product,
      }).then(({ error }) => { if (error) { /* silencia */ } })

      const valorFmt = `R$ ${price.toFixed(2).replace('.', ',')}`

      // 1) QR Code (imagem)
      if (pixInfo.qr_code_base64) {
        await sendTelegramPhotoUpload(plainToken, chatId, pixInfo.qr_code_base64, undefined, protect)
      }

      // 2) Detalhes + botões (Verificar Status + Copiar Chave Pix)
      const text =
        `🎁 Você selecionou: <b>${product}</b>\n💰 Valor: <b>${valorFmt}</b>\n\n` +
        `💠 Pague via <b>Pix Copia e Cola</b> (ou QR Code):\n<code>${pixInfo.qr_code}</code>\n\n` +
        `👆 Toque no código acima para copiá-lo\n\n` +
        `‼️ Após o pagamento, toque em <b>Verificar Status do Pagamento</b>.`
      const kb = [
        [{ text: '✅ Verificar Status do Pagamento', callback_data: `pix_check_${txId}` }],
        [{ text: '📋 Copiar Chave Pix', copy_text: { text: pixInfo.qr_code } }],
      ]
      const ok = await sendTelegramWithKeyboard(plainToken, chatId, text, kb, protect)
      await advance({ ok, errorMsg: ok ? undefined : 'pix: envio falhou' })
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
      if (lines) ok = await sendMessageOk(plainToken, chatId, lines, protect)
      if (url && cta && ok) {
        ok = await sendTelegramWithKeyboard(plainToken, chatId, cta, [[{ text: cta, url }]], protect)
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
      if (lines) ok = await sendMessageOk(plainToken, chatId, lines, protect)
      if (cta && ok) ok = await sendMessageOk(plainToken, chatId, cta, protect)
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
