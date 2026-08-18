'use client';

import { useEffect } from 'react';

/**
 * Runs `refresh` on mount and whenever its identity changes, then every
 * `intervalMs` while mounted. Pass a `useCallback` fetcher and let it guard its
 * own preconditions; omit `intervalMs` to fetch without polling.
 */
export function useAutoRefresh(refresh: () => void, intervalMs?: number) {
  useEffect(() => {
    refresh();
    if (intervalMs === undefined) return;
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [refresh, intervalMs]);
}
