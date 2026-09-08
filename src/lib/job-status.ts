/**
 * A CLI job as the browser sees one, and the labels every view puts on it. `cli-jobs.ts` owns
 * the type but reaches for child_process, so no client component can import it from there.
 */

export interface ClientJob {
  command: string;
  startTime: number;
  status: 'running' | 'completed' | 'lost';
  exitCode: number | null;
  signal: string | null;
  duration: number | null;
  output: string;
}

export function formatSeconds(ms: number): string {
  if (ms < 10000) return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  if (minutes === 0) return `${total}s`;
  return `${minutes}m ${total % 60}s`;
}

export function elapsedSince(startTime: number): string {
  return formatSeconds(Date.now() - startTime);
}

export function statusLabel(job: ClientJob): {
  text: string;
  className: string;
} {
  if (job.status === 'running') {
    return { text: 'Running', className: 'text-blue-400' };
  }
  if (job.status === 'lost') {
    return { text: 'Interrupted', className: 'text-amber-400' };
  }
  if (job.status === 'completed') {
    if (job.signal !== null) {
      return { text: `Stopped (${job.signal})`, className: 'text-amber-400' };
    }
    return job.exitCode === 0
      ? { text: 'Succeeded', className: 'text-green-500' }
      : { text: `Failed (exit ${job.exitCode})`, className: 'text-red-500' };
  }
  throw new Error(`Unexpected job status: ${job.status}`);
}
