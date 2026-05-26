'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Tipos ──────────────────────────────────────────────────────────────────

const NODE_SCHEMA = z.object({
  id:       z.string().min(1).max(64),
  type:     z.string().min(1).max(32),
  position: z.object({ x: z.number(), y: z.number() }),
  data:     z.record(z.string(), z.unknown()).default({}),
})

const EDGE_SCHEMA = z.object({
  id:           z.string().min(1).max(64),
  source:       z.string().min(1).max(64),
  target:       z.string().min(1).max(64),
  sourceHandle: z.union([z.number(), z.string()]).optional(),
  label:        z.string().optional(),
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
  nodes:       z.array(NODE_SCHEMA).max(MAX_NODES).default([]),
  edges:       z.array(EDGE_SCHEMA).max(MAX_EDGES).default([]),
})

// ─── createFlowAction ─────────────────────────────────────────────────────────
export async function createFlowAction(payload: z.input<typeof CREATE_SCHEMA>): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`flow-create:${user.id}`, 30, 60_000)
  if (!rl.ok) throw new Error('Muitas criações em sequência. Aguarde 1 minuto.')

  const parsed = CREATE_SCHEMA.parse(payload)

  // Anti-spam: limita 500 fluxos por usuário
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

  // Defesa: limita tamanho serializado dos JSONB para evitar payload bombs
  const nodesSize = JSON.stringify(p.nodes).length
  const edgesSize = JSON.stringify(p.edges).length
  if (nodesSize > 800_000 || edgesSize > 800_000) {
    throw new Error('Fluxo excede o tamanho máximo permitido (800 KB por estrutura).')
  }

  // Resolve bot label se botId foi enviado
  let botLabel = ''
  let botColor = p.botColor ?? '#6366f1'
  if (p.botId) {
    const { data: bot } = await supabase
      .from('bots')
      .select('id, name, username, color')
      .eq('id', p.botId)
      .eq('user_id', user.id)
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
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  return { ok: true }
}

// ─── publishFlowAction ────────────────────────────────────────────────────────
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

  // Valida URLs antes de publicar
  for (const node of p.nodes) {
    if (node.type === 'image' || node.type === 'video' || node.type === 'link' || node.type === 'checkout') {
      const url = (node.data as Record<string, unknown>)[
        node.type === 'image' ? 'imageUrl' : node.type === 'video' ? 'videoUrl' : 'url'
      ] as string | undefined
      if (url && !isSafeUrl(url)) {
        throw new Error(`Nó "${node.type}" tem URL inválida ou bloqueada.`)
      }
    }
  }

  // Salva o fluxo
  await saveFlowAction({ ...payload, status: 'published' })

  // Cria snapshot da versão (RPC)
  let version: number | null = null
  const { data: ver, error: verErr } = await supabase
    .rpc('create_flow_version', { p_flow_id: p.id })
  if (!verErr && typeof ver === 'number') version = ver

  // Se botId definido, atualiza bots.active_flow_id
  if (p.botId) {
    await supabase
      .from('bots')
      .update({ active_flow_id: p.id })
      .eq('id', p.botId)
      .eq('user_id', user.id)
  }

  // activity_event
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
// Lazy load — chamado no editor ao abrir um fluxo
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
// Executa o fluxo virtualmente (sem enviar mensagens reais ao Telegram)
// Retorna o passo a passo simulado para o "Modo de teste"
export async function simulateFlowAction(payload: {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>
  edges: Array<{ source: string; target: string; sourceHandle?: number | string }>
  vars?: Record<string, string>
}): Promise<Array<{
  nodeId: string
  nodeType: string
  side: 'bot' | 'user' | 'system'
  text: string
  options?: string[]
  isPause?: boolean
}>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const nodes = payload.nodes
  const edges = payload.edges
  const vars  = payload.vars ?? {}
  const trail: Array<{
    nodeId: string; nodeType: string; side: 'bot' | 'user' | 'system'; text: string;
    options?: string[]; isPause?: boolean
  }> = []

  const edgeMap = new Map<string, typeof edges>()
  for (const e of edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, [])
    edgeMap.get(e.source)!.push(e)
  }

  const startNode = nodes.find(n => !edges.some(e => e.target === n.id))
  if (!startNode) return [{ nodeId: '', nodeType: 'system', side: 'system', text: 'Nenhum nó inicial encontrado.' }]

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

    const data = node.data as Record<string, unknown>
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
        // Simula tomada do primeiro botão
        if (out[0]) {
          trail.push({ nodeId, nodeType: 'system', side: 'system', text: `→ Simulando clique em "${options[0] ?? 'Opção 1'}"` })
          walk(out[0].target, depth + 1, visited)
        }
        break
      }
      case 'condition':
        trail.push({
          nodeId, nodeType: node.type, side: 'system',
          text: `Se {${data.variable}} ${data.operator} "${data.value}" → Sim`,
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
  return trail
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSafeUrl(u: string): boolean {
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false
    if (host.startsWith('169.254.') || host.startsWith('10.') ||
        host.startsWith('192.168.') || host.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}
