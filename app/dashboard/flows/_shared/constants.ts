import React from 'react'
import { Plus, UserRound, ShoppingBag } from 'lucide-react'
import { NODE_W, NODE_H, GRID_SIZE, nodeTypes } from './nodeTypes'
import { fmtBRLdec } from './mappers'
import type { FlowTemplate, FlowNodeType, FlowEdgeType } from './types'

export { NODE_W, NODE_H, GRID_SIZE }

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'blank',
    name: 'Fluxo em branco',
    description: 'Canvas limpo para começar do zero.',
    icon: Plus,
    nodes: [],
    edges: [],
  },
  {
    id: 'lead-capture',
    name: 'Captura de lead',
    description: 'Boas-vindas → coleta nome e e-mail → aplica tag automaticamente.',
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
]

// ─── Canvas helpers ────────────────────────────────────────────────────────────

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
    default: return ''
  }
}

export function snapGrid(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE }

export function bezierPath(sx: number, sy: number, tx: number, ty: number) {
  const dy = ty - sy
  const off = Math.max(40, Math.abs(dy) * 0.5)
  return `M ${sx},${sy} C ${sx},${sy + off} ${tx},${ty - off} ${tx},${ty}`
}

// ─── Auto-layout with dagre ────────────────────────────────────────────────────

export function autoLayout(nodes: FlowNodeType[], edges: FlowEdgeType[]): FlowNodeType[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dagre = require('dagre') as typeof import('dagre')
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
