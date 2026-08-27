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

// Chrome fires this when it invalidates or rotates a subscription — after the PWA is
// uninstalled, or when the push service expires one. Without re-subscribing here the device
// falls off the server's list and only a manual Enable ever brings it back.
//
// decodeKey duplicates the one in src/lib/notifications-client.ts: this file is served straight
// out of public/, so there is nothing here to import it with.
function decodeKey(base64Url) {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const { publicKey } = await res.json();

      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      });

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          replaces: event.oldSubscription?.endpoint ?? null,
        }),
      });
    })()
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
