import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import webpush, { PushSubscription, WebPushError } from 'web-push';

const DATA_DIR = join(homedir(), '.local/share/gitmob');
const KEYS_PATH = join(DATA_DIR, 'vapid.json');
const DEVICES_PATH = join(DATA_DIR, 'notification-devices.json');
const EVENTS_PATH = join(DATA_DIR, 'notification-events.jsonl');

/**
 * VAPID identifies this server to the push service, which requires a mailto: or https: URL.
 * The repo, so nothing personal rides along to Google.
 */
const VAPID_SUBJECT = 'https://github.com/reed1/gitmob';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export interface Device {
  subscription: PushSubscription;
  label: string;
  createdAt: number;
  /**
   * Identifies the browser storage the subscription was minted from, not the subscription. Two
   * rows carrying the same one are the same install re-subscribing; two different ones mean the
   * origin's storage was wiped in between, which is the difference between Chrome dropping a
   * subscription and Chrome dropping everything.
   */
  installId: string | null;
}

/**
 * Every subscription that arrives, leaves or cannot be reached, appended to
 * `notification-events.jsonl`. A subscription dies while nobody is looking: without a timestamped
 * trail there is no way to tell an endpoint the push service expired from one this app deleted,
 * or to bound when it happened.
 */
export function logEvent(event: string, detail: Record<string, unknown>) {
  mkdirSync(DATA_DIR, { recursive: true });
  appendFileSync(
    EVENTS_PATH,
    JSON.stringify({ at: new Date().toISOString(), event, ...detail }) + '\n',
    { mode: 0o600 }
  );
}

/** The last 12 characters of an endpoint: enough to tell two of them apart in a log or on screen. */
export function endpointTail(endpoint: string): string {
  return endpoint.slice(-12);
}

let cachedKeys: VapidKeys | null = null;

/** Generated on first use rather than configured: one less thing to set up before it works. */
function vapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;

  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(KEYS_PATH)) {
    writeFileSync(
      KEYS_PATH,
      JSON.stringify(webpush.generateVAPIDKeys(), null, 2),
      { mode: 0o600 }
    );
  }
  cachedKeys = JSON.parse(readFileSync(KEYS_PATH, 'utf-8'));
  return cachedKeys!;
}

export function publicKey(): string {
  return vapidKeys().publicKey;
}

export function readDevices(): Device[] {
  if (!existsSync(DEVICES_PATH)) return [];
  return JSON.parse(readFileSync(DEVICES_PATH, 'utf-8'));
}

function writeDevices(devices: Device[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DEVICES_PATH, JSON.stringify(devices, null, 2), {
    mode: 0o600,
  });
}

/** One entry per browser install: re-subscribing the same device replaces its row. */
export function addDevice(
  subscription: PushSubscription,
  label: string,
  installId: string | null
) {
  const others = readDevices().filter(
    (d) => d.subscription.endpoint !== subscription.endpoint
  );
  writeDevices([
    ...others,
    { subscription, label, createdAt: Date.now(), installId },
  ]);
  logEvent('subscribed', {
    label,
    installId,
    endpoint: endpointTail(subscription.endpoint),
    expirationTime: subscription.expirationTime ?? null,
    devicesNow: others.length + 1,
  });
}

/**
 * Swaps in the endpoint a browser rotated to, keeping the row's label and age: this is the same
 * device carrying on, not a new one enrolling.
 */
export function replaceDevice(
  oldEndpoint: string,
  subscription: PushSubscription
) {
  const devices = readDevices();
  const previous = devices.find((d) => d.subscription.endpoint === oldEndpoint);
  const others = devices.filter(
    (d) =>
      d.subscription.endpoint !== oldEndpoint &&
      d.subscription.endpoint !== subscription.endpoint
  );
  writeDevices([
    ...others,
    {
      subscription,
      label: previous?.label ?? 'Unnamed device',
      createdAt: previous?.createdAt ?? Date.now(),
      installId: previous?.installId ?? null,
    },
  ]);
  logEvent('rotated', {
    label: previous?.label ?? 'Unnamed device',
    installId: previous?.installId ?? null,
    from: endpointTail(oldEndpoint),
    to: endpointTail(subscription.endpoint),
    matchedKnownRow: previous !== undefined,
  });
}

export function removeDevice(endpoint: string, reason: string) {
  const devices = readDevices();
  const going = devices.find((d) => d.subscription.endpoint === endpoint);
  writeDevices(devices.filter((d) => d.subscription.endpoint !== endpoint));
  logEvent('removed', {
    reason,
    label: going?.label ?? null,
    installId: going?.installId ?? null,
    endpoint: endpointTail(endpoint),
    matchedKnownRow: going !== undefined,
  });
}

export interface Notification {
  title: string;
  body: string;
  /** Where a tap lands. Relative to the app's origin. */
  url?: string;
  /** Replaces an earlier notification carrying the same tag instead of stacking. */
  tag?: string;
}

/** What became of one device in a fan-out. `gone` means the push service disowned it. */
export interface Delivery {
  label: string;
  status: 'delivered' | 'gone' | 'failed';
}

/**
 * Fans a notification out to every subscribed device. Never rejects: this is called from a
 * detached job's exit handler, where a rejection would take the server down with it. Callers
 * that have someone to report to read the outcome off the return value instead.
 */
export async function sendNotification(
  notification: Notification
): Promise<Delivery[]> {
  const devices = readDevices();
  if (devices.length === 0) {
    console.warn('[notifications] nothing sent: no device is subscribed');
    return [];
  }

  const { publicKey, privateKey } = vapidKeys();
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);

  const payload = JSON.stringify(notification);

  const deliveries = await Promise.all(
    devices.map(async (device): Promise<Delivery> => {
      const trail = {
        label: device.label,
        installId: device.installId,
        endpoint: endpointTail(device.subscription.endpoint),
        enrolledAt: new Date(device.createdAt).toISOString(),
      };
      try {
        await webpush.sendNotification(device.subscription, payload, {
          TTL: 6 * 60 * 60,
          urgency: 'high',
        });
        logEvent('delivered', { ...trail, title: notification.title });
        return { label: device.label, status: 'delivered' };
      } catch (err) {
        const statusCode = err instanceof WebPushError ? err.statusCode : null;
        // 404/410 is the push service saying this subscription is dead — the browser was
        // uninstalled or reset it. Anything else is transient and the message is simply lost.
        if (statusCode === 404 || statusCode === 410) {
          logEvent('gone', {
            ...trail,
            statusCode,
            body: err instanceof WebPushError ? err.body?.trim() : null,
          });
          return { label: device.label, status: 'gone' };
        }
        console.error(`[notifications] ${device.label}:`, err);
        logEvent('failed', {
          ...trail,
          statusCode,
          error: err instanceof Error ? err.message : String(err),
        });
        return { label: device.label, status: 'failed' };
      }
    })
  );

  const gone = devices.filter((_, i) => deliveries[i].status === 'gone');
  if (gone.length > 0) {
    // Said out loud, because a device disappearing off the list on its own is otherwise
    // indistinguishable from one that was never enrolled.
    console.warn(
      `[notifications] dropped ${gone.length} dead subscription(s): ${gone
        .map((d) => d.label)
        .join(', ')}`
    );
    for (const device of gone) {
      removeDevice(device.subscription.endpoint, 'pruned-after-410');
    }
  }

  return deliveries;
}
