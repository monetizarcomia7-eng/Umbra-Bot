/**
 * Rate limiter com dois backends:
 *  - Upstash Redis (produção) — distribuído, funciona em multi-instância serverless
 *  - Map em memória (dev local) — quando UPSTASH_REDIS_REST_URL não está configurado
 *
 * Para produção: crie um banco Redis no https://console.upstash.com (plano grátis)
 * e adicione UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN ao .env.
 */

import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  retryAfterMs: number
}

// ─── Backend Redis (Upstash) ──────────────────────────────────────────────────

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!redis) {
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

async function rateLimitRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const client = getRedis()!
  const windowSec = Math.ceil(windowMs / 1000)

  // Script Lua atômico: INCR + EXPIRE (só no primeiro) + TTL — 1 round-trip.
  // Evita a race condition de 3 round-trips separados onde um INCR concorrente
  // podia retornar 1 antes do EXPIRE ser chamado, deixando a chave sem TTL.
  const result = (await client.eval(
    `local c = redis.call('INCR', KEYS[1])
     if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
     return {c, redis.call('TTL', KEYS[1])}`,
    [key],
    [windowSec],
  )) as [number, number]

  const count  = result[0]
  const ttl    = result[1]
  const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs)

  if (count > limit) {
    return { ok: false, remaining: 0, resetAt, retryAfterMs: ttl > 0 ? ttl * 1000 : windowMs }
  }

  return { ok: true, remaining: limit - count, resetAt, retryAfterMs: 0 }
}

// ─── Backend em memória (fallback local) ─────────────────────────────────────

interface MemEntry { count: number; resetAt: number }

const memStore = new Map<string, MemEntry>()

// Cleanup de entradas expiradas a cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, e] of memStore) {
      if (e.resetAt < now) memStore.delete(k)
    }
  }, 5 * 60 * 1000)
}

function rateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs
    memStore.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt, retryAfterMs: 0 }
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt, retryAfterMs: 0 }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * @param key      Chave única (ex: `pix:${userId}` ou `ip:${ip}:register`)
 * @param limit    Máximo de requisições na janela
 * @param windowMs Janela em milissegundos
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (getRedis()) {
    return rateLimitRedis(key, limit, windowMs)
  }
  return rateLimitMemory(key, limit, windowMs)
}

/** Extrai o IP do cliente dos headers do Next.js */
export function getIp(request: Request): string {
  const h = request.headers
  return h.get('x-forwarded-for')?.split(',')[0].trim() ?? h.get('x-real-ip') ?? 'unknown'
}
