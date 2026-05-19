import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from '@/components/dashboard/finance/FinanceDashboard'
import type { RawTransaction, RawWithdrawal } from '@/components/dashboard/finance/types'

export default async function FinancePage() {
  const supabase = await createClient()

  const [txRes, wdRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, net, fee, status, product_name, customer_name, gateway, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('withdrawals')
      .select('id, amount, account_id, account_label, status, created_at, concluded_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <FinanceDashboard
      initialTransactions={(txRes.data as RawTransaction[]) ?? []}
      initialWithdrawals={(wdRes.data as RawWithdrawal[]) ?? []}
    />
  )
}
