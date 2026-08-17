import { execFile } from 'child_process';

export interface UsageWindow {
  usedPercentage: number | null;
  resetsAt: number | null;
}

export interface ClaudeUsage {
  todayCost: number;
  capturedAt: number | null;
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
}

interface ClaudexWindow {
  used_percentage: number | null;
  resets_at: number | null;
}

interface ClaudexUsage {
  today_cost: number;
  captured_at?: number | null;
  five_hour?: ClaudexWindow;
  seven_day?: ClaudexWindow;
}

function toWindow(window: ClaudexWindow | undefined): UsageWindow | null {
  if (!window) return null;
  return {
    usedPercentage: window.used_percentage,
    resetsAt: window.resets_at,
  };
}

/**
 * Today's Claude Code spend and the latest rate-limit windows. `claudex usage` owns the ledger
 * the statusline feeds and the rate-limit snapshot, so this asks it rather than reading its
 * caches. Returns null when claudex cannot answer — the project list still has to render.
 */
export function getClaudeUsage(): Promise<ClaudeUsage | null> {
  return new Promise((resolve) => {
    execFile(
      'claudex',
      ['usage', 'show', '--json'],
      { timeout: 10000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const usage: ClaudexUsage = JSON.parse(stdout);
        resolve({
          todayCost: usage.today_cost,
          capturedAt: usage.captured_at ?? null,
          fiveHour: toWindow(usage.five_hour),
          sevenDay: toWindow(usage.seven_day),
        });
      }
    );
  });
}
