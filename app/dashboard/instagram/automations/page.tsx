import { createClient } from '@/lib/supabase/server'
import AutomationsClient, { type AutomationItem } from '@/components/instagram/automations/AutomationsClient'

export default async function AutomationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [autoRes, statsRes, accountsRes] = await Promise.all([
    supabase
      .from('instagram_automations')
      .select('id, account_id, name, media_id, media_label, keywords, match_type, reply_comment_text, dm_text, ' +
              'dm_button_label, final_text, final_buttons, require_follow, follow_text, follow_button_label, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('instagram_automation_stats', { p_user_id: user.id }),
    supabase
      .from('instagram_accounts')
      .select('id, username, ig_user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  if (autoRes.error) {
    console.error('[ig automations page] select failed', { code: autoRes.error.code, message: autoRes.error.message })
  }

  const stats = new Map<string, { sent: number; clicked: number; delivered: number; failed: number }>()
  for (const r of (statsRes.data ?? []) as Array<{
    automation_id: string; sent: number; clicked: number; delivered: number; failed: number
  }>) {
    stats.set(r.automation_id, {
      sent: Number(r.sent), clicked: Number(r.clicked), delivered: Number(r.delivered), failed: Number(r.failed),
    })
  }

  const items = ((autoRes.data ?? []) as unknown as Array<Omit<AutomationItem, 'stats'>>).map(a => ({
    ...a,
    stats: stats.get(a.id) ?? { sent: 0, clicked: 0, delivered: 0, failed: 0 },
  }))

  return (
    <AutomationsClient
      items={items}
      accounts={(accountsRes.data ?? []) as Array<{ id: string; username: string | null; ig_user_id: string }>}
      loadError={autoRes.error ? (autoRes.error.code || 'unknown') : null}
    />
  )
}
