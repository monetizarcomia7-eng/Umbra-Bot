import { createClient } from '@/lib/supabase/server'
import AccountSettings from '@/components/instagram/settings/AccountSettings'
import type { RawIgAccount } from '../page'

export default async function InstagramSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: accountsData } = await supabase
    .from('instagram_accounts')
    .select('id, ig_user_id, username, profile_picture, token_expires_at, is_active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const hasMetaConfig = !!(process.env.META_APP_ID && process.env.META_APP_SECRET)
  const cronSecretConfigured = !!process.env.CRON_SECRET

  return (
    <AccountSettings
      accounts={(accountsData ?? []) as RawIgAccount[]}
      hasMetaConfig={hasMetaConfig}
      cronSecretConfigured={cronSecretConfigured}
    />
  )
}
