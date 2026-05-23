import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BroadcastsClient, {
  type RawBroadcast,
  type RawBotOption,
  type AudienceCounts,
} from './BroadcastsClient'

const PAGE_SIZE = 50

export default async function BroadcastsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [broadcastsRes, botsRes, countsRes] = await Promise.all([
    supabase
      .from('broadcasts')
      .select(
        'id, title, bot_id, bot, audience, audience_count, status,' +
        'sent, delivered, failed, scheduled_for, started_at, finished_at,' +
        'failure_reason, message, media, buttons, filters, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),

    supabase
      .from('bots')
      .select('id, name, username, color')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false }),

    supabase.rpc('broadcasts_audience_counts', { p_user_id: user.id }),
  ])

  const initialBroadcasts = (broadcastsRes.data ?? []) as unknown as RawBroadcast[]
  const bots              = (botsRes.data ?? []) as unknown as RawBotOption[]

  // Fallback seguro se a RPC ainda não foi aplicada
  const countsRaw = (countsRes.data ?? {}) as Record<string, unknown>
  const audienceCounts: AudienceCounts = {
    all:    Number(countsRaw.all    ?? 0),
    leads:  Number(countsRaw.leads  ?? 0),
    buyers: Number(countsRaw.buyers ?? 0),
    tags:   (countsRaw.tags ?? {}) as Record<string, number>,
  }

  return (
    <BroadcastsClient
      initialBroadcasts={initialBroadcasts}
      bots={bots}
      audienceCounts={audienceCounts}
      userId={user.id}
      initialHasMore={initialBroadcasts.length >= PAGE_SIZE}
    />
  )
}
