'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLoad, usePoll } from '@/lib/use-load';
import {
  ClientJob,
  elapsedSince,
  formatSeconds,
  statusLabel,
} from '@/lib/job-status';
import { projectApiPath } from '@/lib/project-paths';

export function CLIView({ projectId }: { projectId: string }) {
  const [command, setCommand] = useState('');
  const [notify, setNotify] = useState(false);
  const [job, setJob] = useState<ClientJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  // The last command comes back into the input, so a reload leaves it one tap from a re-run.
  const load = useCallback(async () => {
    const res = await fetch(`${projectApiPath(projectId)}/cli`);
    const data = await res.json();
    setJob(data.job);
    if (data.job) setCommand(data.job.command);
  }, [projectId]);

  useLoad(load);

  const running = job?.status === 'running';

  const pollJob = useCallback(async () => {
    if (!running) return;
    const res = await fetch(`${projectApiPath(projectId)}/cli`);
    const data = await res.json();
    setJob(data.job);
    if (data.job?.status !== 'running') setStopping(false);
  }, [projectId, running]);

  usePoll(pollJob, 500);

  useEffect(() => {
    if (running) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job?.output, running]);

  const runCommand = async () => {
    if (!command.trim() || running || starting) return;
    setStarting(true);
    setError(null);
    const res = await apiFetch(`${projectApiPath(projectId)}/cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, notify }),
    });
    const data = await res.json();
    setStarting(false);
    if (!res.ok) setError(data.error || 'Could not start the command');
    if (data.job) setJob(data.job);
  };

  const stopCommand = async () => {
    setStopping(true);
    const res = await apiFetch(`${projectApiPath(projectId)}/cli/stop`, {
      method: 'POST',
    });
    if (!res.ok) setStopping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runCommand();
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter command..."
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full px-3 py-2 bg-foreground/5 border border-foreground/10 rounded-lg text-sm font-mono"
      />
      <div className="flex items-center justify-between mt-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="w-4 h-4"
          />
          Notify
        </label>
        <div className="flex items-center gap-2">
          {running && (
            <button
              onClick={stopCommand}
              disabled={stopping}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg active:opacity-80 disabled:opacity-50"
            >
              {stopping ? 'Stopping...' : 'Stop'}
            </button>
          )}
          <button
            onClick={runCommand}
            disabled={running || starting || !command.trim()}
            className="px-4 py-2 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-50"
          >
            {running || starting ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {job && (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
            <span className={statusLabel(job).className}>
              {statusLabel(job).text}
            </span>
            <span className="text-xs text-foreground/50">
              {job.duration !== null
                ? formatSeconds(job.duration)
                : elapsedSince(job.startTime)}
            </span>
          </div>
          <pre
            ref={logRef}
            className="mt-2 flex-1 min-h-0 p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-auto"
          >
            {job.output || (running ? 'Running...' : '(no output)')}
          </pre>
          {job.status === 'lost' && (
            <p className="mt-2 text-xs text-foreground/40">
              GitMob restarted while this ran, so its exit code went with the
              process that was watching it. The log above is what it wrote.
            </p>
          )}
        </>
      )}
    </div>
  );
}
