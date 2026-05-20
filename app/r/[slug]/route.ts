import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

interface AffiliateResult {
  found: boolean
  affiliate_id?: string
  cookie_window?: number
  redirect_url?: string
}

function hashIp(ip: string): string {
  if (!ip) return 'unknown'
  return createHash('sha256').update('umbra:' + ip).digest('hex').slice(0, 16)
}

function detectDevice(ua: string): 'mobile' | 'desktop' | 'tablet' | 'bot' | 'unknown' {
  if (/bot|crawl|spider|facebookexternalhit|linkedinbot|twitterbot|bingbot|googlebot|slurp|duckduckbot|ia_archiver/i.test(ua)) return 'bot'
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|windows phone|opera mini/i.test(ua)) return 'mobile'
  if (/windows|macintosh|linux|x11|cros/i.test(ua)) return 'desktop'
  return 'unknown'
}

function parseReferrer(referer: string): string {
  if (!referer) return ''
  try {
    return new URL(referer).hostname
  } catch {
    return ''
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const appUrl = process.env.APP_URL ?? 'https://umbra.bot'

  // ── 1. Tenta link de afiliado primeiro ──────────────────────────────────────
  const supabase = await createClient()
  const { data: affiliateData } = await supabase.rpc('track_affiliate_click', { p_slug: slug })
  const affiliateResult = affiliateData as AffiliateResult | null

  if (affiliateResult?.found && affiliateResult?.affiliate_id) {
    const destination = affiliateResult.redirect_url || appUrl
    const res = NextResponse.redirect(destination)
    const maxAge = (affiliateResult.cookie_window ?? 30) * 24 * 60 * 60
    res.cookies.set('umbra_aff', affiliateResult.affiliate_id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  }

  // ── 2. Tenta redirecionador ──────────────────────────────────────────────────
  const ua = req.headers.get('user-agent') ?? ''
  const deviceType = detectDevice(ua)

  const admin = createAdminClient()
  const { data: redirect } = await admin
    .from('redirects')
    .select('id, destination, decoy_url, cloaking, redirect_type')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (redirect) {
    const isBot = deviceType === 'bot'
    // Se cloaking ativo mas decoy_url ausente, bots recebem appUrl (nunca o destino real)
    const target =
      redirect.cloaking && isBot
        ? (redirect.decoy_url || appUrl)
        : redirect.destination

    const forwarded = req.headers.get('x-forwarded-for')
    const rawIp = forwarded
      ? forwarded.split(',')[0].trim()
      : (req.headers.get('x-real-ip') ?? '')
    const ipHash   = hashIp(rawIp)
    const referrer = parseReferrer(req.headers.get('referer') ?? '')

    // Rastreia clique e incrementa contadores (aguarda para confiabilidade em serverless)
    await admin.rpc('record_redirect_click', {
      p_redirect_id: redirect.id,
      p_ip_hash:     ipHash,
      p_referrer:    referrer,
      p_device_type: deviceType,
    })

    const statusCode = redirect.redirect_type === '301' ? 301 : 302
    return NextResponse.redirect(target, { status: statusCode })
  }

  // ── 3. Não encontrado ────────────────────────────────────────────────────────
  return NextResponse.redirect(appUrl)
}
