'use client';

import { useCallback, useState } from 'react';
import { addToast } from './api';

async function fetchHealthWithTimeout(
  timeoutMs: number
): Promise<{ startedAt: number } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function waitForNewServer(
  previousStartedAt: number,
  timeoutMs = 20000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await fetchHealthWithTimeout(3000);
    if (health && health.startedAt !== previousStartedAt) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

/** Restarts the GitMob service and reloads the page once the new server answers. */
export function useRestart() {
  const [restarting, setRestarting] = useState(false);

  const restart = useCallback(async () => {
    const health = await fetchHealthWithTimeout(3000);
    if (!health) return;
    const previousStartedAt = health.startedAt;
    setRestarting(true);
    // Raw fetch to avoid error toasts — the server will die mid-request
    fetch('/api/restart', { method: 'POST' }).catch(() => {});
    if (await waitForNewServer(previousStartedAt)) {
      window.location.reload();
    } else {
      setRestarting(false);
      addToast('Service did not come back up after 20 seconds');
    }
  }, []);

  return { restarting, restart };
}
