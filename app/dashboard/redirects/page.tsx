import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RedirectsClient } from './RedirectsClient'

export default async function RedirectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line react-hooks/purity
  const sixtyDaysAgo  = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const [redirectsRes, currRes, prevRes, currUniqueRes] = await Promise.all([
    supabase
      .from('redirects')
      .select('id, slug, destination, destination_label, clicks, unique_clicks, status, cloaking, decoy_url, utm, redirect_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('redirect_click_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('clicked_at', thirtyDaysAgo),
    supabase
      .from('redirect_click_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('clicked_at', sixtyDaysAgo)
      .lt('clicked_at', thirtyDaysAgo),
    // Cliques únicos (30d): contagem de ip_hash distintos via RPC
    supabase.rpc('redirect_unique_clicks_30d', { p_user_id: user.id }),
  ])

  const initialRedirects = redirectsRes.data ?? []
  const currClicks  = currRes.count ?? 0
  const prevClicks  = prevRes.count ?? 0
  const currUnique  = (currUniqueRes.data as number | null) ?? 0

  const clicksDelta =
    prevClicks > 0
      ? Math.round(((currClicks - prevClicks) / prevClicks) * 1000) / 10
      : null

  return (
    <RedirectsClient
      initialRedirects={initialRedirects as Parameters<typeof RedirectsClient>[0]['initialRedirects']}
      userId={user.id}
      appUrl={process.env.APP_URL ?? 'https://umbra.bot'}
      currClicks={currClicks}
      currUnique={currUnique}
      clicksDelta={clicksDelta}
    />
  )
}
