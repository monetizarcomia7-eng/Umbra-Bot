import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import AffiliatesClient, { type RawAffiliate, type RawPayment, type RawConfig } from './AffiliatesClient'

export const dynamic = 'force-dynamic'

const DEFAULT_CONFIG: RawConfig = {
  percentage: 30,
  attributionRule: 'last_click',
  cookieWindow: 30,
  upsellCommissions: true,
  recurringCommissions: false,
  autoPayment: false,
  minPayout: 100,
}

export default async function AffiliatesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const uid = user.id

  const [affiliatesRes, paymentsRes, configRes] = await Promise.all([
    supabase
      .from('affiliates')
      .select('id, name, email, slug, status, clicks, sales, commission, conversion_rate, payment_method, commission_pct, joined_at')
      .eq('user_id', uid)
      .order('commission', { ascending: false }),
    supabase
      .from('affiliate_payments')
      .select('id, affiliate_id, cycle, sales, amount, status, paid_at, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false }),
    supabase
      .from('affiliate_config')
      .select('*')
      .eq('user_id', uid)
      .single(),
  ])

  const config: RawConfig = configRes.data ? {
    percentage:           Number(configRes.data.percentage),
    attributionRule:      configRes.data.attribution_rule as 'first_click' | 'last_click',
    cookieWindow:         Number(configRes.data.cookie_window),
    upsellCommissions:    Boolean(configRes.data.upsell_commissions),
    recurringCommissions: Boolean(configRes.data.recurring_commissions),
    autoPayment:          Boolean(configRes.data.auto_payment),
    minPayout:            Number(configRes.data.min_payout),
  } : DEFAULT_CONFIG

  return (
    <DashboardLayout>
      <AffiliatesClient
        initialAffiliates={(affiliatesRes.data ?? []) as unknown as RawAffiliate[]}
        initialPayments={(paymentsRes.data ?? []) as unknown as RawPayment[]}
        initialConfig={config}
        userId={uid}
      />
    </DashboardLayout>
  )
}
