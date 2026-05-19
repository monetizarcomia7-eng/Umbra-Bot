import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsClient, type RawNotifPrefs } from './NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [prefsRes, botRes] = await Promise.all([
    supabase
      .from('notification_prefs')
      .select('prefs, channel_state, quiet')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('bots')
      .select('name, username')
      .eq('user_id', user.id)
      .not('token', 'is', null)
      .limit(1)
      .maybeSingle(),
  ])

  const firstBot = botRes.data
    ? { name: botRes.data.name as string, username: (botRes.data.username as string | null) }
    : null

  return (
    <NotificationsClient
      userId={user.id}
      userEmail={user.email ?? ''}
      initialPrefs={(prefsRes.data ?? null) as RawNotifPrefs | null}
      firstBot={firstBot}
    />
  )
}
