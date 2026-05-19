import { createClient } from '@/lib/supabase/server'
import { AnalyticsClient } from './AnalyticsClient'
import type { AnalyticsTx, AnalyticsContact, AnalyticsBot, AnalyticsFlow } from './AnalyticsClient'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [txRes, contactsRes, botsRes, flowsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, bot_id, status, amount, net, fee, product_name, customer_telegram_id, customer_email, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('contacts')
      .select('id, bot_id, orders_count, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('bots')
      .select('id, name, username')
      .eq('user_id', user.id),
    supabase
      .from('flows')
      .select('id, name, executions, conversion')
      .eq('user_id', user.id)
      .order('executions', { ascending: false })
      .limit(10),
  ])

  return (
    <AnalyticsClient
      transactions={(txRes.data as AnalyticsTx[]) ?? []}
      contacts={(contactsRes.data as AnalyticsContact[]) ?? []}
      bots={(botsRes.data as AnalyticsBot[]) ?? []}
      flows={(flowsRes.data as AnalyticsFlow[]) ?? []}
    />
  )
}
