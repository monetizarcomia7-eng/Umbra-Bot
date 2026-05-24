import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FlowsClient, { type RawFlowRow, type RawBotOption, type FlowStatsMap } from './FlowsClient'

export default async function FlowsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [flowsRes, botsRes, txRes, contactsRes] = await Promise.all([
    supabase
      .from('flows')
      .select('id, name, bot, bot_color, status, executions, conversion, description, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('bots')
      .select('id, name, username, color')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),
    // Revenue and sale count per flow (approved transactions only)
    supabase
      .from('transactions')
      .select('flow_id, net')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .not('flow_id', 'is', null),
    // Leads (contacts) attributed to each flow
    supabase
      .from('contacts')
      .select('flow_id')
      .eq('user_id', user.id)
      .not('flow_id', 'is', null),
  ])

  // Build per-flow stats maps from query results
  const revenueMap: Record<string, number> = {}
  const salesMap:   Record<string, number> = {}
  for (const row of txRes.data ?? []) {
    const fid = row.flow_id as string
    revenueMap[fid] = (revenueMap[fid] ?? 0) + Number(row.net ?? 0)
    salesMap[fid]   = (salesMap[fid]   ?? 0) + 1
  }

  const leadsMap: Record<string, number> = {}
  for (const row of contactsRes.data ?? []) {
    const fid = row.flow_id as string
    leadsMap[fid] = (leadsMap[fid] ?? 0) + 1
  }

  // Merge into a single FlowStatsMap keyed by flow id
  const statsMap: FlowStatsMap = {}
  const allFlowIds = new Set([
    ...Object.keys(revenueMap),
    ...Object.keys(leadsMap),
  ])
  for (const fid of allFlowIds) {
    statsMap[fid] = {
      revenue: revenueMap[fid] ?? 0,
      sales:   salesMap[fid]   ?? 0,
      leads:   leadsMap[fid]   ?? 0,
    }
  }

  return (
    <FlowsClient
      initialFlows={(flowsRes.data ?? []) as unknown as RawFlowRow[]}
      bots={(botsRes.data ?? []) as unknown as RawBotOption[]}
      userId={user.id}
      statsMap={statsMap}
    />
  )
}
