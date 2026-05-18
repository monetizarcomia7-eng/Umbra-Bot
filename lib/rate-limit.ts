/**
 * Simple in-memory rate limiter.
 * Works per serverless instance (warm pool). Good enough for basic abuse
 * protection — for strict production limits use Upstash Redis.
 */

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

// Cleanup stale entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  retryAfterMs: number
}

/**
 * @param key     Unique key (e.g. `ip:${ip}:register` or `user:${uid}:send`)
 * @param limit   Max requests in the window
 * @param windowMs Time window in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt, retryAfterMs: 0 }
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt, retryAfterMs: 0 }
}

/** Returns client IP from Next.js request headers. */
export function getIp(request: Request): string {
  const headers = request instanceof Request ? request.headers : (request as { headers: Headers }).headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
