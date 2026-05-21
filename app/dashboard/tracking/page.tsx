import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/Layout'
import TrackingClient from './TrackingClient'

export interface RawPixelRow {
  id:           string
  provider:     string
  pixel_id:     string | null
  access_token: string | null  // criptografado — usado só para derivar hasToken
  status:       string
  events:       Record<string, boolean>
  capi:         boolean
  created_at:   string
  updated_at:   string
}

export interface PixelStats {
  events_sent_today: number
  events_matched:    number
  last_event:        string | null  // ISO timestamp
}

export default async function TrackingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [pixelsRes, statsRes] = await Promise.all([
    supabase
      .from('pixels')
      .select('id, provider, pixel_id, access_token, status, events, capi, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase.rpc('pixels_stats', { p_user_id: user.id }),
  ])

  const initialStats: PixelStats = (statsRes.data as PixelStats | null) ?? {
    events_sent_today: 0,
    events_matched:    0,
    last_event:        null,
  }

  return (
    <DashboardLayout>
      <TrackingClient
        initialPixels={(pixelsRes.data ?? []) as RawPixelRow[]}
        initialStats={initialStats}
        userId={user.id}
      />
    </DashboardLayout>
  )
}
