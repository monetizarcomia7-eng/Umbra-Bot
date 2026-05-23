import { createClient } from '@/lib/supabase/server'
import ActivityClient, { type RawActivityEvent, type BotOption } from './ActivityClient'

export default async function ActivityPage() {
  const supabase = await createClient()

  const [eventsRes, botsRes] = await Promise.all([
    supabase
      .from('activity_events')
      .select('id, type, title, description, bot, bot_id, amount, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('bots')
      .select('id, name, username')
      .order('name'),
  ])

  return (
    <ActivityClient
      initialEvents={(eventsRes.data ?? []) as unknown as RawActivityEvent[]}
      bots={(botsRes.data ?? []) as unknown as BotOption[]}
    />
  )
}
