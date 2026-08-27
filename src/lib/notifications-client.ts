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

/**
 * Identifies this browser's storage, minted once and kept in localStorage. It is the one thing
 * that survives a subscription being replaced and does not survive the origin's storage being
 * cleared, so two device rows carrying the same one were enrolled by the same install.
 */
const INSTALL_ID_KEY = 'gitmob.notifications.install-id';

/** The endpoint this install last enrolled, to compare against what the server still holds. */
const LAST_ENROLLED_KEY = 'gitmob.notifications.last-enrolled';

interface LastEnrolled {
  endpoint: string;
  at: string;
}

/** Reads without minting: an absent id is itself the finding. */
export function readInstallId(): string | null {
  return localStorage.getItem(INSTALL_ID_KEY);
}

function installId(): string {
  const existing = readInstallId();
  if (existing !== null) return existing;
  const minted = crypto.randomUUID().slice(0, 8);
  localStorage.setItem(INSTALL_ID_KEY, minted);
  return minted;
}

export function readLastEnrolled(): LastEnrolled | null {
  const raw = localStorage.getItem(LAST_ENROLLED_KEY);
  return raw === null ? null : JSON.parse(raw);
}

/** The last 12 characters of an endpoint — matches how the server writes them to its log. */
export function endpointTail(endpoint: string | null): string | null {
  return endpoint === null ? null : endpoint.slice(-12);
}

/** Files what the browser saw into the server's trail, where the two can be read side by side. */
export function reportEvent(event: string, detail: Record<string, unknown>) {
  return fetch('/api/notifications/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, detail }),
  });
}

export interface DeviceState {
  permission: NotificationPermission;
  /** Whether a service worker registration existed. Read without creating one. */
  hasRegistration: boolean;
  registrationScope: string | null;
  hasSubscription: boolean;
  endpoint: string | null;
  expirationTime: number | null;
  installId: string | null;
  lastEnrolled: LastEnrolled | null;
  /** False means Chrome is free to evict this origin's storage, and the subscription with it. */
  storagePersisted: boolean | null;
  displayMode: 'standalone' | 'browser';
  path: string;
}

/**
 * Everything this browser knows about its own subscription, gathered without changing any of it:
 * `getRegistration` rather than `register`, and the install id read rather than minted. Calling
 * this must not repair what it is measuring.
 */
export async function deviceState(): Promise<DeviceState> {
  const reg = await existingRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;

  return {
    permission: Notification.permission,
    hasRegistration: reg !== undefined,
    registrationScope: reg?.scope ?? null,
    hasSubscription: sub !== null,
    endpoint: sub?.endpoint ?? null,
    expirationTime: sub?.expirationTime ?? null,
    installId: readInstallId(),
    lastEnrolled: readLastEnrolled(),
    storagePersisted: navigator.storage?.persisted
      ? await navigator.storage.persisted()
      : null,
    displayMode: window.matchMedia('(display-mode: standalone)').matches
      ? 'standalone'
      : 'browser',
    path: window.location.pathname,
  };
}

/**
 * Files this browser's state as it was found, before anything touches it. Every page of both
 * PWAs calls this on load: a subscription disappears while nobody is watching, and the only
 * bound on when it went is the last load that still saw it.
 */
export async function reportBootState(
  extra: Record<string, unknown> = {}
): Promise<DeviceState | null> {
  if (!pushSupported()) return null;

  const state = await deviceState();
  const lastEndpoint = state.lastEnrolled?.endpoint ?? null;

  await reportEvent('boot-state', {
    ...state,
    endpoint: endpointTail(state.endpoint),
    lastEnrolled:
      state.lastEnrolled === null
        ? null
        : {
            endpoint: endpointTail(state.lastEnrolled.endpoint),
            at: state.lastEnrolled.at,
          },
    ok:
      state.permission === 'granted' &&
      state.hasRegistration &&
      state.hasSubscription &&
      state.endpoint === lastEndpoint,
    ...extra,
  });

  return state;
}

let booted: Promise<DeviceState | null> | null = null;

/**
 * The state as this page load found it, captured once and shared. Whoever asks first captures it,
 * so it is read before GlobalUI registers the worker — and the Notifications page can show what
 * was actually there on open rather than what looking has since created.
 */
export function bootStateOnce(): Promise<DeviceState | null> {
  booted ??= reportBootState();
  return booted;
}

/**
 * Asks Chrome not to evict this origin's storage. Eviction takes the service worker registration
 * with it, and the push subscription with that — one of the few ways a subscription can disappear
 * that the page can actually ask not to happen. Chrome decides silently (an installed app is
 * usually granted it); the answer goes into the trail either way.
 */
async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  return navigator.storage.persist();
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

/** Creates the registration if there is none. Only enrolling has a reason to. */
async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js');
}

/**
 * Reads the registration without creating one. Every read goes through this: a page that
 * registers on the way to asking a question destroys the answer, and "was there a registration
 * left at all" is the question.
 */
async function existingRegistration(): Promise<
  ServiceWorkerRegistration | undefined
> {
  return navigator.serviceWorker.getRegistration('/');
}

export async function currentEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await existingRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub?.endpoint ?? null;
}

/**
 * Whether this browser is set up to receive notifications. Local only — a permission read and
 * the browser's own subscription record, no network — so it is cheap enough to run on mount.
 * A browser that cannot do push at all does not "need setup": there is nothing to offer it.
 */
export async function needsNotificationSetup(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== 'granted') return true;
  return (await currentEndpoint()) === null;
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

  // A subscription minted before the browser's push registration was torn down — by a PWA
  // uninstall, or by the push service expiring it — is handed straight back by subscribe(),
  // dead endpoint and all, so re-enabling would re-register the same corpse forever. Clear
  // whatever is on record first and take a fresh one.
  await unsubscribeThisDevice('replaced-by-fresh-subscribe');

  const sub = await (
    await registration()
  ).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey),
  });

  const persisted = await requestPersistentStorage();

  const saved = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      label: deviceLabel(),
      installId: installId(),
    }),
  });
  if (!saved.ok)
    return { ok: false, reason: 'Server rejected the subscription' };

  localStorage.setItem(
    LAST_ENROLLED_KEY,
    JSON.stringify({ endpoint: sub.endpoint, at: new Date().toISOString() })
  );
  await reportBootState({
    moment: 'just-enrolled',
    storagePersistRequested: persisted,
  });

  return { ok: true };
}

export async function unsubscribeThisDevice(reason: string) {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await fetch(
    `/api/notifications?endpoint=${encodeURIComponent(sub.endpoint)}&reason=${reason}`,
    { method: 'DELETE' }
  );
  await sub.unsubscribe();
}
