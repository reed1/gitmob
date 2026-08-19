'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { RunLogView } from './RunLogView';
import { useAutoRefresh } from '../../../lib/use-auto-refresh';
import { openExternal } from '../../../lib/open-external';

interface RunInfo {
  name: string;
  running: boolean;
  pid?: string;
  uptime?: string;
  members?: string[];
  runningMembers?: number;
}

interface MonitorStatus {
  project_id: string;
  site_key: string;
  is_up: boolean;
}

export function RunView({
  projectId,
  urls,
}: {
  projectId: string;
  urls?: Record<string, string>;
}) {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [hasRuns, setHasRuns] = useState(true);
  const [loading, setLoading] = useState(true);
  const [monitors, setMonitors] = useState<MonitorStatus[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const logRun = searchParams.get('logs');

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/run?action=status`);
    const data = await res.json();
    setRuns(data.runs || []);
    setHasRuns(data.hasRuns);
    setLoading(false);
  }, [projectId]);

  useAutoRefresh(fetchStatus, 5000);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/upmon`)
      .then((res) => res.json())
      .then((data) => setMonitors(data))
      .catch(() => {});
  }, [projectId]);

  const openLogs = (runName: string) => {
    router.push(`/${projectId}?tab=run&logs=${encodeURIComponent(runName)}`);
  };

  const handleAction = async (
    action: 'start' | 'stop' | 'restart',
    runName: string
  ) => {
    await apiFetch(`/api/projects/${projectId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, runName }),
    });
    await new Promise((r) => setTimeout(r, 500));
    await fetchStatus();
  };

  if (logRun) {
    return (
      <RunLogView
        projectId={projectId}
        runName={logRun}
        onBack={() => router.back()}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-foreground/50">Loading runs...</div>
    );
  }

  if (!hasRuns) {
    return (
      <div className="p-4 text-center text-foreground/50">
        No runs configured for this project.
        <div className="mt-2 text-sm">
          Add a <code className="px-1 bg-foreground/10 rounded">cmd</code>{' '}
          section to the project YAML to define runs.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {runs.map((run) => {
        const isGroup = !!run.members;
        const total = run.members?.length ?? 0;
        const running = run.runningMembers ?? 0;
        const fullyRunning = isGroup ? running === total : run.running;
        return (
          <div
            key={run.name}
            className="flex items-center justify-between p-3 bg-foreground/5 border border-foreground/10 rounded-lg"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-2.5 h-2.5 shrink-0 rounded-full ${
                  isGroup
                    ? fullyRunning
                      ? 'bg-green-500'
                      : running > 0
                        ? 'bg-yellow-500'
                        : 'bg-foreground/30'
                    : run.running
                      ? 'bg-green-500'
                      : 'bg-foreground/30'
                }`}
              />
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {isGroup ? `@${run.name}` : run.name}
                </div>
                {isGroup ? (
                  <div className="text-xs text-foreground/50 truncate">
                    {running}/{total} running · {run.members!.join(', ')}
                  </div>
                ) : (
                  run.running &&
                  run.uptime && (
                    <div className="text-xs text-foreground/50">
                      PID {run.pid} · {run.uptime}
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {!isGroup && (
                <button
                  onClick={() => openLogs(run.name)}
                  className="px-2 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80"
                >
                  Logs
                </button>
              )}
              {run.running ? (
                <>
                  <button
                    onClick={() => handleAction('restart', run.name)}
                    className="px-2 py-1.5 text-xs bg-yellow-600 text-white rounded active:opacity-80"
                  >
                    Restart
                  </button>
                  <button
                    onClick={() => handleAction('stop', run.name)}
                    className="px-2 py-1.5 text-xs bg-red-600 text-white rounded active:opacity-80"
                  >
                    Stop
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleAction('start', run.name)}
                  className="px-2 py-1.5 text-xs bg-green-600 text-white rounded active:opacity-80"
                >
                  Start
                </button>
              )}
            </div>
          </div>
        );
      })}

      {urls && Object.keys(urls).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-foreground/50 mb-2">
            URLs ({Object.keys(urls).length})
          </h3>
          <div className="space-y-1">
            {Object.entries(urls).map(([key, url]) => {
              const monitor = monitors.find((m) => m.site_key === key);
              return (
                <button
                  key={key}
                  onClick={() => openExternal(url)}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left bg-foreground/5 border border-foreground/10 rounded-lg active:opacity-80"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      monitor
                        ? monitor.is_up
                          ? 'bg-green-500'
                          : 'bg-red-500'
                        : 'bg-foreground/30'
                    }`}
                  />
                  <div className="min-w-0">
                    <span>{key}</span>
                    <span className="text-foreground/40"> :: </span>
                    <span className="text-blue-500">{url}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
