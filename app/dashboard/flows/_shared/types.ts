// Shared types for the flows module

// ─── Public types (re-exported via FlowsClient) ────────────────────────────────

export interface RawFlowRow {
  id: string
  name: string
  bot: string
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

// ─── Internal types ────────────────────────────────────────────────────────────

export interface NodeData {
  text?: string
  question?: string
  variable?: string
  options?: string[]
  operator?: string
  value?: string
  amount?: number
  unit?: string
  product?: string
  price?: number
  cta?: string
  action?: string
  tag?: string
  team?: string
  message?: string
  imageUrl?: string
  videoUrl?: string
  caption?: string
  url?: string
  description?: string
  originalPrice?: number
  discountPrice?: number
  campaignName?: string
  delayAmount?: number
  delayUnit?: string
}

export interface FlowNodeType {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
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
  bot: string
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
  icon: React.ElementType
  nodes: FlowNodeType[]
  edges: FlowEdgeType[]
}
