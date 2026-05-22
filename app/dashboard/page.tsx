import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { DashboardClient } from './_components/DashboardClient'

// Server Component — busca os KPIs iniciais no servidor (período padrão 30d).
// Elimina o flash de skeleton e o fetch client-side na primeira carga.
export default async function DashboardPage() {
  const supabase = await createClient()

  // eslint-disable-next-line react-hooks/purity
  const now        = Date.now()
  const since30d   = new Date(now - 30 * 86_400_000).toISOString()
  const prevSince  = new Date(now - 60 * 86_400_000).toISOString()

  const [txRes, activeBotsRes, allBotsRes, prevTxRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, net, created_at, product_name')
      .eq('status', 'approved')
      .gte('created_at', since30d),
    supabase
      .from('bots')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('bots')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('transactions')
      .select('net, amount')
      .eq('status', 'approved')
      .gte('created_at', prevSince)
      .lt('created_at', since30d),
  ])

  return (
    <DashboardLayout>
      <DashboardClient
        transactions={txRes.data ?? []}
        prevTransactions={prevTxRes.data ?? []}
        botsActiveCount={activeBotsRes.count ?? 0}
        botsTotalCount={allBotsRes.count ?? 0}
      />
    </DashboardLayout>
  )
}
