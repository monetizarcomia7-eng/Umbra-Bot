import { createClient } from '@/lib/supabase/server'
import AccountsClient from '@/components/instagram/accounts/AccountsClient'
import type { RawIgAccount, IgStats } from '../page'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Auth guard já está no layout.tsx, aqui apenas obtém o user
  if (!user) return null

  const [accountsRes, statsRes] = await Promise.all([
    supabase
      .from('instagram_accounts')
      .select('id, ig_user_id, username, profile_picture, token_expires_at, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('instagram_stats', { p_user_id: user.id }),
  ])

  // Antes um erro aqui (ex.: tabela inexistente) virava lista vazia sem nenhum aviso.
  if (accountsRes.error) {
    console.error('[ig accounts page] select instagram_accounts failed', {
      code: accountsRes.error.code, message: accountsRes.error.message,
    })
  }

  return (
    <AccountsClient
      loadError={accountsRes.error ? (accountsRes.error.code || 'unknown') : null}
      initialAccounts={(accountsRes.data ?? []) as RawIgAccount[]}
      initialStats={(statsRes.data ?? {
        accounts_count: 0, scheduled_count: 0, published_30d: 0, failed_30d: 0,
      }) as IgStats}
      userId={user.id}
      hasMetaConfig={!!process.env.META_APP_ID}
    />
  )
}
