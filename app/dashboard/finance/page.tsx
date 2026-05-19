import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from '@/components/dashboard/finance/FinanceDashboard'
import type { RawTransaction, RawWithdrawal } from '@/components/dashboard/finance/types'

const TX_LIMIT = 500
const WD_LIMIT = 200

export default async function FinancePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const uid = user.id

  const [txRes, wdRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, net, fee, status, product_name, customer_name, gateway, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(TX_LIMIT),
    supabase
      .from('withdrawals')
      .select('id, amount, account_id, account_label, status, created_at, concluded_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(WD_LIMIT),
  ])

  const limitReached = (txRes.data?.length ?? 0) >= TX_LIMIT

  return (
    <FinanceDashboard
      initialTransactions={(txRes.data as RawTransaction[]) ?? []}
      initialWithdrawals={(wdRes.data as RawWithdrawal[]) ?? []}
      limitReached={limitReached}
    />
  )
}
