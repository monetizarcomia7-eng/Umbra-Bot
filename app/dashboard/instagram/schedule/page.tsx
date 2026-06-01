import { createClient } from '@/lib/supabase/server'
import ScheduleClient from '@/components/instagram/schedule/ScheduleClient'
import type { RawIgAccount } from '../page'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: accounts } = await supabase
    .from('instagram_accounts')
    .select('id, ig_user_id, username, profile_picture, token_expires_at, is_active, created_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return (
    <ScheduleClient
      accounts={(accounts ?? []) as RawIgAccount[]}
      hasMetaConfig={!!process.env.META_APP_ID}
    />
  )
}
