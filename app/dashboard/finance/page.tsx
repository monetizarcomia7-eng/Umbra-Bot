import { createClient } from '@/lib/supabase/server'
import { FinanceDashboard } from '@/components/dashboard/finance/FinanceDashboard'
import type {
  RawTransaction, RawWithdrawal, RawFinanceBot, RawFinanceFlow, RawInvoice, RawFinanceSummary,
} from '@/components/dashboard/finance/types'

const TX_LIMIT = 500
const WD_LIMIT = 200

export default async function FinancePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const uid = user.id

  const [txRes, wdRes, botsRes, flowsRes, invRes, summaryRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, net, fee, status, type, product_name, customer_name, customer_email, gateway, bot_id, flow_id, utm_source, utm_campaign, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(TX_LIMIT),
    supabase
      .from('withdrawals')
      .select('id, amount, account_id, account_label, status, created_at, concluded_at, notes')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(WD_LIMIT),
    supabase
      .from('bots')
      .select('id, name, username')
      .eq('user_id', uid),
    supabase
      .from('flows')
      .select('id, name')
      .eq('user_id', uid)
      .limit(100),
    supabase
      .from('invoices')
      .select('id, period, value, due_date, status, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(24),
    supabase.rpc('finance_summary', { p_user_id: uid }),
  ])

  const limitReached = (txRes.data?.length ?? 0) >= TX_LIMIT

  return (
    <FinanceDashboard
      initialTransactions={(txRes.data  as unknown as RawTransaction[])  ?? []}
      initialWithdrawals={(wdRes.data   as unknown as RawWithdrawal[])   ?? []}
      initialBots={(botsRes.data        as unknown as RawFinanceBot[])   ?? []}
      initialFlows={(flowsRes.data      as unknown as RawFinanceFlow[])  ?? []}
      initialInvoices={(invRes.data     as unknown as RawInvoice[])      ?? []}
      initialSummary={(summaryRes.data  as unknown as RawFinanceSummary) ?? null}
      limitReached={limitReached}
    />
  )
}
