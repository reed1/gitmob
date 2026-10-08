'use client';

import { ClaudeUsage, UsageWindow } from './types';

const WINDOWS: {
  key: 'fiveHour' | 'sevenDay';
  label: string;
  durationSeconds: number;
}[] = [
  { key: 'fiveHour', label: '5-hour', durationSeconds: 5 * 3600 },
  { key: 'sevenDay', label: 'Weekly', durationSeconds: 7 * 24 * 3600 },
];

function barColor(percentage: number | null): string {
  if (percentage === null) return 'bg-foreground/30';
  if (percentage < 50) return 'bg-green-500';
  if (percentage < 80) return 'bg-amber-400';
  return 'bg-red-500';
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatReset(resetsAt: number | null): string {
  if (resetsAt === null) return 'reset time unknown';
  const seconds = resetsAt - Date.now() / 1000;
  if (seconds <= 0) return 'resets now';
  const at = new Date(resetsAt * 1000);
  const clock = at.toLocaleTimeString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `resets ${clock} (in ${formatDuration(seconds)})`;
}

function elapsedPercentage(
  resetsAt: number | null,
  durationSeconds: number
): number | null {
  if (resetsAt === null) return null;
  const remaining = resetsAt - Date.now() / 1000;
  const elapsed = 100 * (1 - remaining / durationSeconds);
  return Math.min(100, Math.max(0, elapsed));
}

function formatCapturedAt(capturedAt: number): string {
  const seconds = Date.now() / 1000 - capturedAt;
  return seconds < 60
    ? 'as of just now'
    : `as of ${formatDuration(seconds)} ago`;
}

function WindowRow({
  label,
  usageWindow,
  durationSeconds,
}: {
  label: string;
  usageWindow: UsageWindow;
  durationSeconds: number;
}) {
  const percentage = usageWindow.usedPercentage;
  const elapsed = elapsedPercentage(usageWindow.resetsAt, durationSeconds);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-foreground/60">{label}</span>
        <span className="tabular-nums">
          {percentage === null ? 'N/A' : `${Math.round(percentage)}%`}
        </span>
      </div>
      <div className="space-y-0.5">
        <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor(percentage)}`}
            style={{ width: `${percentage ?? 0}%` }}
          />
        </div>
        {elapsed !== null && (
          <div
            className="h-0.5 rounded-full bg-foreground/10 overflow-hidden"
            title={`${Math.round(elapsed)}% of the window elapsed`}
          >
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${elapsed}%` }}
            />
          </div>
        )}
      </div>
      <div className="text-[11px] text-foreground/50">
        {formatReset(usageWindow.resetsAt)}
      </div>
    </div>
  );
}

export default function UsagePanel({ usage }: { usage: ClaudeUsage }) {
  const windows = WINDOWS.flatMap((w) => {
    const data = usage[w.key];
    return data === null ? [] : [{ ...w, data }];
  });

  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3 space-y-3">
      {windows.length === 0 ? (
        <div className="text-xs text-foreground/50">
          No rate-limit data recorded yet.
        </div>
      ) : (
        windows.map((w) => (
          <WindowRow
            key={w.key}
            label={w.label}
            usageWindow={w.data}
            durationSeconds={w.durationSeconds}
          />
        ))
      )}
      {usage.capturedAt !== null && (
        <div className="text-[11px] text-foreground/40">
          {formatCapturedAt(usage.capturedAt)}
        </div>
      )}
    </div>
  );
}
