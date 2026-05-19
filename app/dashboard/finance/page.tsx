import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from '@/components/dashboard/finance/FinanceDashboard'
import type { RawTransaction } from '@/components/dashboard/finance/types'

export default async function FinancePage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('transactions')
    .select('id, amount, net, fee, status, product_name, customer_name, gateway, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  return <FinanceDashboard initialTransactions={(data as RawTransaction[]) ?? []} />
}
