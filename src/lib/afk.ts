import { execFile } from 'child_process';
import { closeSync, mkdirSync, openSync } from 'fs';
import { dirname } from 'path';

/**
 * Touching this forces the away verdict. `am-i-afk` owns what it means and how long it lasts —
 * long enough for the desktop's own idle timer to reach the same answer — so this only ever
 * touches it, and never reads it back to work out whether it is still good.
 */
const FORCED_AFK_FLAG = '/tmp/rlocal/am-i-afk-forced.flag';

/**
 * `am-i-afk` draws the away line that decides whether a handoff opens a window on the desktop
 * or is parked here. It exits 0 away and 1 here, so a nonzero exit is the answer rather than a
 * failure; null is not being able to ask at all, and the project list still has to render.
 */
export function isAway(): Promise<boolean | null> {
  return new Promise((resolve) => {
    execFile('am-i-afk', { timeout: 5000 }, (error) => {
      if (!error) {
        resolve(true);
      } else if (error.code === 1) {
        resolve(false);
      } else {
        resolve(null);
      }
    });
  });
}

export function forceAfk(): void {
  mkdirSync(dirname(FORCED_AFK_FLAG), { recursive: true });
  closeSync(openSync(FORCED_AFK_FLAG, 'w'));
}
