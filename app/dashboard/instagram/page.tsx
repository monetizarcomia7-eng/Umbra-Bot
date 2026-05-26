import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InstagramClient from './InstagramClient'

export interface RawIgAccount {
  id:               string
  ig_user_id:       string
  username:         string | null
  profile_picture:  string | null
  token_expires_at: string | null
  is_active:        boolean
  created_at:       string
}

export interface RawIgPost {
  id:           string
  account_id:   string
  media_type:   'IMAGE' | 'REELS' | 'CAROUSEL'
  media_urls:   string[]
  caption:      string
  scheduled_at: string
  status:       string
  ig_post_id:   string | null
  published_at: string | null
  error_msg:    string | null
  retry_count:  number
  created_at:   string
  updated_at:   string
}

export interface IgStats {
  accounts_count:  number
  scheduled_count: number
  published_30d:   number
  failed_30d:      number
}

interface SearchParams {
  success?: string
  error?:   string
  count?:   string
}

export default async function InstagramPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [accountsRes, postsRes, statsRes] = await Promise.all([
    supabase
      .from('instagram_accounts')
      .select('id, ig_user_id, username, profile_picture, token_expires_at, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('instagram_posts')
      .select('id, account_id, media_type, media_urls, caption, scheduled_at, status, ig_post_id, published_at, error_msg, retry_count, created_at, updated_at')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: false })
      .limit(100),
    supabase.rpc('instagram_stats', { p_user_id: user.id }),
  ])

  const stats = (statsRes.data ?? {
    accounts_count:  0,
    scheduled_count: 0,
    published_30d:   0,
    failed_30d:      0,
  }) as IgStats

  return (
    <InstagramClient
      initialAccounts={(accountsRes.data ?? []) as RawIgAccount[]}
      initialPosts={(postsRes.data ?? []) as RawIgPost[]}
      initialStats={stats}
      userId={user.id}
      hasMetaConfig={!!process.env.META_APP_ID}
      oauthFeedback={{
        success: sp.success ?? null,
        error:   sp.error ?? null,
        count:   sp.count ? Number(sp.count) : null,
      }}
    />
  )
}
