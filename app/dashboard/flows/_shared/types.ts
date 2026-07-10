// Shared types for the flows module

// ─── Public types (re-exported via FlowsClient) ────────────────────────────────

export interface RawFlowRow {
  id: string
  name: string
  bot: string
  bot_id: string | null
  bot_color: string
  status: string
  executions: number
  conversion: number
  description: string
  updated_at: string
  revenue?: number
  sales?: number
  leads?: number
}

export interface RawBotOption {
  id: string
  name: string
  username: string | null
  color: string | null
}

export interface FlowStatsMap {
  [flowId: string]: {
    revenue: number
    sales: number
    leads: number
  }
}

// ─── Node data (kept as wide bag for backwards compat) ─────────────────────────
// Keep this union-friendly so we can refactor per-type later, but maintain the
// full bag of optional fields to not break existing JSONB rows in the DB.

export interface GalleryItem {
  kind: 'image' | 'video'
  url?: string
  fileId?: string
}

export interface NodeData {
  // Conversa
  text?: string
  question?: string
  variable?: string
  options?: string[]
  // Lógica
  operator?: string
  value?: string
  amount?: number
  unit?: string
  // Comercial
  product?: string
  price?: number
  cta?: string
  cpf?: string          // Pix no Chat — CPF fixo do pagador
  // CRM
  action?: string
  tag?: string
  team?: string
  // Mensagem genérica
  message?: string
  // Mídia
  imageUrl?: string
  videoUrl?: string
  fileId?: string        // file_id da Biblioteca de Mídia (Telegram) — alternativa à URL
  galleryItems?: GalleryItem[]   // Galeria/álbum — várias mídias de uma vez
  caption?: string
  url?: string
  description?: string
  // Upsell / Downsell
  originalPrice?: number
  discountPrice?: number
  // Outros
  campaignName?: string
  delayAmount?: number
  delayUnit?: string
  // Remarketing — mídia anexada (imagem/vídeo, via URL ou Biblioteca de Mídia)
  mediaKind?: 'none' | 'image' | 'video'
  mediaUrl?: string
  mediaFileId?: string
  // Entregável (delivery) — entrega o acesso só para quem pagou
  mode?: 'link' | 'invite'   // link fixo OU convite único do Telegram
  chatRef?: string           // @grupo ou id -100... (modo convite)
  buttonText?: string        // texto do botão de acesso
}

export interface FlowNodeType {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
}

// Canal/grupo onde o bot é admin — usado no nó Entregável (modo convite)
export interface BotChannel {
  chatId:    string
  title:     string
  username:  string | null
  type:      string
  canInvite: boolean
}

export interface FlowEdgeType {
  id: string
  source: string
  target: string
  sourceHandle?: number
  label?: string
}

export interface FlowMeta {
  id: string
  name: string
  bot: string           // label legacy ("@username" ou nome)
  botId: string | null  // FK real (substitui `bot` em comparações)
  botColor: string
  status: 'published' | 'draft'
  executions: number
  conversion: number
  updatedAt: number
  description: string
  revenue: number
  sales: number
  leads: number
}

export interface FlowEditorData extends FlowMeta {
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
  triggerType: 'start' | 'keyword'
  keywords: string[]
}

export interface FlowTemplate {
  id: string
  name: string
  description: string
  category: 'inicio' | 'captura' | 'vendas' | 'pos-venda' | 'engajamento'
  icon: React.ElementType
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
}

// ─── Node stats (lazy-loaded) ──────────────────────────────────────────────────

export interface FlowNodeStatsRow {
  node_id: string
  node_type: string
  entered: number
  sent: number
  failed: number
  completed: number
}

// ─── Versions ──────────────────────────────────────────────────────────────────

export interface FlowVersionRow {
  id: string
  version: number
  name: string
  published_at: string
}
