'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useAutoRefresh } from '../../../lib/use-auto-refresh';
import {
  buildPushArgv,
  PushConfig,
  PushSelection,
  SCOPE_PATTERN,
} from '../../../lib/push-command';

interface PushJob {
  command: string;
  startTime: number;
  status: 'running' | 'completed' | 'lost';
  exitCode: number | null;
  signal: string | null;
  duration: number | null;
  output: string;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function formatSeconds(ms: number): string {
  if (ms < 10000) return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  if (minutes === 0) return `${total}s`;
  return `${minutes}m ${total % 60}s`;
}

function elapsedSince(startTime: number): string {
  return formatSeconds(Date.now() - startTime);
}

function statusLabel(job: PushJob): { text: string; className: string } {
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

export function PushView({ projectId }: { projectId: string }) {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<PushJob | null>(null);

  const [servers, setServers] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [scopeOn, setScopeOn] = useState(false);
  const [scopeValue, setScopeValue] = useState('1');
  const [notify, setNotify] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/push`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not read the push config');
      return;
    }
    setConfig(data.config);
    setJob(data.job);
    setServers(data.config.defaultServers);
    setError(null);
  }, [projectId]);

  useAutoRefresh(load);

  const running = job?.status === 'running';

  const pollJob = useCallback(async () => {
    if (!running) return;
    const res = await fetch(`/api/projects/${projectId}/push?action=job`);
    const data = await res.json();
    setJob(data.job);
  }, [projectId, running]);

  useAutoRefresh(pollJob, 1000);

  useEffect(() => {
    if (running) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job?.output, running]);

  const scopeValid = !scopeOn || SCOPE_PATTERN.test(scopeValue);

  const selection: PushSelection = {
    servers,
    targets,
    scope: scopeOn ? scopeValue : null,
  };

  const run = async () => {
    setConfirming(false);
    const res = await apiFetch(`/api/projects/${projectId}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selection, notify }),
    });
    const data = await res.json();
    if (data.job) setJob(data.job);
  };

  if (error) {
    return (
      <div className="p-4 space-y-2 text-center">
        <div className="text-red-500">Could not read the push config</div>
        <pre className="p-2 text-xs text-left bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap">
          {error}
        </pre>
        <button
          onClick={load}
          className="px-3 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 text-center text-foreground/50">
        Loading push config...
      </div>
    );
  }

  if (config.targets.length === 0) {
    return (
      <div className="p-4 text-center text-foreground/50">
        No deploy targets in this project.
        <div className="mt-2 text-sm">
          Targets come from the{' '}
          <code className="px-1 bg-foreground/10 rounded">push-*</code> tags in{' '}
          <code className="px-1 bg-foreground/10 rounded">
            ansible/playbooks/
          </code>
          .
        </div>
      </div>
    );
  }

  const canRun = servers.length > 0 && scopeValid && !running;
  const commandLine = buildPushArgv(selection).join(' ');

  return (
    <div className="p-4 space-y-5">
      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-foreground/40">
          Servers
        </h2>
        <div className="flex flex-wrap gap-2">
          {config.servers.map((server) => {
            const selected = servers.includes(server.name);
            return (
              <button
                key={server.name}
                onClick={() => setServers(toggle(servers, server.name))}
                disabled={running}
                className={`px-3 py-2 text-left border rounded-lg disabled:opacity-50 active:opacity-80 ${
                  selected
                    ? 'border-blue-500/60 bg-blue-500/10'
                    : 'border-foreground/10 bg-foreground/5'
                }`}
              >
                <div className="font-medium">{server.name}</div>
                <div className="text-xs text-foreground/50">{server.ssh}</div>
              </button>
            );
          })}
        </div>
        {servers.length === 0 && (
          <p className="text-xs text-red-400">Pick at least one server.</p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            Targets
          </h2>
          {targets.length > 0 && !scopeOn && (
            <button
              onClick={() => setTargets([])}
              className="text-xs text-foreground/50 active:opacity-80"
            >
              Clear
            </button>
          )}
        </div>
        <div className={`flex flex-wrap gap-2 ${scopeOn ? 'opacity-40' : ''}`}>
          {config.targets.map((target) => {
            const selected = targets.includes(target);
            return (
              <button
                key={target}
                onClick={() => setTargets(toggle(targets, target))}
                disabled={running || scopeOn}
                className={`px-3 py-1.5 text-sm border rounded-full disabled:opacity-60 active:opacity-80 ${
                  selected
                    ? 'border-yellow-500/60 bg-yellow-500/10'
                    : 'border-foreground/10 bg-foreground/5'
                }`}
              >
                {target}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-foreground/40">
          {scopeOn
            ? 'Scope picks the targets from what changed.'
            : targets.length === 0
              ? 'Nothing selected — pt deploys every target.'
              : `Deploys ${targets.length} of ${config.targets.length} targets.`}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-foreground/40">
          Scope
        </h2>
        {config.scopeTargets.length === 0 ? (
          <p className="text-xs text-foreground/40">
            Unavailable — this project has no{' '}
            <code className="px-1 bg-foreground/10 rounded">push_scope</code>{' '}
            block to map changed files onto targets.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scopeOn}
                  onChange={(e) => setScopeOn(e.target.checked)}
                  disabled={running}
                  className="w-4 h-4"
                />
                Pick targets from recent changes
              </label>
              <input
                type="text"
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value.trim())}
                disabled={running || !scopeOn}
                inputMode="text"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                className="w-20 px-2 py-1 text-sm font-mono bg-foreground/5 border border-foreground/10 rounded disabled:opacity-40"
              />
            </div>
            <p
              className={`text-xs ${scopeValid ? 'text-foreground/40' : 'text-red-400'}`}
            >
              {scopeValid
                ? 'A commit count, or a duration like 2h, 30m, 3d.'
                : `Not a commit count or duration: ${scopeValue}`}
            </p>
          </>
        )}
      </section>

      <section className="space-y-3 pt-1 border-t border-foreground/10">
        <pre className="p-2 text-xs font-mono bg-foreground/5 border border-foreground/10 rounded overflow-x-auto">
          {commandLine}
        </pre>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="w-4 h-4"
          />
          Notify when the deploy finishes
        </label>

        {confirming ? (
          <div className="p-3 space-y-3 border border-foreground/15 bg-foreground/5 rounded-lg">
            <div className="text-sm">
              Deploy to{' '}
              <span className="font-semibold">
                {[...servers].sort().join(', ')}
              </span>
              ? This pushes the current branch and runs the playbooks there.
            </div>
            <div className="flex gap-2">
              <button
                onClick={run}
                className="px-5 py-2 bg-foreground text-background font-medium rounded-lg active:opacity-80"
              >
                Deploy
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 bg-foreground/10 border border-foreground/15 rounded-lg active:opacity-80"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={!canRun}
            className="px-6 py-2 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-40"
          >
            {running ? 'Pushing...' : 'Push'}
          </button>
        )}
      </section>

      {job && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={statusLabel(job).className}>
              {statusLabel(job).text}
            </span>
            <span className="text-xs text-foreground/50">
              {job.duration !== null
                ? formatSeconds(job.duration)
                : elapsedSince(job.startTime)}
            </span>
          </div>
          <div className="text-xs font-mono text-foreground/50 break-all">
            {job.command}
          </div>
          <pre
            ref={logRef}
            className="p-3 max-h-[50vh] text-xs font-mono bg-foreground/5 border border-foreground/10 rounded-lg whitespace-pre-wrap overflow-auto"
          >
            {job.output || (running ? 'Starting...' : '(no output)')}
          </pre>
          {job.status === 'lost' && (
            <p className="text-xs text-foreground/40">
              GitMob restarted while this ran, so its exit code went with the
              process that was watching it. The log above is what it wrote.
            </p>
          )}
        </section>
      )}

      <p className="text-xs text-foreground/40">
        <code>pt push</code> sends the current branch, then runs the
        project&apos;s playbooks against the selected servers with the matching{' '}
        <code>push-*</code> tags. It keeps running if you leave this tab.
      </p>
    </div>
  );
}
