import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RemarketingClient, { type RawCampaign, type RawBotOption } from './RemarketingClient'

const PAGE_SIZE = 50

export default async function RemarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [campaignsRes, botsRes] = await Promise.all([
    supabase
      .from('remarketing_campaigns')
      // step_stats omitido: payload grande, só usado no PerformanceCard do editor (lazy-load)
      .select('id, name, description, trigger_type, audience, trigger_config, status, leads_recovered, revenue_recovered, leads_triggered, conversion, steps, bot_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from('bots')
      .select('id, name, username, color')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),
  ])

  const initialCampaigns = (campaignsRes.data ?? []) as unknown as RawCampaign[]

  return (
    <RemarketingClient
      initialCampaigns={initialCampaigns}
      bots={(botsRes.data ?? []) as unknown as RawBotOption[]}
      userId={user.id}
      initialHasMore={initialCampaigns.length >= PAGE_SIZE}
    />
  )
}
