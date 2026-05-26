import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AnalyticsClient from './AnalyticsClient'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ days?: string }>
}

export default async function FlowAnalyticsPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const days = Math.min(Math.max(Number(sp.days ?? '7'), 1), 90)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carrega o fluxo + dados agregados em paralelo
  // Server Component: Date.now() é seguro aqui (sem re-render)
  // eslint-disable-next-line react-hooks/purity
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const [flowRes, nodesStatsRes, tsRes, revenueRes, leadsRes] = await Promise.all([
    supabase.from('flows')
      .select('id, name, status, bot, bot_id, executions, conversion, nodes, edges, description, updated_at')
      .eq('id', id).eq('user_id', user.id).maybeSingle(),
    supabase.rpc('flow_node_stats_v2', { p_flow_id: id, p_days: days }),
    supabase.rpc('flow_events_timeseries', { p_flow_id: id, p_days: days }),
    supabase.from('transactions')
      .select('net, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('flow_id', id)
      .eq('status', 'approved')
      .gte('created_at', cutoff),
    supabase.from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('flow_id', id),
  ])

  if (!flowRes.data) notFound()

  const totalRevenue = (revenueRes.data ?? []).reduce(
    (sum, t: { net: number | null }) => sum + Number(t.net ?? 0),
    0,
  )

  return (
    <AnalyticsClient
      flow={{
        id:          flowRes.data.id,
        name:        flowRes.data.name,
        status:      flowRes.data.status,
        bot:         flowRes.data.bot ?? '',
        nodes:       (flowRes.data.nodes ?? []) as Array<{ id: string; type: string; data: Record<string, unknown> }>,
        executions:  Number(flowRes.data.executions ?? 0),
        conversion:  Number(flowRes.data.conversion ?? 0),
        description: flowRes.data.description ?? '',
      }}
      days={days}
      nodesStats={(nodesStatsRes.data ?? []) as Array<{
        node_id: string; node_type: string;
        entered: number; sent: number; failed: number;
        completed: number; abandoned: number;
        avg_latency_ms: number | null;
      }>}
      timeseries={(tsRes.data ?? []) as Array<{
        day: string; entered: number; sent: number; failed: number; completed: number;
      }>}
      kpis={{
        totalRevenue,
        totalSales:     revenueRes.count ?? 0,
        totalLeads:     leadsRes.count ?? 0,
      }}
    />
  )
}
