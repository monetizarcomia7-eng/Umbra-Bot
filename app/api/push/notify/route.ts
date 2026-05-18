import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import { rateLimit } from '@/lib/rate-limit'

// Configure VAPID — set these env vars via `npx web-push generate-vapid-keys`
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'admin@umbra.bot'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
)

// POST /api/push/notify
// Body: { user_id?: string, title: string, body: string, url?: string }
// If user_id is omitted, notifies the authenticated user.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 30 push notifications per user per minute
  const rl = await rateLimit(`push:${user.id}`, 30, 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'muitas notificações, tente novamente em breve' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  let body: { user_id?: string; title?: string; body?: string; url?: string }
  try { body = await request.json() } catch { body = {} }

  const targetUserId = body.user_id ?? user.id
  const { data: row } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', targetUserId)
    .single()

  if (!row?.subscription) {
    return NextResponse.json({ error: 'no subscription found' }, { status: 404 })
  }

  const payload = JSON.stringify({
    title: body.title ?? 'Umbra Bot',
    body:  body.body  ?? '',
    url:   body.url   ?? '/dashboard',
    icon:  '/favicon.ico',
  })

  try {
    await webpush.sendNotification(
      row.subscription as webpush.PushSubscription,
      payload,
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const code = (err as { statusCode?: number }).statusCode
    if (code === 410) {
      // Subscription expired — clean up
      await supabase.from('push_subscriptions').delete().eq('user_id', targetUserId)
    }
    return NextResponse.json({ error: 'push failed' }, { status: 500 })
  }
}
