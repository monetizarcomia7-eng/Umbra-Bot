import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient, ActivityEvent, BotSummary } from './_components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const uid        = user.id
  const now        = Date.now()
  const since30d   = new Date(now - 30 * 86_400_000).toISOString()
  const prevSince  = new Date(now - 60 * 86_400_000).toISOString()

  const [
    txRes,
    activeBotsRes,
    allBotsRes,
    prevTxRes,
    profileRes,
    leadsRes,
    prevLeadsRes,
    activityRes,
    botsListRes,
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, net, created_at, product_name')
      .eq('user_id', uid)
      .eq('status', 'approved')
      .gte('created_at', since30d),
    supabase
      .from('bots')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('status', 'online'),
    supabase
      .from('bots')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid),
    supabase
      .from('transactions')
      .select('net, amount')
      .eq('user_id', uid)
      .eq('status', 'approved')
      .gte('created_at', prevSince)
      .lt('created_at', since30d),
    supabase.from('profiles').select('balance').eq('id', uid).single(),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('created_at', since30d),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('created_at', prevSince)
      .lt('created_at', since30d),
    supabase
      .from('activity_events')
      .select('id, type, title, description, bot, amount, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('bots')
      .select('id, name, username, status, color')
      .eq('user_id', uid)
      .order('added_at', { ascending: false })
      .limit(6),
  ])

  return (
    <DashboardClient
      transactions={txRes.data ?? []}
      prevTransactions={prevTxRes.data ?? []}
      botsActiveCount={activeBotsRes.count ?? 0}
      botsTotalCount={allBotsRes.count ?? 0}
      balance={Number(profileRes.data?.balance ?? 0)}
      leadsCount={leadsRes.count ?? 0}
      prevLeadsCount={prevLeadsRes.count ?? 0}
      recentActivity={(activityRes.data ?? []) as ActivityEvent[]}
      botsList={(botsListRes.data ?? []) as BotSummary[]}
    />
  )
}
