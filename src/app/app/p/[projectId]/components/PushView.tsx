'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../../../lib/api';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';
import {
  buildPushArgv,
  PushConfig,
  PushResolution,
  PushScope,
  PushSelection,
  SCOPE_PATTERN,
} from '../../../../../lib/push-command';

interface PushJob {
  command: string;
  startTime: number;
  status: 'running' | 'completed' | 'lost';
  exitCode: number | null;
  signal: string | null;
  duration: number | null;
  output: string;
}

/** How long typing settles before the scope is sent to pt. */
const CHECK_DEBOUNCE_MS = 350;

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function fileCount(n: number): string {
  return `${n} changed file${n === 1 ? '' : 's'}`;
}

/** Why a checked deploy has no target: only a scope can select none. */
function nothingToPushReason(scope: PushScope): string {
  if (scope.files.length === 0) return 'nothing changed in that scope.';
  return `no target matched the ${fileCount(scope.files.length)}.`;
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
  const [pickBy, setPickBy] = useState<'scope' | 'hand'>('scope');
  const [scopeValue, setScopeValue] = useState('1');
  const [notify, setNotify] = useState(true);
  /** pt's last answer, and the words it answers for — a scope edited since is not it. */
  const [answer, setAnswer] = useState<{
    words: string;
    resolution: PushResolution | null;
    error: string | null;
  } | null>(null);

  const logRef = useRef<HTMLPreElement>(null);
  const checkRequest = useRef(0);

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

  // A project with no push_scope block cannot scope, whichever radio is on.
  const scoping = pickBy === 'scope' && (config?.scopeTargets.length ?? 0) > 0;
  const scopeValid = SCOPE_PATTERN.test(scopeValue);
  const serverWords = [...servers].sort().join(',');
  /** The words worth asking pt about, and the key its answer is kept under. */
  const checkWords =
    scoping && scopeValid && servers.length > 0
      ? `${serverWords} scope ${scopeValue}`
      : null;

  // The scope is reactive: every settled edit asks pt which targets it now picks, so the
  // highlight below is pt's own answer for the push the Deploy button would run.
  useEffect(() => {
    if (checkWords === null) return;
    const timer = setTimeout(async () => {
      const request = ++checkRequest.current;
      const query = new URLSearchParams({
        action: 'check',
        servers: serverWords,
        scope: scopeValue,
      });
      const res = await fetch(`/api/projects/${projectId}/push?${query}`);
      const data = await res.json();
      // A slower earlier answer must not land on top of a later one it has been overtaken by.
      if (request !== checkRequest.current) return;
      setAnswer({
        words: checkWords,
        resolution: res.ok ? data.resolution : null,
        error: res.ok ? null : data.error || 'Could not check this push',
      });
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [checkWords, projectId, scopeValue, serverWords]);

  // An answer to different words is not an answer to these, so it reads as still asking.
  const answered = answer?.words === checkWords ? answer : null;
  const checked = answered?.resolution ?? null;
  const checkError = answered?.error ?? null;
  const checking = checkWords !== null && answered === null;

  const selection: PushSelection = {
    servers,
    targets: scoping ? [] : targets,
    scope: scoping ? scopeValue : null,
  };
  const commandLine = buildPushArgv(selection).join(' ');

  const run = async () => {
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

  // Under a scope the deploy is what pt answered for these exact words, so a scope still being
  // checked, or one that picked no target, has nothing to deploy yet.
  const canRun =
    servers.length > 0 &&
    !running &&
    (!scoping || (checked !== null && checked.targets.length > 0));

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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            Targets
          </h2>
          {!scoping && targets.length > 0 && (
            <button
              onClick={() => setTargets([])}
              className="text-xs text-foreground/50 active:opacity-80"
            >
              Clear
            </button>
          )}
        </div>

        {config.scopeTargets.length === 0 ? (
          <p className="text-xs text-foreground/40">
            No <code className="px-1 bg-foreground/10 rounded">push_scope</code>{' '}
            block in this project, so the targets can only be picked by hand.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="push-pick-by"
                  checked={pickBy === 'scope'}
                  onChange={() => setPickBy('scope')}
                  disabled={running}
                  className="w-4 h-4"
                />
                From what changed in
              </label>
              <input
                type="text"
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value.trim())}
                onFocus={() => setPickBy('scope')}
                disabled={running}
                inputMode="text"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                className="w-16 px-2 py-1 text-sm font-mono bg-foreground/5 border border-foreground/10 rounded disabled:opacity-40"
              />
              <span className="text-sm text-foreground/50">
                commits, or 2h / 3d
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="push-pick-by"
                checked={pickBy === 'hand'}
                onChange={() => setPickBy('hand')}
                disabled={running}
                className="w-4 h-4"
              />
              Picked by hand
            </label>
          </div>
        )}

        <div className={`flex flex-wrap gap-2 ${scoping ? 'opacity-90' : ''}`}>
          {config.targets.map((target) => {
            const selected = scoping
              ? (checked?.targets.includes(target) ?? false)
              : targets.includes(target);
            return (
              <button
                key={target}
                onClick={() => setTargets(toggle(targets, target))}
                disabled={running || scoping}
                className={`px-3 py-1.5 text-sm border rounded-full active:opacity-80 ${
                  selected
                    ? 'border-yellow-500/60 bg-yellow-500/10'
                    : 'border-foreground/10 bg-foreground/5 opacity-50'
                } ${scoping ? '' : 'disabled:opacity-60'}`}
              >
                {target}
              </button>
            );
          })}
        </div>

        {!scoping ? (
          <p className="text-xs text-foreground/40">
            {targets.length === 0
              ? 'Nothing selected — pt deploys every target.'
              : `Deploys ${targets.length} of ${config.targets.length} targets.`}
          </p>
        ) : !scopeValid ? (
          <p className="text-xs text-red-400">
            Not a commit count or duration: {scopeValue}
          </p>
        ) : servers.length === 0 ? (
          <p className="text-xs text-foreground/40">
            Pick a server and pt will say what that scope deploys to it.
          </p>
        ) : checkError !== null ? (
          <div className="space-y-1">
            <p className="text-xs text-red-400">
              pt could not check this scope.
            </p>
            <pre className="p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap">
              {checkError}
            </pre>
          </div>
        ) : checking || checked === null ? (
          <p className="text-xs text-foreground/40">
            Asking pt what that scope picks...
          </p>
        ) : checked.scope === null ? (
          <p className="text-xs text-foreground/40">
            Deploys {checked.targets.length} of {config.targets.length} targets.
          </p>
        ) : checked.targets.length === 0 ? (
          <p className="text-xs text-amber-400">
            Nothing to push: {nothingToPushReason(checked.scope)}
          </p>
        ) : (
          <div className="text-xs text-foreground/50 space-y-0.5">
            <div>{fileCount(checked.scope.files.length)} picked them:</div>
            {Object.entries(checked.scope.selected).map(([target, files]) => (
              <div key={target} className="font-mono break-all">
                {target} &larr; {files[0]}
                {files.length > 1 && ` (+${files.length - 1})`}
              </div>
            ))}
          </div>
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

        <button
          onClick={run}
          disabled={!canRun}
          className="px-6 py-2 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-40"
        >
          {running ? 'Deploying...' : 'Deploy'}
        </button>
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
