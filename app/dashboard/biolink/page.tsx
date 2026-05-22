import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { BioLinkClient } from './BioLinkClient'

export const dynamic = 'force-dynamic'

export interface RawBiolink {
  id: string
  slug: string
  name: string
  bio: string
  avatar: string
  avatar_color: string
  theme_id: string
  background: string
  button_style: string
  links: unknown
  views: number
  clicks: number
  conversion: number
  top_referrer: string
  status: 'published' | 'draft'
  user_id: string
  created_at: string
  updated_at: string
}

export interface BioAnalytics {
  views_period: number
  clicks_period: number
  clicks_by_link: Record<string, number>
}

export default async function BioLinkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [biolinkRes, analyticsRes] = await Promise.all([
    supabase.from('biolinks').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.rpc('biolink_analytics', { p_user_id: user.id, p_days: 30 }),
  ])

  const fallbackAnalytics: BioAnalytics = { views_period: 0, clicks_period: 0, clicks_by_link: {} }

  return (
    <DashboardLayout>
      <BioLinkClient
        userId={user.id}
        initialBiolink={(biolinkRes.data as RawBiolink) ?? null}
        initialAnalytics={(analyticsRes.data as BioAnalytics) ?? fallbackAnalytics}
        appUrl={process.env.APP_URL ?? 'https://umbra.bot'}
      />
    </DashboardLayout>
  )
}
