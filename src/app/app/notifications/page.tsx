'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToast, apiFetch } from '../../../lib/api';
import { useAutoRefresh } from '../../../lib/use-auto-refresh';
import {
  currentEndpoint,
  pushSupported,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '../../../lib/notifications-client';

interface DeviceRow {
  endpoint: string;
  label: string;
  createdAt: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications');
    const data = res.ok ? await res.json() : null;
    const endpoint = await currentEndpoint();
    if (data) setDevices(data.devices);
    setSupported(pushSupported());
    setThisEndpoint(endpoint);
    setLoading(false);
  }, []);

  useAutoRefresh(load);

  const subscribed =
    thisEndpoint !== null && devices.some((d) => d.endpoint === thisEndpoint);

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
    await unsubscribeThisDevice();
    await load();
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    const res = await apiFetch('/api/notifications/test', { method: 'POST' });
    if (res.ok) addToast('Test notification sent', 'success');
    setBusy(false);
  }

  async function forget(endpoint: string) {
    await apiFetch(
      `/api/notifications?endpoint=${encodeURIComponent(endpoint)}`,
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
          </>
        )}
      </main>
    </div>
  );
}
