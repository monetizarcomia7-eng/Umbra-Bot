import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptchaToken } from '@/lib/recaptcha'
import { NextRequest, NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`aff-apply:${ip}`, 10, 3_600_000)
  if (!rl.ok) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { userId, name, email, recaptcha_token } = body as {
    userId?: string; name?: string; email?: string; recaptcha_token?: string
  }

  if (recaptcha_token) {
    const captchaOk = await verifyRecaptchaToken(recaptcha_token)
    if (!captchaOk) {
      return NextResponse.json({ error: 'captcha_failed' }, { status: 400 })
    }
  }

  if (!userId || !name || !email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'invalid_program' }, { status: 400 })
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_affiliate_application', {
    p_user_id: userId,
    p_name:    name.trim(),
    p_email:   email.trim().toLowerCase(),
  })

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  const result = data as { success: boolean; error?: string } | null
  if (!result?.success) {
    const status = result?.error === 'already_applied' ? 409 : 400
    return NextResponse.json({ error: result?.error ?? 'unknown' }, { status })
  }

  return NextResponse.json({ success: true })
}
