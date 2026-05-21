import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { GatewaysClient } from './GatewaysClient'

export interface RawGateway {
  id: string
  name: string
  connected: boolean
  account: string | null
  account_id: string | null
  provider: string | null
  status: string
  updated_at: string
  processed_volume: number
  processed_tx: number
}

export interface RawBankAccount {
  id: string
  label: string
  kind: string
}

export type GatewayStats = Record<string, {
  volume_30d: number
  tx_30d:     number
  avg_fee_pct:number
}>

export default async function GatewaysPage({
  searchParams,
}: {
  searchParams: Promise<{ mp_connected?: string; mp_error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const [gatewaysRes, bankAccountsRes, statsRes] = await Promise.all([
    supabase
      .from('gateways')
      .select('id, name, connected, account, account_id, provider, status, updated_at, processed_volume, processed_tx')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),

    supabase
      .from('bank_accounts')
      .select('id, label, kind')
      .eq('user_id', user.id)
      .order('created_at'),

    supabase.rpc('gateways_stats', { p_user_id: user.id }),
  ])

  return (
    <DashboardLayout>
      <GatewaysClient
        initialGateways={(gatewaysRes.data ?? []) as RawGateway[]}
        bankAccounts={(bankAccountsRes.data ?? []) as RawBankAccount[]}
        gatewayStats={((statsRes.data ?? {}) as GatewayStats)}
        userId={user.id}
        hasMpOAuth={!!process.env.MERCADOPAGO_CLIENT_ID}
        mpConnected={params.mp_connected === '1'}
        mpError={params.mp_error ?? null}
      />
    </DashboardLayout>
  )
}
