import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WebhooksClient } from './WebhooksClient'

export interface RawWebhookRow {
  id:             string
  name:           string
  url:            string
  events:         string[]
  status:         'healthy' | 'failing' | 'paused'
  active:         boolean
  deliveries_24h: number
  success_rate:   number
  last_delivery:  number | null
  created_at:     string
}

export default async function WebhooksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('id, name, url, events, status, active, deliveries_24h, success_rate, last_delivery, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <WebhooksClient
      initialWebhooks={(webhooks ?? []) as RawWebhookRow[]}
      userId={user.id}
    />
  )
}
