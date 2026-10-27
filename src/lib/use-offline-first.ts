'use client';

import { useCallback, useState } from 'react';
import { addToast } from '@/lib/api';
import { useLoad } from '@/lib/use-load';
import { useCachedState } from '@/lib/use-cached-state';

/**
 * The data of a page that opens offline (Pinboard, Checklist — see docs/pwas.md). The cached
 * copy paints first and the server is asked only once it has; an unreachable server leaves the
 * cached copy on screen. Every answer from the server is cached for the next open.
 */
export interface OfflineFirst<T> {
  /** The server's answer as edited on this page, else the cached copy; null while there is neither. */
  data: T | null;
  /** Whether `data` came from the server on this open. Writes wait for it, or they would act on a stale copy. */
  fresh: boolean;
  /** False only until the cache has been read, telling "nothing cached" apart from "not looked yet". */
  restored: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Changes what is on screen, not the cache. A no-op until `fresh`. */
  edit: (update: (data: T) => T) => void;
  /** Reads the server into the cache, leaving the screen as it is. */
  refreshCache: () => Promise<void>;
}

/** `parse` turns the server's response into the page's data; keep its identity stable. */
export function useOfflineFirst<T>(
  key: string,
  url: string,
  parse: (res: Response) => Promise<T>
): OfflineFirst<T> {
  const [cached, setCached, restored] = useCachedState<T>(key);
  const [loaded, setLoaded] = useState<T | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  const fetchFresh = useCallback(async (): Promise<T | null> => {
    const res = await fetch(url).catch(() => null);
    return res === null ? null : parse(res);
  }, [url, parse]);

  const reload = useCallback(async () => {
    if (!restored) return;
    setRefreshing(true);
    const fresh = await fetchFresh();
    if (fresh === null) {
      addToast('Offline, showing the last copy', 'warning');
    } else {
      setCached(fresh);
      setLoaded(fresh);
    }
    setRefreshing(false);
  }, [restored, fetchFresh, setCached]);

  useLoad(reload);

  const edit = useCallback((update: (data: T) => T) => {
    setLoaded((prev) => (prev === null ? prev : update(prev)));
  }, []);

  const refreshCache = useCallback(async () => {
    const fresh = await fetchFresh();
    if (fresh !== null) setCached(fresh);
  }, [fetchFresh, setCached]);

  return {
    data: loaded ?? cached,
    fresh: loaded !== null,
    restored,
    refreshing,
    reload,
    edit,
    refreshCache,
  };
}
