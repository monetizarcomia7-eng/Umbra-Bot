'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendTelegramPhoto, sendTelegramVideo } from '@/lib/flow-engine'

// ─── Schemas Zod ────────────────────────────────────────────────────────────

// Validação por tipo de nó (3.4 + 7.1) — discriminated union evita aceitar
// payloads malformados. Cada tipo tem o shape exato do que o engine espera.
const POSITION = z.object({ x: z.number(), y: z.number() })
const NODE_BASE = { id: z.string().min(1).max(64), position: POSITION }

const MESSAGE_DATA      = z.object({ text: z.string().max(4096).default('') })
const QUESTION_DATA     = z.object({
  text:     z.string().max(4096).optional(),
  question: z.string().max(4096).optional(),
  variable: z.string().regex(/^[a-zA-Z0-9_]{1,32}$/).default('resposta'),
})
const BUTTONS_DATA      = z.object({
  text:    z.string().max(4096).default(''),
  options: z.array(z.string().min(1).max(64)).min(1).max(6),
})
const CONDITION_DATA    = z.object({
  variable: z.string().regex(/^[a-zA-Z0-9_]{1,32}$/),
  operator: z.enum(['equals','not_equals','contains','starts_with','ends_with','not_empty','empty','gt','lt']),
  value:    z.string().max(255).default(''),
})
const DELAY_DATA        = z.object({
  amount: z.number().int().min(1).max(720),
  unit:   z.enum(['minutos','horas','dias']),
})
const OFFER_DATA        = z.object({
  product: z.string().min(1).max(255),
  price:   z.number().min(0).max(999999),
  cta:     z.string().max(64).default('Comprar'),
})
const TAG_DATA          = z.object({
  action: z.enum(['add','remove']),
  tag:    z.string().min(1).max(64),
})
const HANDOFF_DATA      = z.object({
  team:    z.string().max(64).default(''),
  message: z.string().max(4096).default(''),
})
const URL_SAFE          = z.string().max(2048).refine(v => v === '' || isSafeUrl(v), {
  message: 'URL inválida ou em IP privado',
})
const IMAGE_DATA        = z.object({
  imageUrl: URL_SAFE.default(''),
  fileId:   z.string().max(256).default(''),   // file_id da Biblioteca de Mídia (Telegram)
  caption:  z.string().max(1024).default(''),
})
const VIDEO_DATA        = z.object({
  videoUrl: URL_SAFE.default(''),
  fileId:   z.string().max(256).default(''),   // file_id da Biblioteca de Mídia (Telegram)
  caption:  z.string().max(1024).default(''),
})
const GALLERY_ITEM      = z.object({
  kind:   z.enum(['image', 'video']),
  url:    URL_SAFE.default(''),
  fileId: z.string().max(256).default(''),
})
const GALLERY_DATA      = z.object({
  galleryItems: z.array(GALLERY_ITEM).max(10).default([]),
  caption:      z.string().max(1024).default(''),
})
const PIX_DATA          = z.object({
  product: z.string().max(200).default(''),
  price:   z.number().min(0).default(0),
  cpf:     z.string().max(20).default(''),
})
const LINK_DATA         = z.object({
  text: z.string().max(64).default('Clique aqui'),
  url:  URL_SAFE.default(''),
})
const CHECKOUT_DATA     = z.object({
  text: z.string().max(64).default(''),
  url:  URL_SAFE.default(''),
})
const PHONE_DATA        = z.object({
  text:     z.string().max(4096).default('Qual é o seu telefone?'),
  variable: z.string().regex(/^[a-zA-Z0-9_]{1,32}$/).default('telefone'),
})
const UPSELL_DATA       = z.object({
  product:       z.string().max(255).default(''),
  discountPrice: z.number().min(0).max(999999).default(0),
  description:   z.string().max(2048).default(''),
  cta:           z.string().max(64).default(''),
  url:           URL_SAFE.default(''),
})
const ORDERBUMP_DATA    = z.object({
  product:     z.string().max(255).default(''),
  price:       z.number().min(0).max(999999).default(0),
  description: z.string().max(2048).default(''),
  cta:         z.string().max(64).default(''),
})
const REMARKETING_DATA  = z.object({
  text:        z.string().max(4096).default(''),
  delayAmount: z.number().int().min(1).max(720),
  delayUnit:   z.enum(['minutos','horas','dias']),
  tag:         z.string().max(64).default(''),
  mediaKind:   z.enum(['none','image','video']).default('none'),
  mediaUrl:    URL_SAFE.default(''),               // URL pública (alternativa à biblioteca)
  mediaFileId: z.string().max(256).default(''),    // file_id da Biblioteca de Mídia
})

const NODE_SCHEMA = z.discriminatedUnion('type', [
  z.object({ ...NODE_BASE, type: z.literal('message'),     data: MESSAGE_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('question'),    data: QUESTION_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('buttons'),     data: BUTTONS_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('condition'),   data: CONDITION_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('delay'),       data: DELAY_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('offer'),       data: OFFER_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('tag'),         data: TAG_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('handoff'),     data: HANDOFF_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('image'),       data: IMAGE_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('video'),       data: VIDEO_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('gallery'),     data: GALLERY_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('pix'),         data: PIX_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('link'),        data: LINK_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('checkout'),    data: CHECKOUT_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('phone'),       data: PHONE_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('upsell'),      data: UPSELL_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('downsell'),    data: UPSELL_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('orderbump'),   data: ORDERBUMP_DATA }),
  z.object({ ...NODE_BASE, type: z.literal('remarketing'), data: REMARKETING_DATA }),
])

// 1.7 — sourceHandle agora é só number (0-20)
const EDGE_SCHEMA = z.object({
  id:           z.string().min(1).max(64),
  source:       z.string().min(1).max(64),
  target:       z.string().min(1).max(64),
  sourceHandle: z.number().int().min(0).max(20).optional(),
  label:        z.string().max(64).optional(),
})

const MAX_NODES = 500
const MAX_EDGES = 1000
const MAX_KEYWORDS = 50
const MAX_KEYWORD_LEN = 64

const SAVE_PATCH_SCHEMA = z.object({
  id:          z.string().uuid(),
  name:        z.string().trim().min(1).max(120),
  description: z.string().max(500).default(''),
  botId:       z.string().uuid().nullable(),
  botColor:    z.string().max(32).optional(),
  status:      z.enum(['draft', 'published']).optional(),
  nodes:       z.array(NODE_SCHEMA).max(MAX_NODES),
  edges:       z.array(EDGE_SCHEMA).max(MAX_EDGES),
  triggerType: z.enum(['start', 'keyword']).default('start'),
  keywords:    z.array(z.string().min(1).max(MAX_KEYWORD_LEN)).max(MAX_KEYWORDS).default([]),
})

const CREATE_SCHEMA = z.object({
  name:        z.string().trim().min(1).max(120).default('Novo fluxo'),
  description: z.string().max(500).default(''),
  // Templates não passam pelo schema discriminado para evitar quebrar templates
  // legados ao adicionar campos novos. Validação só no save/publish.
  nodes:       z.array(z.object({
    id: z.string(), type: z.string(),
    position: POSITION, data: z.record(z.string(), z.unknown()).default({}),
  })).max(MAX_NODES).default([]),
  edges:       z.array(EDGE_SCHEMA.extend({
    sourceHandle: z.union([z.number(), z.string()]).optional(),
  })).max(MAX_EDGES).default([]),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSafeUrl(u: string): boolean {
  if (!u) return false
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false
    if (host.startsWith('169.254.') || host.startsWith('10.') ||
        host.startsWith('192.168.') || host.endsWith('.local')) return false
    return true
  } catch { return false }
}

// 1.2 — função interna que aplica o save sem rate-limit nem re-parse
// (recebe dados já parseados pelo schema)
async function _doSave(
  supabase: SupabaseClient,
  userId: string,
  p: z.output<typeof SAVE_PATCH_SCHEMA>,
): Promise<void> {
  // Defesa: limita tamanho serializado dos JSONB
  const nodesSize = JSON.stringify(p.nodes).length
  const edgesSize = JSON.stringify(p.edges).length
  if (nodesSize > 800_000 || edgesSize > 800_000) {
    throw new Error('Fluxo excede o tamanho máximo permitido (800 KB por estrutura).')
  }

  let botLabel = ''
  let botColor = p.botColor ?? '#6366f1'
  if (p.botId) {
    const { data: bot } = await supabase
      .from('bots')
      .select('id, name, username, color')
      .eq('id', p.botId)
      .eq('user_id', userId)
      .maybeSingle()
    if (bot) {
      botLabel = bot.username ? `@${bot.username}` : bot.name
      botColor = bot.color || botColor
    }
  }

  const { error } = await supabase
    .from('flows')
    .update({
      name:         p.name,
      description:  p.description,
      bot_id:       p.botId,
      bot:          botLabel,
      bot_color:    botColor,
      status:       p.status ?? undefined,
      nodes:        p.nodes,
      edges:        p.edges,
      trigger_type: p.triggerType,
      keywords:     p.keywords,
    })
    .eq('id', p.id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

// ─── createFlowAction ─────────────────────────────────────────────────────────
export async function createFlowAction(payload: z.input<typeof CREATE_SCHEMA>): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`flow-create:${user.id}`, 30, 60_000)
  if (!rl.ok) throw new Error('Muitas criações em sequência. Aguarde 1 minuto.')

  const parsed = CREATE_SCHEMA.parse(payload)

  const { count } = await supabase
    .from('flows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= 500) {
    throw new Error('Limite de 500 fluxos atingido.')
  }

  const { data, error } = await supabase
    .from('flows')
    .insert({
      user_id:     user.id,
      name:        parsed.name,
      status:      'draft',
      description: parsed.description,
      nodes:       parsed.nodes,
      edges:       parsed.edges,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Erro ao criar fluxo.')

  revalidatePath('/dashboard/flows')
  return { id: data.id }
}

// ─── saveFlowAction ───────────────────────────────────────────────────────────
export async function saveFlowAction(payload: z.input<typeof SAVE_PATCH_SCHEMA>): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`flow-save:${user.id}`, 120, 60_000)
  if (!rl.ok) throw new Error('Muitos salvamentos. Aguarde alguns segundos.')

  const p = SAVE_PATCH_SCHEMA.parse(payload)
  await _doSave(supabase, user.id, p)

  return { ok: true }
}

// ─── publishFlowAction ────────────────────────────────────────────────────────
// FIX 1.2 — usa _doSave (sem re-parse, sem double rate-limit).
export async function publishFlowAction(payload: z.input<typeof SAVE_PATCH_SCHEMA>): Promise<{
  ok: true
  version: number | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`flow-publish:${user.id}`, 30, 60_000)
  if (!rl.ok) throw new Error('Muitas publicações. Aguarde alguns segundos.')

  const p = SAVE_PATCH_SCHEMA.parse({ ...payload, status: 'published' })

  // Salva sem re-parse (FIX 1.2)
  await _doSave(supabase, user.id, p)

  // Cria snapshot da versão (RPC)
  let version: number | null = null
  const { data: ver, error: verErr } = await supabase
    .rpc('create_flow_version', { p_flow_id: p.id })
  if (!verErr && typeof ver === 'number') version = ver

  // Atualiza bots.active_flow_id se botId definido
  if (p.botId) {
    await supabase
      .from('bots')
      .update({ active_flow_id: p.id })
      .eq('id', p.botId)
      .eq('user_id', user.id)
  }

  void supabase.from('activity_events').insert({
    user_id:     user.id,
    type:        'flowPublished',
    title:       'Fluxo publicado',
    description: `Fluxo "${p.name}" publicado com ${p.nodes.length} nós (v${version ?? '?'}).`,
  }).then(({ error }) => { if (error) console.error('[publishFlow] activity insert:', error.message) })

  return { ok: true, version }
}

// ─── duplicateFlowAction ──────────────────────────────────────────────────────
export async function duplicateFlowAction(flowId: string): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(flowId).success) throw new Error('ID inválido.')

  const rl = await rateLimit(`flow-duplicate:${user.id}`, 20, 60_000)
  if (!rl.ok) throw new Error('Muitas duplicações. Aguarde alguns segundos.')

  const { data: src } = await supabase
    .from('flows')
    .select('name, bot, bot_id, bot_color, description, nodes, edges, trigger_type, keywords')
    .eq('id', flowId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!src) throw new Error('Fluxo não encontrado.')

  const { data, error } = await supabase
    .from('flows')
    .insert({
      user_id:      user.id,
      name:         `${src.name} (cópia)`,
      bot:          src.bot,
      bot_id:       src.bot_id,
      bot_color:    src.bot_color,
      description:  src.description,
      status:       'draft',
      nodes:        src.nodes ?? [],
      edges:        src.edges ?? [],
      trigger_type: (src as Record<string, unknown>).trigger_type ?? 'start',
      keywords:     (src as Record<string, unknown>).keywords ?? [],
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Erro ao duplicar fluxo.')
  return { id: data.id }
}

// ─── deleteFlowAction ─────────────────────────────────────────────────────────
export async function deleteFlowAction(flowId: string): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(flowId).success) throw new Error('ID inválido.')

  const { error } = await supabase
    .from('flows')
    .delete()
    .eq('id', flowId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  return { ok: true }
}

// ─── getFlowNodeStatsAction ───────────────────────────────────────────────────
export async function getFlowNodeStatsAction(flowId: string, days = 30): Promise<Array<{
  node_id: string
  node_type: string
  entered: number
  sent: number
  failed: number
  completed: number
}>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(flowId).success) return []

  const { data } = await supabase
    .rpc('flow_node_stats', { p_flow_id: flowId, p_days: days })

  return (data as Array<{
    node_id: string; node_type: string;
    entered: number; sent: number; failed: number; completed: number
  }>) ?? []
}

// ─── getFlowAnalyticsAction ──────────────────────────────────────────────────
// Para o dashboard analytics por fluxo (re-auditoria 6.1)
export async function getFlowAnalyticsAction(flowId: string, days = 7): Promise<{
  nodes:      Array<{
    node_id: string; node_type: string;
    entered: number; sent: number; failed: number;
    completed: number; abandoned: number; avg_latency_ms: number | null;
  }>
  timeseries: Array<{ day: string; entered: number; sent: number; failed: number; completed: number }>
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(flowId).success) {
    return { nodes: [], timeseries: [] }
  }

  const [nodesRes, tsRes] = await Promise.all([
    supabase.rpc('flow_node_stats_v2', { p_flow_id: flowId, p_days: days }),
    supabase.rpc('flow_events_timeseries', { p_flow_id: flowId, p_days: days }),
  ])

  return {
    nodes:      (nodesRes.data ?? []) as Array<{
      node_id: string; node_type: string;
      entered: number; sent: number; failed: number;
      completed: number; abandoned: number; avg_latency_ms: number | null;
    }>,
    timeseries: (tsRes.data ?? []) as Array<{ day: string; entered: number; sent: number; failed: number; completed: number }>,
  }
}

// ─── listFlowVersionsAction ───────────────────────────────────────────────────
export async function listFlowVersionsAction(flowId: string): Promise<Array<{
  id: string
  version: number
  name: string
  published_at: string
}>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  if (!z.string().uuid().safeParse(flowId).success) return []

  const { data } = await supabase
    .from('flow_versions')
    .select('id, version, name, published_at')
    .eq('flow_id', flowId)
    .eq('user_id', user.id)
    .order('version', { ascending: false })
    .limit(50)

  return (data as Array<{ id: string; version: number; name: string; published_at: string }>) ?? []
}

// ─── rollbackFlowVersionAction ────────────────────────────────────────────────
export async function rollbackFlowVersionAction(flowId: string, version: number): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`flow-rollback:${user.id}`, 10, 60_000)
  if (!rl.ok) throw new Error('Muitas operações. Aguarde.')

  const { error } = await supabase.rpc('rollback_flow_to_version', {
    p_flow_id: flowId,
    p_version: version,
  })

  if (error) throw new Error(error.message)
  return { ok: true }
}

// ─── simulateFlowAction ───────────────────────────────────────────────────────
// Modo de teste. Aceita botIndex para escolher botão em nós buttons (B4)
// e keywordInput para testar trigger keyword (B5).
export async function simulateFlowAction(payload: {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>
  edges: Array<{ source: string; target: string; sourceHandle?: number | string }>
  vars?: Record<string, string>
  buttonChoices?: Record<string, number>   // {nodeId: optionIndex} — B4
  startFromNodeId?: string                  // permite testar a partir de qualquer nó
  keywordInput?: string                     // B5: testa se a keyword matchearia trigger
  keywords?: string[]                       // lista de keywords do fluxo para o teste keyword
}): Promise<{
  trail: Array<{
    nodeId: string
    nodeType: string
    side: 'bot' | 'user' | 'system'
    text: string
    options?: string[]
    isPause?: boolean
  }>
  keywordMatch?: { matched: boolean; matchedKeyword: string | null }
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const nodes = payload.nodes
  const edges = payload.edges
  const vars  = payload.vars ?? {}
  const buttonChoices = payload.buttonChoices ?? {}

  // B5: teste de keyword
  let keywordMatch: { matched: boolean; matchedKeyword: string | null } | undefined
  if (payload.keywordInput) {
    const kws = payload.keywords ?? []
    const lower = payload.keywordInput.toLowerCase().trim()
    const hit = kws.find(k => lower === k.toLowerCase().trim() || lower.includes(k.toLowerCase().trim()))
    keywordMatch = { matched: !!hit, matchedKeyword: hit ?? null }
  }

  const trail: Array<{
    nodeId: string; nodeType: string; side: 'bot' | 'user' | 'system'; text: string;
    options?: string[]; isPause?: boolean
  }> = []

  const edgeMap = new Map<string, typeof edges>()
  for (const e of edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, [])
    edgeMap.get(e.source)!.push(e)
  }

  const startNode = payload.startFromNodeId
    ? nodes.find(n => n.id === payload.startFromNodeId)
    : nodes.find(n => !edges.some(e => e.target === n.id))

  if (!startNode) {
    return {
      trail: [{ nodeId: '', nodeType: 'system', side: 'system', text: 'Nenhum nó inicial encontrado.' }],
      keywordMatch,
    }
  }

  function sub(text: string): string {
    return (text || '')
      .replace(/\{nome\}/g, vars.nome || 'Usuário')
      .replace(/\{email\}/g, vars.email || '')
      .replace(/\{bot\}/g, 'Bot de teste')
      .replace(/\{data\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{(\w+)\}/g, (_, k) => vars[k] || '')
  }

  function walk(nodeId: string, depth: number, visited: Set<string>) {
    if (depth > 30 || visited.has(nodeId)) return
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    visited.add(nodeId)

    const data = node.data
    const out = edgeMap.get(nodeId) ?? []

    switch (node.type) {
      case 'message':
        trail.push({ nodeId, nodeType: node.type, side: 'bot', text: sub(data.text as string ?? '') })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'question':
      case 'phone':
        trail.push({ nodeId, nodeType: node.type, side: 'bot', text: sub(data.text as string ?? data.question as string ?? '') })
        trail.push({ nodeId, nodeType: node.type, side: 'user', text: `[Resposta do usuário em {${data.variable ?? 'resposta'}}]`, isPause: true })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'buttons': {
        const options = (data.options as string[]) ?? []
        trail.push({
          nodeId, nodeType: node.type, side: 'bot',
          text: sub(data.text as string ?? 'Escolha:'),
          options,
          isPause: true,
        })
        // FIX B4: escolhe o botão indicado em buttonChoices (default = 0)
        const chosen = buttonChoices[nodeId] ?? 0
        const chosenEdge = out.find(e => Number(e.sourceHandle) === chosen) ?? out[chosen] ?? out[0]
        if (chosenEdge) {
          trail.push({
            nodeId, nodeType: 'system', side: 'system',
            text: `→ Simulando clique em "${options[chosen] ?? `Opção ${chosen + 1}`}"`,
          })
          walk(chosenEdge.target, depth + 1, visited)
        }
        break
      }
      case 'condition':
        trail.push({
          nodeId, nodeType: node.type, side: 'system',
          text: `Se {${data.variable}} ${data.operator} "${data.value}" → Sim (primeiro branch)`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'delay':
        trail.push({
          nodeId, nodeType: node.type, side: 'system',
          text: `⏱ Aguardar ${data.amount} ${data.unit} (em modo de teste: instantâneo)`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'image':
        trail.push({ nodeId, nodeType: node.type, side: 'bot', text: `🖼 ${sub((data.caption as string) ?? '[imagem]')}` })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'video':
        trail.push({ nodeId, nodeType: node.type, side: 'bot', text: `🎬 ${sub((data.caption as string) ?? '[vídeo]')}` })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'gallery': {
        const n = Array.isArray(data.galleryItems) ? (data.galleryItems as unknown[]).length : 0
        trail.push({ nodeId, nodeType: node.type, side: 'bot', text: `🖼🎬 Álbum com ${n} mídia${n !== 1 ? 's' : ''} ${sub((data.caption as string) ?? '')}`.trim() })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      }
      case 'link':
      case 'checkout':
        trail.push({
          nodeId, nodeType: node.type, side: 'bot',
          text: `🔗 ${sub((data.text as string) ?? 'Botão')} → ${data.url || '(sem URL)'}`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'offer':
        trail.push({
          nodeId, nodeType: node.type, side: 'bot',
          text: `🎯 ${data.product} — R$ ${Number(data.price ?? 0).toFixed(2)} · ${data.cta ?? ''}`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'pix':
        trail.push({
          nodeId, nodeType: node.type, side: 'bot',
          text: `💠 PIX no chat: ${data.product} — R$ ${Number(data.price ?? 0).toFixed(2)} (QR + Copiar + Verificar Status)`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'tag':
        trail.push({
          nodeId, nodeType: node.type, side: 'system',
          text: `🏷 ${data.action === 'remove' ? 'Remover' : 'Adicionar'} tag "${data.tag}"`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'remarketing':
        trail.push({
          nodeId, nodeType: node.type, side: 'system',
          text: `📣 Agendar mensagem em ${data.delayAmount} ${data.delayUnit}: "${sub((data.text as string) ?? '').slice(0, 60)}…"`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'upsell':
      case 'downsell':
        trail.push({
          nodeId, nodeType: node.type, side: 'bot',
          text: `${node.type === 'upsell' ? '⬆️' : '⬇️'} ${data.product} — R$ ${Number(data.discountPrice ?? 0).toFixed(2)}`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'orderbump':
        trail.push({
          nodeId, nodeType: node.type, side: 'bot',
          text: `➕ Order bump: ${data.product} por R$ ${Number(data.price ?? 0).toFixed(2)}`,
        })
        if (out[0]) walk(out[0].target, depth + 1, visited)
        break
      case 'handoff':
        trail.push({
          nodeId, nodeType: node.type, side: 'system',
          text: `🤝 Encaminhar para ${data.team ?? 'humano'} (fim do fluxo)`,
        })
        return
      default:
        trail.push({ nodeId, nodeType: node.type, side: 'system', text: `Nó tipo "${node.type}" — não implementado.` })
        if (out[0]) walk(out[0].target, depth + 1, visited)
    }
  }

  walk(startNode.id, 0, new Set())
  return { trail, keywordMatch }
}

// ─── testRemarketingSendAction ──────────────────────────────────────────────────
// Envia a mensagem de remarketing configurada AGORA para o Telegram do dono
// (vinculado em Notificações a ESTE bot), sem esperar o cron. Valida texto+mídia.
export async function testRemarketingSendAction(
  botId: string | null,
  data: { text?: string; mediaKind?: string; mediaUrl?: string; mediaFileId?: string },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autorizado.' }
  if (!botId) return { ok: false, error: 'Vincule um bot ao fluxo antes de testar.' }

  const rl = await rateLimit(`test-remarketing:${user.id}`, 10, 60_000)
  if (!rl.ok) return { ok: false, error: 'Muitos testes seguidos. Aguarde um momento.' }

  const { data: bot } = await supabase
    .from('bots')
    .select('token, name')
    .eq('id', botId)
    .eq('user_id', user.id)
    .single()
  if (!bot?.token) return { ok: false, error: 'Bot não encontrado.' }

  // Destino = chat do dono vinculado a ESTE bot (Notificações)
  const { data: prefs } = await supabase
    .from('notification_prefs')
    .select('channel_state')
    .eq('user_id', user.id)
    .maybeSingle()
  const tg = (prefs?.channel_state as {
    telegram?: { linked?: boolean; owner_chat_id?: string; bot_id?: string }
  } | null)?.telegram

  if (!tg?.linked || !tg.owner_chat_id) {
    return { ok: false, error: 'Vincule seu Telegram em Notificações para receber o teste.' }
  }
  if (tg.bot_id !== botId) {
    return { ok: false, error: 'Seu Telegram está vinculado a outro bot. Vincule a este bot em Notificações (ou envie o código de verificação a ele).' }
  }

  const token   = decryptToken(bot.token as string)
  const chatId  = Number(tg.owner_chat_id)
  const message =
    ((data.text ?? '').replace(/\{nome\}/g, 'você').replace(/\{bot\}/g, (bot.name as string) ?? '')).trim()
    || '🧪 Teste de remarketing (mensagem vazia).'

  const mediaKind = data.mediaKind ?? 'none'
  const mediaRef  = (data.mediaFileId || data.mediaUrl || '').trim()
  const hasMedia  = (mediaKind === 'image' || mediaKind === 'video') && mediaRef !== ''

  try {
    if (hasMedia && mediaKind === 'video') {
      const ok = await sendTelegramVideo(token, chatId, mediaRef, message)
      if (!ok) return { ok: false, error: 'Telegram recusou o vídeo. Verifique a mídia/URL.' }
    } else if (hasMedia) {
      const ok = await sendTelegramPhoto(token, chatId, mediaRef, message)
      if (!ok) return { ok: false, error: 'Telegram recusou a imagem. Verifique a mídia/URL.' }
    } else {
      await sendTelegramMessage(token, chatId, message, 'HTML')
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 140) : 'Erro ao enviar teste.' }
  }
}
