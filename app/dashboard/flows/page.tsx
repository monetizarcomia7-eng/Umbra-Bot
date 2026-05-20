import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import FlowsClient, { type RawFlowRow, type RawBotOption } from './FlowsClient'

export default async function FlowsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [flowsRes, botsRes] = await Promise.all([
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
  ])

  return (
    <DashboardLayout>
      <FlowsClient
        initialFlows={(flowsRes.data ?? []) as unknown as RawFlowRow[]}
        bots={(botsRes.data ?? []) as unknown as RawBotOption[]}
        userId={user.id}
      />
    </DashboardLayout>
  )
}
