import React from 'react'
import {
  Plus, UserRound, ShoppingBag,
  Megaphone, ShoppingCart, GraduationCap, MessageCircleQuestion, Award,
} from 'lucide-react'
import { NODE_W, NODE_H, GRID_SIZE, nodeTypes } from './nodeTypes'
import { fmtBRLdec } from './mappers'
import type { FlowTemplate, FlowNodeType, FlowEdgeType } from './types'

export { NODE_W, NODE_H, GRID_SIZE }

// ─── Editor tuning ──────────────────────────────────────────────────────────────
// Centralized magic numbers for the editor / canvas

export const MAX_HISTORY      = 50          // undo/redo stack size
export const PREVIEW_MAX_DEPTH = 30          // PreviewChat recursion guard
export const FLOW_MAX_DEPTH    = 20          // webhook executor depth guard
export const DRAG_THRESHOLD    = 6           // px before we consider it a drag
export const PAN_THRESHOLD     = 3           // px before we consider it a pan
export const MIN_ZOOM          = 0.2
export const MAX_ZOOM          = 2
export const AUTO_SAVE_MS      = 30_000
export const TOAST_MS          = 4_000

// ─── Templates ──────────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'blank',
    name: 'Fluxo em branco',
    description: 'Canvas limpo para começar do zero.',
    category: 'inicio',
    icon: Plus,
    nodes: [],
    edges: [],
  },
  {
    id: 'lead-capture',
    name: 'Captura de lead',
    description: 'Boas-vindas → coleta nome e e-mail → aplica tag automaticamente.',
    category: 'captura',
    icon: UserRound,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Olá! 👋 Que bom ter você aqui. Vou fazer algumas perguntas rápidas.' } },
      { id: 'n2', type: 'question', position: { x: 300, y: 240 }, data: { question: 'Qual é o seu nome?', variable: 'nome' } },
      { id: 'n3', type: 'question', position: { x: 300, y: 400 }, data: { question: 'E o seu melhor e-mail?', variable: 'email' } },
      { id: 'n4', type: 'tag',      position: { x: 300, y: 560 }, data: { action: 'add', tag: 'lead' } },
      { id: 'n5', type: 'message',  position: { x: 300, y: 720 }, data: { text: 'Perfeito, {nome}! Em breve você vai receber novidades por aqui. 🚀' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0 },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 0 },
    ],
  },
  {
    id: 'sales',
    name: 'Vendas simples',
    description: 'Apresenta produto com oferta e botões de decisão.',
    category: 'vendas',
    icon: ShoppingBag,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Tenho uma oferta especial para você! 🎯' } },
      { id: 'n2', type: 'offer',    position: { x: 300, y: 240 }, data: { product: 'Meu Produto', price: 297, cta: 'Comprar agora' } },
      { id: 'n3', type: 'buttons',  position: { x: 300, y: 400 }, data: { text: 'O que deseja fazer?', options: ['Quero comprar', 'Saber mais', 'Agora não'] } },
      { id: 'n4', type: 'message',  position: { x:  80, y: 580 }, data: { text: 'Ótimo! Clique no botão acima para garantir sua vaga. 🚀' } },
      { id: 'n5', type: 'message',  position: { x: 320, y: 580 }, data: { text: 'Claro! O produto é perfeito para você porque...' } },
      { id: 'n6', type: 'message',  position: { x: 560, y: 580 }, data: { text: 'Sem problemas! Fico à disposição quando quiser. 😊' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0 },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 1 },
      { id: 'e5', source: 'n3', target: 'n6', sourceHandle: 2 },
    ],
  },
  {
    id: 'cart-recovery',
    name: 'Recuperação de carrinho',
    description: 'Aguarda 1h → mensagem amigável → desconto → segunda chance em 24h.',
    category: 'vendas',
    icon: ShoppingCart,
    nodes: [
      { id: 'n1', type: 'delay',       position: { x: 300, y:  80 }, data: { amount: 1, unit: 'horas' } },
      { id: 'n2', type: 'message',     position: { x: 300, y: 240 }, data: { text: 'Oi {nome}! Vi que você começou uma compra e ainda não finalizou. Posso te ajudar? 😊' } },
      { id: 'n3', type: 'offer',       position: { x: 300, y: 400 }, data: { product: 'Seu produto', price: 297, cta: 'Finalizar com 10% OFF' } },
      { id: 'n4', type: 'delay',       position: { x: 300, y: 560 }, data: { amount: 1, unit: 'dias' } },
      { id: 'n5', type: 'remarketing', position: { x: 300, y: 720 }, data: { text: 'Última chance, {nome}! O cupom expira em algumas horas.', delayAmount: 2, delayUnit: 'horas', tag: 'carrinho-abandonado' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0 },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 0 },
    ],
  },
  {
    id: 'post-sale',
    name: 'Pós-venda + upsell',
    description: 'Agradece → solicita avaliação → oferece upgrade no dia seguinte.',
    category: 'pos-venda',
    icon: Award,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Parabéns pela compra, {nome}! 🎉 Em instantes você receberá o acesso por e-mail.' } },
      { id: 'n2', type: 'tag',      position: { x: 300, y: 240 }, data: { action: 'add', tag: 'cliente' } },
      { id: 'n3', type: 'delay',    position: { x: 300, y: 400 }, data: { amount: 1, unit: 'dias' } },
      { id: 'n4', type: 'buttons',  position: { x: 300, y: 560 }, data: { text: 'Como foi sua experiência até agora?', options: ['Adorei 😍', 'Bom', 'Posso ajudar?'] } },
      { id: 'n5', type: 'upsell',   position: { x:  80, y: 740 }, data: { product: 'Produto Premium', discountPrice: 497, description: 'Já que você curtiu, que tal o pacote completo?', cta: 'Quero o upgrade', url: '' } },
      { id: 'n6', type: 'message',  position: { x: 320, y: 740 }, data: { text: 'Que bom! Continue aproveitando. 🚀' } },
      { id: 'n7', type: 'handoff',  position: { x: 560, y: 740 }, data: { team: 'Suporte', message: 'Vou te conectar com nosso suporte.' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0 },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 0 },
      { id: 'e5', source: 'n4', target: 'n6', sourceHandle: 1 },
      { id: 'e6', source: 'n4', target: 'n7', sourceHandle: 2 },
    ],
  },
  {
    id: 'webinar',
    name: 'Webinar / Aula gratuita',
    description: 'Inscrição → confirmação → lembrete 1h antes → oferta pós-aula.',
    category: 'captura',
    icon: GraduationCap,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Olá! 🎓 Vou te ajudar a se inscrever na nossa aula gratuita.' } },
      { id: 'n2', type: 'question', position: { x: 300, y: 240 }, data: { question: 'Qual o seu nome?', variable: 'nome' } },
      { id: 'n3', type: 'question', position: { x: 300, y: 400 }, data: { question: 'E o seu melhor e-mail?', variable: 'email' } },
      { id: 'n4', type: 'tag',      position: { x: 300, y: 560 }, data: { action: 'add', tag: 'webinar-inscrito' } },
      { id: 'n5', type: 'message',  position: { x: 300, y: 720 }, data: { text: 'Inscrição confirmada, {nome}! Vou te lembrar 1 hora antes do início.' } },
      { id: 'n6', type: 'delay',    position: { x: 300, y: 880 }, data: { amount: 1, unit: 'dias' } },
      { id: 'n7', type: 'message',  position: { x: 300, y: 1040 }, data: { text: '🔔 Lembrete: a aula começa em 1 hora! Não perca.' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0 },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 0 },
      { id: 'e5', source: 'n5', target: 'n6', sourceHandle: 0 },
      { id: 'e6', source: 'n6', target: 'n7', sourceHandle: 0 },
    ],
  },
  {
    id: 'quiz',
    name: 'Quiz / Diagnóstico',
    description: '3 perguntas → segmenta por resposta → oferta personalizada.',
    category: 'engajamento',
    icon: MessageCircleQuestion,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Vou te fazer 3 perguntas para indicar o melhor caminho. Topa? 🎯' } },
      { id: 'n2', type: 'buttons',  position: { x: 300, y: 240 }, data: { text: 'Você é...', options: ['Iniciante', 'Intermediário', 'Avançado'] } },
      { id: 'n3', type: 'tag',      position: { x:  80, y: 420 }, data: { action: 'add', tag: 'nivel-iniciante' } },
      { id: 'n4', type: 'tag',      position: { x: 320, y: 420 }, data: { action: 'add', tag: 'nivel-intermediario' } },
      { id: 'n5', type: 'tag',      position: { x: 560, y: 420 }, data: { action: 'add', tag: 'nivel-avancado' } },
      { id: 'n6', type: 'message',  position: { x: 300, y: 580 }, data: { text: 'Perfeito! Com base na sua resposta, tenho uma recomendação especial.' } },
      { id: 'n7', type: 'offer',    position: { x: 300, y: 740 }, data: { product: 'Recomendação', price: 197, cta: 'Quero saber mais' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n2', target: 'n4', sourceHandle: 1 },
      { id: 'e4', source: 'n2', target: 'n5', sourceHandle: 2 },
      { id: 'e5', source: 'n3', target: 'n6', sourceHandle: 0 },
      { id: 'e6', source: 'n4', target: 'n6', sourceHandle: 0 },
      { id: 'e7', source: 'n5', target: 'n6', sourceHandle: 0 },
      { id: 'e8', source: 'n6', target: 'n7', sourceHandle: 0 },
    ],
  },
  {
    id: 'reengage',
    name: 'Reativação de inativos',
    description: 'Mensagem amigável → oferta exclusiva → tag inativo se não responder.',
    category: 'engajamento',
    icon: Megaphone,
    nodes: [
      { id: 'n1', type: 'message',  position: { x: 300, y:  80 }, data: { text: 'Oi {nome}! Faz um tempo que não conversamos. Tudo bem? 👋' } },
      { id: 'n2', type: 'buttons',  position: { x: 300, y: 240 }, data: { text: 'Quer ver as novidades?', options: ['Quero!', 'Outra hora'] } },
      { id: 'n3', type: 'offer',    position: { x:  80, y: 420 }, data: { product: 'Oferta de retorno', price: 97, cta: 'Aproveitar' } },
      { id: 'n4', type: 'tag',      position: { x: 520, y: 420 }, data: { action: 'add', tag: 'inativo' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 0 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 0 },
      { id: 'e3', source: 'n2', target: 'n4', sourceHandle: 1 },
    ],
  },
]

export const TEMPLATE_CATEGORIES: Array<{ key: FlowTemplate['category']; label: string }> = [
  { key: 'inicio',      label: 'Começar' },
  { key: 'captura',     label: 'Captura de leads' },
  { key: 'vendas',      label: 'Vendas' },
  { key: 'pos-venda',   label: 'Pós-venda' },
  { key: 'engajamento', label: 'Engajamento' },
]

// ─── ID generation ──────────────────────────────────────────────────────────────

export function nodeUid(): string {
  return uid('n')
}

export function edgeUid(): string {
  return uid('e')
}

// ─── Canvas helpers ─────────────────────────────────────────────────────────────

export function getButtonHandleX(idx: number, count: number): number {
  if (count <= 1) return NODE_W / 2
  if (count === 2) return idx === 0 ? 50 : NODE_W - 50
  const padding = 30
  const spacing = (NODE_W - padding * 2) / (count - 1)
  return padding + idx * spacing
}

export function getHandlePos(node: FlowNodeType, handle: 'input' | 'output', outputIdx = 0) {
  if (handle === 'input') return { x: node.position.x + NODE_W / 2, y: node.position.y }
  const t = nodeTypes[node.type]
  if (!t || t.outputs === 0) return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H }
  if (t.outputs === 1) return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H }
  if (node.type === 'buttons') {
    const count = Math.max(2, node.data.options?.length ?? 2)
    return { x: node.position.x + getButtonHandleX(outputIdx, count), y: node.position.y + NODE_H }
  }
  return outputIdx === 0
    ? { x: node.position.x + 50, y: node.position.y + NODE_H }
    : { x: node.position.x + NODE_W - 50, y: node.position.y + NODE_H }
}

export function getNodePreview(node: FlowNodeType): string {
  switch (node.type) {
    case 'message':     return node.data.text || 'Mensagem vazia'
    case 'question':    return (node.data.text || node.data.question || '') || 'Pergunta vazia'
    case 'buttons':     return `${node.data.text || 'Botões'} (${node.data.options?.length || 0} opções)`
    case 'condition':   return `Se {${node.data.variable}} ${node.data.operator} "${node.data.value || '?'}"`
    case 'delay':       return `Aguardar ${node.data.amount} ${node.data.unit}`
    case 'offer':       return `${node.data.product} · ${fmtBRLdec(node.data.price || 0)}`
    case 'tag':         return `${node.data.action === 'add' ? 'Adicionar' : 'Remover'} tag "${node.data.tag}"`
    case 'handoff':     return `Encaminhar para ${node.data.team}`
    case 'image':       return node.data.caption || (node.data.imageUrl ? 'Imagem com URL' : 'Imagem (sem URL)')
    case 'video':       return node.data.caption || (node.data.videoUrl ? 'Vídeo com URL' : 'Vídeo (sem URL)')
    case 'link':        return `${node.data.text || 'Botão'} → ${node.data.url || 'sem URL'}`
    case 'checkout':    return `🛒 ${node.data.url || 'URL do checkout'}`
    case 'phone':       return (node.data.text as string) || 'Solicitar telefone'
    case 'upsell':      return `${node.data.product || 'Produto'} · ${fmtBRLdec(node.data.discountPrice || 0)}`
    case 'downsell':    return `${node.data.product || 'Alternativa'} · ${fmtBRLdec(node.data.discountPrice || 0)}`
    case 'orderbump':   return `${node.data.product || 'Bônus'} por ${fmtBRLdec(node.data.price || 0)}`
    case 'remarketing': return `Em ${node.data.delayAmount} ${node.data.delayUnit}: "${(node.data.text || '').slice(0, 40)}…"`
    case 'pix':         return `PIX no chat · ${fmtBRLdec(node.data.price || 0)}`
    case 'delivery':    return node.data.mode === 'invite'
                          ? `🎁 Convite único · ${node.data.chatRef || '(grupo)'}`
                          : `🎁 Link · ${node.data.url || '(sem link)'}`
    case 'noreply':     return `Cobra se sem resposta em ${node.data.delayAmount ?? 1} ${node.data.delayUnit ?? 'horas'}`
    default: return ''
  }
}

export function snapGrid(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE }

export function bezierPath(sx: number, sy: number, tx: number, ty: number) {
  const dy = ty - sy
  const off = Math.max(40, Math.abs(dy) * 0.5)
  return `M ${sx},${sy} C ${sx},${sy + off} ${tx},${ty - off} ${tx},${ty}`
}

// ─── Auto-layout with dagre (DYNAMIC import — only loads when used) ────────────

export async function autoLayout(nodes: FlowNodeType[], edges: FlowEdgeType[]): Promise<FlowNodeType[]> {
  const dagre = (await import('dagre')).default
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const pos = g.node(n.id)
    return { ...n, position: { x: snapGrid(pos.x - NODE_W / 2), y: snapGrid(pos.y - NODE_H / 2) } }
  })
}

// ─── URL safety ─────────────────────────────────────────────────────────────────

export function isSafeUrl(u: string): boolean {
  if (!u) return false
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

// ─── Validation helpers ─────────────────────────────────────────────────────────

export interface FlowValidationError {
  nodeId: string | null
  message: string
}

export function validateFlow(nodes: FlowNodeType[], edges: FlowEdgeType[]): FlowValidationError[] {
  const errors: FlowValidationError[] = []

  if (nodes.length === 0) {
    errors.push({ nodeId: null, message: 'O fluxo está vazio. Adicione pelo menos um nó.' })
    return errors
  }

  // 1 startNode (sem incoming)
  const hasIncoming = new Set(edges.map(e => e.target))
  const startNodes = nodes.filter(n => !hasIncoming.has(n.id))
  if (startNodes.length === 0) {
    errors.push({ nodeId: null, message: 'O fluxo não tem nó inicial (todos têm uma conexão de entrada).' })
  }
  if (startNodes.length > 1) {
    errors.push({
      nodeId: null,
      message: `Há ${startNodes.length} nós sem conexão de entrada. Conecte-os ou remova os extras.`,
    })
  }

  // Por nó, valida campos específicos
  for (const node of nodes) {
    const d = node.data
    switch (node.type) {
      case 'message':
        if (!d.text?.trim()) errors.push({ nodeId: node.id, message: 'Nó "Mensagem" está sem texto.' })
        break
      case 'question':
        if (!(d.text || d.question)?.trim())
          errors.push({ nodeId: node.id, message: 'Nó "Pergunta" está sem texto.' })
        if (!d.variable?.trim())
          errors.push({ nodeId: node.id, message: 'Nó "Pergunta" precisa de uma variável.' })
        break
      case 'buttons':
        if (!d.options || d.options.length < 2)
          errors.push({ nodeId: node.id, message: 'Nó "Botões" precisa de pelo menos 2 opções.' })
        break
      case 'condition':
        if (!d.variable?.trim())
          errors.push({ nodeId: node.id, message: 'Nó "Condição" precisa de uma variável.' })
        break
      case 'offer':
        if (!d.product?.trim())
          errors.push({ nodeId: node.id, message: 'Nó "Oferta" precisa do nome do produto.' })
        break
      case 'image':
        if (d.imageUrl && !isSafeUrl(d.imageUrl))
          errors.push({ nodeId: node.id, message: 'Nó "Imagem" tem URL inválida.' })
        break
      case 'video':
        if (d.videoUrl && !isSafeUrl(d.videoUrl))
          errors.push({ nodeId: node.id, message: 'Nó "Vídeo" tem URL inválida.' })
        break
      case 'link':
      case 'checkout':
        if (!d.url?.trim())
          errors.push({ nodeId: node.id, message: `Nó "${node.type}" precisa de uma URL.` })
        else if (!isSafeUrl(d.url))
          errors.push({ nodeId: node.id, message: `Nó "${node.type}" tem URL inválida.` })
        break
      case 'tag':
        if (!d.tag?.trim())
          errors.push({ nodeId: node.id, message: 'Nó "Tag" precisa de um nome de tag.' })
        break
      case 'delivery':
        if (d.mode === 'invite') {
          if (!d.chatRef?.trim())
            errors.push({ nodeId: node.id, message: 'Nó "Entregável" (convite) precisa do @grupo ou ID do grupo/canal.' })
        } else if (!d.url?.trim()) {
          errors.push({ nodeId: node.id, message: 'Nó "Entregável" precisa do link de acesso.' })
        } else if (!isSafeUrl(d.url)) {
          errors.push({ nodeId: node.id, message: 'Nó "Entregável" tem link inválido.' })
        }
        break
      case 'noreply':
        if (!d.text?.trim())
          errors.push({ nodeId: node.id, message: 'Nó "Sem resposta" precisa da mensagem de cobrança.' })
        break
    }
  }

  return errors
}
