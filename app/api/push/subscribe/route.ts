import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/push/subscribe
// Body: { subscription: PushSubscriptionJSON }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { subscription?: unknown }
  try { body = await request.json() } catch { body = {} }

  const sub = body.subscription
  if (!sub || typeof sub !== 'object') {
    return NextResponse.json({ error: 'subscription required' }, { status: 400 })
  }

  await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, subscription: sub },
      { onConflict: 'user_id' },
    )

  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe — unsubscribe
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
