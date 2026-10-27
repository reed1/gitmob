'use client';

import { useEffect } from 'react';

/**
 * Runs `load` on mount and whenever its identity changes. Pass a `useCallback` fetcher and let it
 * guard its own preconditions.
 */
export function useLoad(load: () => void) {
  useEffect(() => {
    load();
  }, [load]);
}

/** Like `useLoad`, then again every `intervalMs` while mounted; a null interval only loads. */
export function usePoll(poll: () => void, intervalMs: number | null) {
  useEffect(() => {
    poll();
    if (intervalMs === null) return;
    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [poll, intervalMs]);
}
