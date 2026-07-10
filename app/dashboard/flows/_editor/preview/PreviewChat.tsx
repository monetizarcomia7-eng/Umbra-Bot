'use client'
import { fmtBRLdec } from '../../_shared/mappers'
import type { FlowNodeType, FlowEdgeType } from '../../_shared/types'

interface ChatBubble {
  side: 'bot' | 'user'
  text: string
  buttons?: string[]
}

type PreviewEntry = ChatBubble | { branch: string; entries: PreviewEntry[] }[]

function buildPreviewPath(
  nodeId: string | undefined,
  nodeById: Map<string, FlowNodeType>,
  edgesBySource: Map<string, FlowEdgeType[]>,
  visited: Set<string>,
  depth: number
): PreviewEntry[] {
  if (!nodeId || depth > 20 || visited.has(nodeId)) return []
  const node = nodeById.get(nodeId)
  if (!node) return []
  visited.add(nodeId)

  const nextEdges = edgesBySource.get(nodeId) ?? []
  const entries: PreviewEntry[] = []

  const botText = (text: string, buttons?: string[]) => {
    entries.push({ side: 'bot', text, buttons } as ChatBubble)
  }

  switch (node.type) {
    case 'message':
      botText(node.data.text || '(mensagem vazia)')
      break
    case 'question':
      botText(node.data.text || node.data.question || '(pergunta)')
      entries.push({ side: 'user', text: `{${node.data.variable || 'resposta'}}` } as ChatBubble)
      break
    case 'buttons':
      botText(node.data.text || 'Escolha uma opção:', node.data.options)
      if (node.data.options && node.data.options.length > 0) {
        const branches = nextEdges.map((edge, idx) => {
          const label = node.data.options?.[idx] ?? `Opção ${idx + 1}`
          const subVisited = new Set(visited)
          return { branch: label, entries: buildPreviewPath(edge.target, nodeById, edgesBySource, subVisited, depth + 1) }
        })
        if (branches.length > 0) {
          entries.push(branches)
          return entries
        }
      }
      break
    case 'condition': {
      const branches = nextEdges.slice(0, 2).map((edge, idx) => {
        const subVisited = new Set(visited)
        return { branch: idx === 0 ? 'Sim' : 'Não', entries: buildPreviewPath(edge.target, nodeById, edgesBySource, subVisited, depth + 1) }
      })
      if (branches.length > 0) {
        entries.push(branches)
        return entries
      }
      break
    }
    case 'delay':
      entries.push({ side: 'bot', text: `⏱ Aguardar ${node.data.amount} ${node.data.unit}` } as ChatBubble)
      break
    case 'offer':
      botText(`🎯 ${node.data.product}\n${fmtBRLdec(node.data.price ?? 0)}\n${node.data.cta || 'Comprar'}`)
      break
    case 'tag':
      entries.push({ side: 'bot', text: `🏷 Tag: ${node.data.action === 'remove' ? '–' : '+'}${node.data.tag}` } as ChatBubble)
      break
    case 'image':
      entries.push({ side: 'bot', text: '🖼 [imagem]' } as ChatBubble)
      break
    case 'video':
      entries.push({ side: 'bot', text: '🎬 [vídeo]' } as ChatBubble)
      break
    case 'link':
      botText(node.data.text || 'Ver link', [node.data.text || 'Abrir'])
      break
    case 'checkout':
      entries.push({ side: 'bot', text: `🛒 Checkout: ${node.data.url || '(url)'}` } as ChatBubble)
      break
    case 'pix':
      entries.push({ side: 'bot', text: `💠 PIX de ${node.data.product || 'produto'} (QR + copia-e-cola)` } as ChatBubble)
      entries.push({ side: 'user', text: '💳 (paga)' } as ChatBubble)
      break
    case 'delivery':
      botText(node.data.message || '🎁 Acesso liberado!', [node.data.buttonText || 'Acessar'])
      break
    case 'phone':
      botText((node.data.text as string) || 'Compartilhe seu telefone')
      entries.push({ side: 'user', text: '📱 (número)' } as ChatBubble)
      break
    case 'handoff':
      entries.push({ side: 'bot', text: `🤝 Encaminhando para ${node.data.team || 'atendimento'}` } as ChatBubble)
      return entries
    case 'remarketing':
      botText(`📣 (remarketing) ${(node.data.text || '').slice(0, 40)}`)
      break
    case 'noreply':
      entries.push({ side: 'bot', text: `⏰ (se o lead não responder) ${(node.data.text || '').slice(0, 40)}` } as ChatBubble)
      break
    default:
      break
  }

  const nextEdge = nextEdges[0]
  if (nextEdge) {
    entries.push(...buildPreviewPath(nextEdge.target, nodeById, edgesBySource, visited, depth + 1))
  }

  return entries
}

function RenderBubble({ entry }: { entry: ChatBubble }) {
  const isBot = entry.side === 'bot'
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-2`}>
      <div
        className="max-w-[80%] rounded-xl px-3 py-2 text-xs"
        style={{
          background: isBot ? 'var(--surface-2)' : 'var(--primary)',
          color: isBot ? 'var(--text)' : 'var(--accent-fg)',
          border: isBot ? '1px solid var(--border)' : undefined,
          whiteSpace: 'pre-wrap',
        }}
      >
        {entry.text}
        {entry.buttons && (
          <div className="mt-2 flex flex-col gap-1">
            {entry.buttons.map((b, i) => (
              <div key={i} className="px-2 py-1 rounded-lg text-center text-xs"
                style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RenderPreviewEntries({ entries }: { entries: PreviewEntry[] }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (Array.isArray(entry)) {
          return (
            <div key={i} className="ml-2 border-l-2 pl-2 mb-2" style={{ borderColor: 'var(--border)' }}>
              {entry.map((branch, bi) => (
                <div key={bi} className="mb-2">
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    ↳ {branch.branch}
                  </p>
                  <RenderPreviewEntries entries={branch.entries} />
                </div>
              ))}
            </div>
          )
        }
        return <RenderBubble key={i} entry={entry as ChatBubble} />
      })}
    </>
  )
}

interface Props {
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
}

export default function PreviewChat({ nodes, edges }: Props) {
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const edgesBySource = new Map<string, FlowEdgeType[]>()
  edges.forEach(e => {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, [])
    edgesBySource.get(e.source)!.push(e)
  })

  const hasIncoming = new Set(edges.map(e => e.target))
  const startNode = nodes.find(n => !hasIncoming.has(n.id))

  const entries = startNode
    ? buildPreviewPath(startNode.id, nodeById, edgesBySource, new Set(), 0)
    : []

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Prévia do fluxo
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
            Adicione nós para ver a prévia
          </p>
        ) : (
          <RenderPreviewEntries entries={entries} />
        )}
      </div>
    </div>
  )
}
