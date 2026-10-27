// Pinboard and Checklist open offline: their page and everything it loads come from a cache
// first, and a fresh copy is fetched behind it for the next open. Their data is cached by the
// pages themselves (src/lib/use-cached-state.ts). GitMob caches nothing — it shows live git and
// process state, and a stale response there would be indistinguishable from current truth.
//
// The app is told apart by the first label of the hostname, as in src/lib/hosts.ts. A dev host
// names no app and caches nothing.
const OFFLINE_HOMES = { pinboard: '/pinboard', checklist: '/checklist' };
const offlineHome = OFFLINE_HOMES[self.location.hostname.split('.')[0]] ?? null;
const SHELL_CACHE = 'shell';

// Attributes only: the streamed RSC payload names the same assets too, but split across
// <script> chunks, which can cut a URL in two.
const ASSET =
  /(?:href|src)="(\/(?:_next\/static\/[^"]+|[^"/]+\.(?:webmanifest|png|ico)))"/g;

/**
 * Caches the home page together with every asset it names, and swaps the page in only once they
 * are all stored: a page whose chunks are missing would open offline to a blank screen. Hashed
 * assets are fetched once; icons and the manifest are not hashed, so they are fetched every time.
 * A changed page means a new build, and the assets only the old one used are dropped.
 */
async function cacheShell() {
  const page = await fetch(offlineHome, { cache: 'no-cache' });
  if (!page.ok) throw new Error(`${offlineHome} answered ${page.status}`);
  const html = await page.clone().text();

  const assets = new Set([...html.matchAll(ASSET)].map((m) => m[1]));
  const hashed = [...assets].filter((url) => url.startsWith('/_next/static/'));
  const unhashed = [...assets].filter((url) => !hashed.includes(url));
  const cache = await caches.open(SHELL_CACHE);

  await Promise.all([
    ...hashed.map(async (url) => {
      if ((await cache.match(url)) === undefined) await cache.add(url);
    }),
    ...unhashed.map((url) => cache.add(url)),
  ]);

  const previous = await cache.match(offlineHome);
  await cache.put(offlineHome, page);
  if (previous === undefined || (await previous.text()) === html) return;

  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path !== offlineHome && !assets.has(path)) {
      await cache.delete(request);
    }
  }
}

async function openHome(request) {
  const cached = await caches.match(offlineHome, { ignoreVary: true });
  return cached ?? fetch(request);
}

async function openAsset(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached !== undefined) return cached;

  const response = await fetch(request);
  if (
    response.ok &&
    new URL(request.url).pathname.startsWith('/_next/static/')
  ) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', (event) => {
  if (offlineHome !== null) event.waitUntil(cacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (offlineHome === null) return;
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.pathname === offlineHome) {
      event.respondWith(openHome(request));
      event.waitUntil(cacheShell());
    }
  } else if (
    url.pathname !== offlineHome &&
    !url.pathname.startsWith('/api/')
  ) {
    event.respondWith(openAsset(request));
  }
});

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
