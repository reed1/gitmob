'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, dismissToast } from '../lib/api';
import type { ToastVariant } from '../lib/api';

const TOAST_STYLES: Record<
  ToastVariant,
  { accent: string; badge: string; icon: string }
> = {
  error: {
    accent: 'text-red-400',
    badge: 'bg-red-400/15',
    icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    accent: 'text-amber-400',
    badge: 'bg-amber-400/15',
    icon: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  },
  success: {
    accent: 'text-emerald-400',
    badge: 'bg-emerald-400/15',
    icon: 'M5 13l4 4L19 7',
  },
};

let cachedSnapshot = getSnapshot();
function getSnapshotMemoized() {
  const current = getSnapshot();
  if (
    current.activeRequests !== cachedSnapshot.activeRequests ||
    current.toasts !== cachedSnapshot.toasts
  ) {
    cachedSnapshot = current;
  }
  return cachedSnapshot;
}

export default function GlobalUI() {
  const { activeRequests, toasts } = useSyncExternalStore(
    subscribe,
    getSnapshotMemoized,
    getSnapshotMemoized
  );

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return (
    <>
      {activeRequests > 0 && (
        <div className="fixed top-3 left-3 z-[100]">
          <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.variant];
            return (
              <div
                key={toast.id}
                role={toast.variant === 'error' ? 'alert' : 'status'}
                className={`pointer-events-auto w-full max-w-sm rounded-xl bg-zinc-900 text-zinc-50 ring-1 ring-white/10 shadow-xl shadow-black/30 dark:bg-zinc-800 ${
                  toast.leaving
                    ? 'motion-safe:animate-toast-out motion-reduce:opacity-0'
                    : 'motion-safe:animate-toast-in'
                }`}
              >
                <div className="flex items-center gap-3 py-2.5 pl-3 pr-2">
                  <span
                    className={`shrink-0 grid place-items-center w-7 h-7 rounded-full ${style.badge} ${style.accent}`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d={style.icon}
                      />
                    </svg>
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium leading-snug break-words">
                    {toast.message}
                  </span>
                  <button
                    onClick={() => dismissToast(toast.id)}
                    aria-label="Dismiss"
                    className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-white/10 active:bg-white/10"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
