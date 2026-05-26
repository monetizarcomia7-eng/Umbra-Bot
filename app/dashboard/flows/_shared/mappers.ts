import type { RawFlowRow, FlowMeta, FlowEditorData, FlowNodeType, FlowEdgeType } from './types'

export function mapRawMeta(r: RawFlowRow): FlowMeta {
  return {
    id: r.id,
    name: r.name,
    bot: r.bot ?? '',
    botColor: r.bot_color ?? '#6366f1',
    status: (r.status as FlowMeta['status']) ?? 'draft',
    executions: Number(r.executions ?? 0),
    conversion: Number(r.conversion ?? 0),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    description: r.description ?? '',
    revenue: Number(r.revenue ?? 0),
    sales: Number(r.sales ?? 0),
    leads: Number(r.leads ?? 0),
  }
}

export function mapRawFull(r: Record<string, unknown>): FlowEditorData {
  return {
    id: r.id as string,
    name: r.name as string,
    bot: (r.bot as string) ?? '',
    botColor: (r.bot_color as string) ?? '#6366f1',
    status: (r.status as FlowMeta['status']) ?? 'draft',
    executions: Number(r.executions ?? 0),
    conversion: Number(r.conversion ?? 0),
    revenue: Number(r.revenue ?? 0),
    sales: Number(r.sales ?? 0),
    leads: Number(r.leads ?? 0),
    updatedAt: r.updated_at ? new Date(r.updated_at as string).getTime() : Date.now(),
    description: (r.description as string) ?? '',
    nodes: (r.nodes as FlowNodeType[]) ?? [],
    edges: (r.edges as FlowEdgeType[]) ?? [],
    triggerType: ((r.trigger_type as string) === 'keyword' ? 'keyword' : 'start'),
    keywords: (r.keywords as string[]) ?? [],
  }
}

export function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
export function fmtBRLdec(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
export function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' }
export function fmtDate(d: number) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
