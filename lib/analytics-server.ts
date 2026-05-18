/**
 * Server-side PostHog event capture.
 * Uses the PostHog /capture REST endpoint directly — no extra package needed.
 * Failures are silently swallowed so analytics never breaks the main flow.
 */
export async function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

  await fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      distinct_id: distinctId,
      event,
      properties: { ...properties, $lib: 'umbra-server' },
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {})
}
