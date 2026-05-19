import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import CustomersClient, { type RawContact, type ContactBotOption } from './CustomersClient'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const uid = user.id

  const [contactsRes, botsRes, summaryRes, filterOptsRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, username, email, phone, origin, bot, bot_id, purchases, total_spent, avg_ticket, tags, first_contact, last_contact, first_purchase, last_purchase')
      .eq('user_id', uid)
      .order('last_contact', { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from('bots')
      .select('id, name, username')
      .eq('user_id', uid)
      .order('name'),
    supabase.rpc('contacts_summary', { p_user_id: uid }),
    supabase.rpc('contacts_filter_options', { p_user_id: uid }),
  ])

  const summary = (summaryRes.data as { total: number; buyers: number; leads: number } | null) ?? {
    total: 0, buyers: 0, leads: 0,
  }

  const filterOpts = (filterOptsRes.data as { origins: string[] } | null) ?? { origins: [] }

  return (
    <DashboardLayout>
      <CustomersClient
        initialContacts={(contactsRes.data ?? []) as unknown as RawContact[]}
        bots={(botsRes.data ?? []) as unknown as ContactBotOption[]}
        totalCount={summary.total}
        buyersCount={summary.buyers}
        leadsCount={summary.leads}
        originOptions={filterOpts.origins ?? []}
        hasMore={(contactsRes.data?.length ?? 0) >= PAGE_SIZE}
      />
    </DashboardLayout>
  )
}
