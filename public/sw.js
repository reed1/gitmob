// No caching. GitMob shows live git/process state, so every fetch goes to the network —
// a stale response here would be indistinguishable from current truth. The worker exists
// to make the app installable and to receive push notifications.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  // Chrome revokes push permission from a worker that receives a message and shows nothing,
  // so an unreadable payload still has to surface something.
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'GitMob', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url ?? '/app' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/app';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const open = clients.find((client) => 'focus' in client);
        if (open) {
          open.navigate(url);
          return open.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
