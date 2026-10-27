'use client';

import type { ReactNode } from 'react';
import type { OfflineFirst } from '@/lib/use-offline-first';

const REFRESH_ICON =
  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';

/**
 * The frame of a page that opens offline: a sticky header with the title, a refresh button that
 * spins while the server is asked, and a body drawn from `source`'s data once there is any.
 * `middle` sits between the title and the refresh button and takes the room left; without it the
 * title does. `actions` follow the refresh button.
 */
export function OfflineFirstPage<T>({
  source,
  title,
  subtitle,
  middle,
  actions,
  refreshable = true,
  children,
}: {
  source: OfflineFirst<T>;
  title: string;
  subtitle?: ReactNode;
  middle?: ReactNode;
  actions?: ReactNode;
  refreshable?: boolean;
  children: (data: T) => ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-background border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={`min-w-0 ${middle === undefined ? 'flex-1' : 'max-w-[45%]'}`}
          >
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle}
          </div>
          {middle}
          {refreshable && (
            <button
              onClick={source.reload}
              className="p-2 rounded-lg hover:bg-foreground/10 active:opacity-80"
              aria-label="Refresh"
            >
              <svg
                className={`w-5 h-5 text-foreground/60 ${
                  source.refreshing ? 'animate-spin' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={REFRESH_ICON}
                />
              </svg>
            </button>
          )}
          {actions}
        </div>
      </header>

      <main className="p-3">
        {source.data !== null
          ? children(source.data)
          : source.restored && (
              <div className="text-center text-foreground/50 py-8">
                Loading...
              </div>
            )}
      </main>
    </div>
  );
}
