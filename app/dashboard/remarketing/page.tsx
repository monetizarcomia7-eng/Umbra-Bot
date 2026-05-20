import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import RemarketingClient, { type RawCampaign, type RawBotOption } from './RemarketingClient'

export default async function RemarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [campaignsRes, botsRes] = await Promise.all([
    supabase
      .from('remarketing_campaigns')
      .select('id, name, description, trigger_type, audience, trigger_config, status, leads_recovered, revenue_recovered, leads_triggered, conversion, steps, step_stats, bot_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('bots')
      .select('id, name, username, color')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),
  ])

  return (
    <DashboardLayout>
      <RemarketingClient
        initialCampaigns={(campaignsRes.data ?? []) as unknown as RawCampaign[]}
        bots={(botsRes.data ?? []) as unknown as RawBotOption[]}
        userId={user.id}
      />
    </DashboardLayout>
  )
}
