/* Umbra Bot — Web Push Service Worker */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  if (!e.data) return

  let payload
  try { payload = e.data.json() } catch { payload = { title: 'Umbra Bot', body: e.data.text() } }

  const { title = 'Umbra Bot', body = '', icon = '/favicon.ico', url = '/dashboard' } = payload

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/favicon.ico',
      data: { url },
      vibrate: [200, 100, 200],
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = e.notification.data?.url ?? '/dashboard'
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const found = clients.find((c) => c.url.includes(target))
      if (found) { found.focus(); return }
      return self.clients.openWindow(target)
    }),
  )
})
