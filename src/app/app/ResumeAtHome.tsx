'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { goHome } from '@/lib/app-depth';

const AWAY_LONG_ENOUGH_MS = 5 * 60 * 1000;

// Back after a long enough while, whatever page was left open is stale and the task that opened it
// is likely done, so the app starts over at a front page loaded afresh. Arriving there remounts it;
// already being there takes a reload.
export default function ResumeAtHome() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let hiddenAt = 0;
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (hiddenAt && Date.now() - hiddenAt >= AWAY_LONG_ENOUGH_MS) {
          if (pathname === '/app') window.location.reload();
          else goHome(router);
        }
        hiddenAt = 0;
      } else {
        throw new Error(
          `Unexpected visibility state: ${document.visibilityState}`
        );
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [router, pathname]);

  return null;
}
