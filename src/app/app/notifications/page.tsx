'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToast, apiFetch } from '../../../lib/api';
import { useAutoRefresh } from '../../../lib/use-auto-refresh';
import {
  bootStateOnce,
  currentEndpoint,
  deviceState,
  DeviceState,
  endpointTail,
  pushSupported,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '../../../lib/notifications-client';

interface DeviceRow {
  endpoint: string;
  label: string;
  createdAt: number;
  installId: string | null;
}

function deviceCount(n: number): string {
  return `${n} device${n === 1 ? '' : 's'}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-foreground/50 shrink-0">{label}</span>
      <span className="text-xs font-mono text-right break-all">{value}</span>
    </div>
  );
}

function describeStorage(persisted: boolean | null): string {
  if (persisted === null) return 'not reported by this browser';
  return persisted ? 'persistent' : 'evictable';
}

function describeState(state: DeviceState): { label: string; value: string }[] {
  return [
    { label: 'Permission', value: state.permission },
    {
      label: 'Service worker',
      value: state.hasRegistration
        ? `registered · ${state.registrationScope}`
        : 'none',
    },
    {
      label: 'Push subscription',
      value: state.hasSubscription
        ? (endpointTail(state.endpoint) ?? '?')
        : 'none',
    },
    { label: 'Install id', value: state.installId ?? 'none on this storage' },
    {
      label: 'Last enrolled',
      value:
        state.lastEnrolled === null
          ? 'never, on this storage'
          : `${endpointTail(state.lastEnrolled.endpoint)} · ${new Date(
              state.lastEnrolled.at
            ).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}`,
    },
    { label: 'Storage', value: describeStorage(state.storagePersisted) },
    { label: 'Opened as', value: `${state.displayMode} · ${state.path}` },
  ];
}

export default function NotificationsPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [boot, setBoot] = useState<DeviceState | null>(null);
  const [now, setNow] = useState<DeviceState | null>(null);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // First, and before anything that could register a worker: what this page load found.
    setBoot(await bootStateOnce());

    const res = await fetch('/api/notifications');
    const data = res.ok ? await res.json() : null;
    const endpoint = await currentEndpoint();
    if (data) setDevices(data.devices);
    setSupported(pushSupported());
    setThisEndpoint(endpoint);
    setNow(pushSupported() ? await deviceState() : null);
    setLoading(false);
  }, []);

  useAutoRefresh(load);

  const subscribed =
    thisEndpoint !== null && devices.some((d) => d.endpoint === thisEndpoint);

  // Looking at this page registers a worker and can mint a subscription, so anything that moved
  // between opening it and now is the page's own doing and has to be labelled as such.
  const changedSinceOpen =
    boot === null || now === null
      ? null
      : [
          boot.hasRegistration !== now.hasRegistration
            ? `service worker ${now.hasRegistration ? 'appeared' : 'went'}`
            : null,
          boot.endpoint !== now.endpoint
            ? `subscription ${endpointTail(boot.endpoint) ?? 'none'} → ${endpointTail(now.endpoint) ?? 'none'}`
            : null,
          boot.permission !== now.permission
            ? `permission ${boot.permission} → ${now.permission}`
            : null,
        ]
          .filter((change) => change !== null)
          .join(', ') || null;

  async function enable() {
    setBusy(true);
    const result = await subscribeThisDevice();
    if (result.ok) {
      addToast('Notifications enabled on this device', 'success');
    } else {
      addToast(result.reason);
    }
    await load();
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    await unsubscribeThisDevice('disabled-by-user');
    await load();
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    const res = await apiFetch('/api/notifications/test', { method: 'POST' });
    // On a failure apiFetch has already raised the server's warning. On a success, say what was
    // reached — "sent" only ever meant the request left the page.
    if (res.ok) {
      const { delivered, gone, failed } = await res.json();
      const missed = gone + failed;
      addToast(
        missed === 0
          ? `Delivered to ${deviceCount(delivered)}`
          : `Delivered to ${deviceCount(delivered)}, ${missed} unreachable`,
        'success'
      );
    }
    // A send prunes the subscriptions the push service disowned, so the list below has moved.
    await load();
    setBusy(false);
  }

  async function forget(endpoint: string) {
    await apiFetch(
      `/api/notifications?endpoint=${encodeURIComponent(endpoint)}&reason=forgotten-in-ui`,
      { method: 'DELETE' }
    );
    await load();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/app')}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Notifications</h1>
            <div className="text-xs text-foreground/50 truncate">
              Job results, delivered to this app
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {loading ? (
          <div className="text-center text-foreground/50">Loading...</div>
        ) : !supported ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            This browser cannot receive push notifications. On iOS the app has
            to be added to the Home Screen first.
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-foreground/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">This device</div>
                  <div className="text-sm text-foreground/50">
                    {subscribed
                      ? 'Subscribed — job results arrive here'
                      : 'Not subscribed'}
                  </div>
                </div>
                <button
                  onClick={subscribed ? disable : enable}
                  disabled={busy}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium active:opacity-80 disabled:opacity-50 ${
                    subscribed
                      ? 'border border-foreground/20 text-foreground/70'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {subscribed ? 'Disable' : 'Enable'}
                </button>
              </div>
              {subscribed && (
                <button
                  onClick={sendTest}
                  disabled={busy}
                  className="w-full px-4 py-2 rounded-lg border border-foreground/20 text-sm active:opacity-80 disabled:opacity-50"
                >
                  Send a test notification
                </button>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-foreground/60 px-1">
                Subscribed devices
              </h2>
              {devices.length === 0 ? (
                <div className="text-sm text-foreground/50 px-1">
                  None yet. Job notifications go nowhere until one is enabled.
                </div>
              ) : (
                <div className="rounded-lg border border-foreground/10 divide-y divide-foreground/10">
                  {devices.map((device) => (
                    <div
                      key={device.endpoint}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                          {device.label}
                          {device.endpoint === thisEndpoint && (
                            <span className="ml-2 text-xs text-emerald-400">
                              this one
                            </span>
                          )}
                          {device.endpoint !== thisEndpoint &&
                            device.installId !== null &&
                            device.installId === boot?.installId && (
                              <span className="ml-2 text-xs text-amber-400">
                                same install
                              </span>
                            )}
                        </div>
                        <div className="text-xs font-mono text-foreground/40 truncate">
                          {device.installId ?? 'no install id'} ·{' '}
                          {endpointTail(device.endpoint)}
                        </div>
                        <div className="text-xs text-foreground/40">
                          {new Date(device.createdAt).toLocaleString(
                            undefined,
                            {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => forget(device.endpoint)}
                        className="shrink-0 text-xs text-foreground/50 hover:text-red-400 px-2 py-1"
                      >
                        Forget
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {boot !== null && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-foreground/60 px-1">
                  As this page load found it
                </h2>
                <div className="rounded-lg border border-foreground/10 px-4 py-2">
                  {describeState(boot).map((row) => (
                    <Detail key={row.label} {...row} />
                  ))}
                </div>
                {changedSinceOpen !== null && (
                  <div className="text-xs text-amber-400 px-1">
                    Changed since this page opened: {changedSinceOpen}
                  </div>
                )}
                <div className="text-xs text-foreground/40 px-1">
                  Read before the page registers anything, so a missing worker
                  reads as missing. The same lines, timestamped, are in
                  ~/.local/share/gitmob/notification-events.jsonl.
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
