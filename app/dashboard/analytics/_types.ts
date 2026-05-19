// ── Filtros ──────────────────────────────────────────────────

export type Period = '7d' | '30d' | '90d' | 'all'

export interface Filters {
  period: Period
  botId: string
  productName: string
  flowId: string
  utmSource: string
  compare: boolean
}

export const DEFAULT_FILTERS: Filters = {
  period: '30d',
  botId: 'all',
  productName: 'all',
  flowId: 'all',
  utmSource: 'all',
  compare: false,
}

// ── Opções dos dropdowns ─────────────────────────────────────

export interface BotOption  { id: string; name: string; username: string }
export interface FlowOption { id: string; name: string }

// ── Cards de resumo (computados no servidor) ─────────────────

export interface FunnelStage {
  stage: string
  value: number
  prev: number
}

export interface BotStat {
  name: string
  revenue: number
  sales: number
  ticket: number
}

export interface ProductStat {
  name: string
  revenue: number
  units: number
  ticket: number
}

export interface FlowStat {
  name: string
  revenue: number
  sales: number
  ticket: number
  isReal: boolean
}

export interface UtmStat {
  source: string
  revenue: number
  sales: number
  ticket: number
}

export interface StatusData {
  name: string
  value: number
  color: string
}

export interface CohortRow {
  label: string
  size: number
  weeks: (number | null)[]
}

export interface ExportRow {
  date: string
  product: string
  amount: number
  fee: number
  net: number
  bot: string
  flow: string
  utmSource: string
  utmCampaign: string
}

// ── Payload completo passado do Server para o Client ─────────

export interface AnalyticsSummary {
  filters: Filters
  funnel: FunnelStage[]
  byBot: BotStat[]
  byProduct: ProductStat[]
  byFlow: FlowStat[]
  byUtm: UtmStat[]
  statusBreakdown: StatusData[]
  cohortRows: CohortRow[]
  // Opções para os dropdowns
  botOptions: BotOption[]
  productOptions: string[]
  flowOptions: FlowOption[]
  utmOptions: string[]
  // Meta
  error: string | null
  limitReached: boolean
  queryLimit: number
}
