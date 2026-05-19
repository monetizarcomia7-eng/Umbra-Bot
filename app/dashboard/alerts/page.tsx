import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AlertsClient, type RawAlert } from './AlertsClient'

// Server Component — faz SSR dos primeiros 50 alertas.
// Não há flash de mock: a lista chega pré-renderizada.
export default async function AlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Usuário'

  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <AlertsClient
      initialAlerts={(alerts ?? []) as RawAlert[]}
      userId={user.id}
      userName={userName}
    />
  )
}
