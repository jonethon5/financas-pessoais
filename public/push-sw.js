// Notificações push (avisos do app). Carregado pelo service worker gerado pelo vite-plugin-pwa.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Poupei', {
      body: data.body || '',
      // O rosto do porquinho muda com o aviso (feliz, preocupado, com saudade…); sem ele, o ícone do app
      icon: data.icon || 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      tag: data.tag,
      // Um aviso novo do mesmo tipo substitui o anterior, mas ainda vibra
      renotify: Boolean(data.tag),
      data: { url: data.url || './' },
    }),
  )
})

// Tocar na notificação abre (ou traz para frente) o app, já na tela do aviso
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => undefined)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
