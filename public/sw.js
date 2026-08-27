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

// The trail in ~/.local/share/gitmob/notification-events.jsonl is the only place a worker can
// say anything: there is no console anyone will be watching when a subscription dies. Failures
// to report are swallowed — a push event that rejects counts against this origin's standing with
// Chrome, and there is nothing useful to do about a log line that did not land.
function report(event, detail) {
  return fetch('/api/notifications/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, detail }),
  }).catch(() => {});
}

function tail(endpoint) {
  return endpoint ? endpoint.slice(-12) : null;
}

self.addEventListener('push', (event) => {
  // Chrome revokes push permission from a worker that receives a message and shows nothing,
  // so an unreadable payload still has to surface something.
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title ?? 'GitMob', {
        body: data.body ?? '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag,
        data: { url: data.url ?? '/app' },
      }),
      // Proof the subscription was alive at this moment, from the receiving end.
      report('push-received', { title: data.title ?? null, tag: data.tag ?? null }),
    ])
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
      const oldEndpoint = event.oldSubscription?.endpoint ?? null;
      // Reported before anything is attempted, because whether Chrome fires this event at all is
      // the open question: a subscription that dies without one leaves this line missing.
      await report('subscription-change', {
        old: tail(oldEndpoint),
        new: tail(event.newSubscription?.endpoint ?? null),
      });

      const res = await fetch('/api/notifications');
      if (!res.ok) {
        await report('subscription-change-failed', {
          stage: 'read-key',
          status: res.status,
        });
        return;
      }
      const { publicKey } = await res.json();

      let sub;
      try {
        sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey),
        });
      } catch (err) {
        await report('subscription-change-failed', {
          stage: 'subscribe',
          error: String(err),
        });
        throw err;
      }

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          replaces: oldEndpoint,
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
