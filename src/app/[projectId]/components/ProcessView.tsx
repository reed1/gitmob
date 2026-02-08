'use client';

import { useState, useEffect, useCallback } from 'react';

interface ProcessInfo {
  name: string;
  running: boolean;
  pid?: string;
  uptime?: string;
}

interface MonitorStatus {
  project_id: string;
  site_key: string;
  is_up: boolean;
}

export function ProcessView({
  projectId,
  urls,
}: {
  projectId: string;
  urls?: Record<string, string>;
}) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [hasProcesses, setHasProcesses] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<MonitorStatus[]>([]);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/process?action=status`);
    const data = await res.json();
    setProcesses(data.processes || []);
    setHasProcesses(data.hasProcesses);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/upmon`)
      .then((res) => res.json())
      .then((data) => setMonitors(data))
      .catch(() => {});
  }, [projectId]);

  const handleAction = async (
    action: 'start' | 'stop' | 'restart',
    processName: string
  ) => {
    setActionLoading(`${action}-${processName}`);
    await fetch(`/api/projects/${projectId}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, processName }),
    });
    await new Promise((r) => setTimeout(r, 500));
    await fetchStatus();
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-foreground/50">
        Loading processes...
      </div>
    );
  }

  if (!hasProcesses) {
    return (
      <div className="p-4 text-center text-foreground/50">
        No processes configured for this project.
        <div className="mt-2 text-sm">
          Add a <code className="px-1 bg-foreground/10 rounded">cmd</code>{' '}
          section to the project YAML to define processes.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {processes.map((proc) => (
        <div
          key={proc.name}
          className="flex items-center justify-between p-3 bg-foreground/5 border border-foreground/10 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                proc.running ? 'bg-green-500' : 'bg-foreground/30'
              }`}
            />
            <div>
              <div className="font-medium">{proc.name}</div>
              {proc.running && proc.uptime && (
                <div className="text-xs text-foreground/50">
                  PID {proc.pid} · {proc.uptime}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {proc.running ? (
              <>
                <button
                  onClick={() => handleAction('restart', proc.name)}
                  disabled={actionLoading === `restart-${proc.name}`}
                  className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded active:opacity-80 disabled:opacity-50"
                >
                  {actionLoading === `restart-${proc.name}`
                    ? 'Restarting...'
                    : 'Restart'}
                </button>
                <button
                  onClick={() => handleAction('stop', proc.name)}
                  disabled={actionLoading === `stop-${proc.name}`}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded active:opacity-80 disabled:opacity-50"
                >
                  {actionLoading === `stop-${proc.name}`
                    ? 'Stopping...'
                    : 'Stop'}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleAction('start', proc.name)}
                disabled={actionLoading === `start-${proc.name}`}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded active:opacity-80 disabled:opacity-50"
              >
                {actionLoading === `start-${proc.name}`
                  ? 'Starting...'
                  : 'Start'}
              </button>
            )}
          </div>
        </div>
      ))}

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
                  onClick={() => window.open(url, '_blank')}
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
