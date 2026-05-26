import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FlowsClient from './FlowsClient'
import type { RawFlowRow, RawBotOption } from './_shared/types'

interface FlowStatsRow {
  flow_id: string
  revenue: number | string | null
  sales:   number | string | null
  leads:   number | string | null
}

export default async function FlowsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Tudo em paralelo. statsRes usa RPC agregada (sem trazer N rows de transactions).
  const [flowsRes, botsRes, statsRes] = await Promise.all([
    supabase
      .from('flows')
      .select('id, name, bot, bot_id, bot_color, status, executions, conversion, description, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('bots')
      .select('id, name, username, color')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),
    supabase.rpc('flows_stats_by_user', { p_user_id: user.id }),
  ])

  // Aplica fallback se a RPC ainda não foi criada (migração 103 não rodou)
  const statsMap = new Map<string, { revenue: number; sales: number; leads: number }>()
  if (statsRes.data) {
    for (const row of statsRes.data as FlowStatsRow[]) {
      statsMap.set(row.flow_id, {
        revenue: Number(row.revenue ?? 0),
        sales:   Number(row.sales ?? 0),
        leads:   Number(row.leads ?? 0),
      })
    }
  }

  const flowsWithStats: RawFlowRow[] = (flowsRes.data ?? []).map(f => {
    const s = statsMap.get(f.id as string)
    return {
      ...(f as unknown as RawFlowRow),
      revenue: s?.revenue ?? 0,
      sales:   s?.sales   ?? 0,
      leads:   s?.leads   ?? 0,
    }
  })

  return (
    <FlowsClient
      initialFlows={flowsWithStats}
      bots={(botsRes.data ?? []) as unknown as RawBotOption[]}
      userId={user.id}
    />
  )
}
