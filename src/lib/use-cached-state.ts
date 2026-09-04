'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * State that lives in localStorage, so re-opening a PWA paints the last snapshot instead of a
 * loading screen while the server answers. `restored` is false only until the store has been
 * read — which happens right after hydration, since the server has no localStorage to read —
 * and tells "nothing cached yet" apart from "not looked yet".
 */

interface Cached<T> {
  value: T | null;
  restored: boolean;
}

const UNREAD: Cached<never> = { value: null, restored: false };

const listeners = new Map<string, Set<() => void>>();

export function useCachedState<T>(key: string) {
  const cache = useRef<{ raw: string | null; snapshot: Cached<T> } | null>(
    null
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let keyListeners = listeners.get(key);
      if (keyListeners === undefined) {
        keyListeners = new Set();
        listeners.set(key, keyListeners);
      }
      keyListeners.add(onStoreChange);

      // Another tab writing the same key is the one change that arrives without going
      // through `store` below.
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) onStoreChange();
      };
      window.addEventListener('storage', onStorage);

      return () => {
        keyListeners.delete(onStoreChange);
        window.removeEventListener('storage', onStorage);
      };
    },
    [key]
  );

  // React compares snapshots by identity, so the parsed value is kept until the raw string
  // it came from changes.
  const getSnapshot = useCallback((): Cached<T> => {
    const raw = window.localStorage.getItem(key);
    if (cache.current === null || cache.current.raw !== raw) {
      cache.current = {
        raw,
        snapshot: {
          value: raw === null ? null : (JSON.parse(raw) as T),
          restored: true,
        },
      };
    }
    return cache.current.snapshot;
  }, [key]);

  const getServerSnapshot = useCallback((): Cached<T> => UNREAD, []);

  const { value, restored } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const store = useCallback(
    (next: T) => {
      window.localStorage.setItem(key, JSON.stringify(next));
      listeners.get(key)?.forEach((listener) => listener());
    },
    [key]
  );

  return [value, store, restored] as const;
}
