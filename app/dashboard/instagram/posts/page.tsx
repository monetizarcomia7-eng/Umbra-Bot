import { createClient } from '@/lib/supabase/server'
import PostsClient from '@/components/instagram/posts/PostsClient'
import type { RawIgAccount, RawIgPost, IgStats } from '../page'

export default async function PostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [postsRes, accountsRes, statsRes] = await Promise.all([
    supabase
      .from('instagram_posts')
      .select('id, account_id, media_type, media_urls, caption, scheduled_at, status, ig_post_id, published_at, error_msg, retry_count, created_at, updated_at')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: false })
      .limit(200),
    supabase
      .from('instagram_accounts')
      .select('id, ig_user_id, username, profile_picture, token_expires_at, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('instagram_stats', { p_user_id: user.id }),
  ])

  return (
    <PostsClient
      initialPosts={(postsRes.data ?? []) as RawIgPost[]}
      accounts={(accountsRes.data ?? []) as RawIgAccount[]}
      stats={(statsRes.data ?? {
        accounts_count: 0, scheduled_count: 0, published_30d: 0, failed_30d: 0,
      }) as IgStats}
      userId={user.id}
    />
  )
}
