/** The VAPID public key travels as base64url; `applicationServerKey` wants the raw bytes. */
function decodeKey(base64Url: string): ArrayBuffer {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /EdgA?\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const platform = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Mac OS X/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'device';
  return `${browser} on ${platform}`;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js');
}

export async function currentEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const sub = await (await registration()).pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/**
 * Asks for permission and registers this browser with the server. Returns the reason it
 * could not, so the caller can say which of the several no's this was.
 */
export async function subscribeThisDevice(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!pushSupported()) {
    return {
      ok: false,
      reason: 'This browser cannot receive push notifications',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    return {
      ok: false,
      reason:
        'Notifications are blocked for this site. Allow them in the browser site settings, then try again.',
    };
  }
  if (permission === 'default') {
    return { ok: false, reason: 'Permission dialog was dismissed' };
  }
  if (permission !== 'granted') {
    throw new Error(`Unexpected notification permission: ${permission}`);
  }

  const res = await fetch('/api/notifications');
  if (!res.ok) return { ok: false, reason: 'Could not read the server key' };
  const { publicKey } = await res.json();

  const sub = await (
    await registration()
  ).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey),
  });

  const saved = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), label: deviceLabel() }),
  });
  if (!saved.ok)
    return { ok: false, reason: 'Server rejected the subscription' };

  return { ok: true };
}

export async function unsubscribeThisDevice() {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await fetch(
    `/api/notifications?endpoint=${encodeURIComponent(sub.endpoint)}`,
    { method: 'DELETE' }
  );
  await sub.unsubscribe();
}
