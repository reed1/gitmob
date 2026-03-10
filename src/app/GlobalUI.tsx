'use client';

import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, dismissToast } from '../lib/api';

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

  return (
    <>
      {activeRequests > 0 && (
        <div className="fixed top-3 left-3 z-[100]">
          <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-start gap-2"
            >
              <span className="flex-1 break-words">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 text-white/70 hover:text-white"
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
          ))}
        </div>
      )}
    </>
  );
}
