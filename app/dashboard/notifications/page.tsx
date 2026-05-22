import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsClient, type RawNotifPrefs, type RawBotOption } from './NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [prefsRes, botsRes] = await Promise.all([
    supabase
      .from('notification_prefs')
      .select('prefs, channel_state, quiet')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('bots')
      .select('id, name, username')
      .eq('user_id', user.id)
      .not('token', 'is', null)
      .order('added_at', { ascending: false }),
  ])

  const bots: RawBotOption[] = (botsRes.data ?? []).map(b => ({
    id:       b.id as string,
    name:     b.name as string,
    username: (b.username as string | null) ?? null,
  }))

  return (
    <NotificationsClient
      userId={user.id}
      userEmail={user.email ?? ''}
      initialPrefs={(prefsRes.data ?? null) as RawNotifPrefs | null}
      bots={bots}
    />
  )
}
