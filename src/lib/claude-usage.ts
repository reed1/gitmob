import { execFile } from 'child_process';

/**
 * Today's Claude Code API spend. `claudex usage` owns the cost ledger the statusline feeds, so
 * this asks it for the day's total rather than reading its cache and redoing the date check.
 * Returns null when claudex cannot answer — the project list still has to render.
 */
export function getTodayCost(): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      'claudex',
      ['usage', 'query'],
      { timeout: 10000 },
      (error, stdout) => {
        const cost = Number(stdout.trim().replace(/^\$/, ''));
        resolve(error || !Number.isFinite(cost) ? null : cost);
      }
    );
  });
}
