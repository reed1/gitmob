import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import webpush, { PushSubscription, WebPushError } from 'web-push';

const DATA_DIR = join(homedir(), '.local/share/gitmob');
const KEYS_PATH = join(DATA_DIR, 'vapid.json');
const DEVICES_PATH = join(DATA_DIR, 'notification-devices.json');

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
export function addDevice(subscription: PushSubscription, label: string) {
  const others = readDevices().filter(
    (d) => d.subscription.endpoint !== subscription.endpoint
  );
  writeDevices([...others, { subscription, label, createdAt: Date.now() }]);
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
    },
  ]);
}

export function removeDevice(endpoint: string) {
  writeDevices(
    readDevices().filter((d) => d.subscription.endpoint !== endpoint)
  );
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
      try {
        await webpush.sendNotification(device.subscription, payload, {
          TTL: 6 * 60 * 60,
          urgency: 'high',
        });
        return { label: device.label, status: 'delivered' };
      } catch (err) {
        // 404/410 is the push service saying this subscription is dead — the browser was
        // uninstalled or reset it. Anything else is transient and the message is simply lost.
        if (
          err instanceof WebPushError &&
          (err.statusCode === 404 || err.statusCode === 410)
        ) {
          return { label: device.label, status: 'gone' };
        }
        console.error(`[notifications] ${device.label}:`, err);
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
    const dead = new Set(gone.map((d) => d.subscription.endpoint));
    writeDevices(
      readDevices().filter((d) => !dead.has(d.subscription.endpoint))
    );
  }

  return deliveries;
}
