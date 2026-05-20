import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import BotsClient, { type RawBotRow } from './BotsClient'
import type { FlowData } from './BotsClient'

export default async function BotsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [botsRes, flowsRes] = await Promise.all([
    supabase
      .from('bots')
      .select(
        'id, name, username, status, leads, sales, conversion, revenue, ' +
        'active_flow_id, color, telegram_id, webhook_url, last_sync, added_at, ' +
        'description, welcome_message, fallback_message',
      )
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),

    supabase
      .from('flows')
      .select('id, name, description, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <DashboardLayout>
      <BotsClient
        initialBots={(botsRes.data ?? []) as unknown as RawBotRow[]}
        flows={(flowsRes.data ?? []) as unknown as FlowData[]}
        userId={user.id}
      />
    </DashboardLayout>
  )
}
