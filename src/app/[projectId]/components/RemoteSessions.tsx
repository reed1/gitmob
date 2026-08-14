'use client';

import { useCallback, useEffect, useState } from 'react';
import { addToast, apiFetch } from '../../../lib/api';

type PermissionMode = 'auto' | 'default' | 'bypassPermissions';

const PERMISSION_MODES: { value: PermissionMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'default', label: 'Ask' },
  { value: 'bypassPermissions', label: 'Bypass' },
];

interface RemoteSession {
  unit: string;
  projectId: string;
  name: string;
  url: string | null;
  startedAt: number | null;
  active: boolean;
}

function since(startedAt: number | null): string {
  if (!startedAt) return 'just now';

  const minutes = Math.floor((Date.now() / 1000 - startedAt) / 60);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RemoteSessions({ projectId }: { projectId: string }) {
  const [sessions, setSessions] = useState<RemoteSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuUnit, setMenuUnit] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto');

  const fetchSessions = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/remote`);
    const data = await res.json();
    if (res.ok) {
      setSessions(data.sessions);
      setError(null);
    } else {
      setError(data.error || 'Could not read the remote sessions');
    }
  }, [projectId]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionMode }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`Started ${data.name}`, 'success');
        fetchSessions();
      }
    } finally {
      setStarting(false);
    }
  };

  const stop = async (session: RemoteSession) => {
    setMenuUnit(null);
    const res = await apiFetch(
      `/api/projects/${projectId}/remote?unit=${encodeURIComponent(session.unit)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      addToast(`Closed ${session.name}`, 'success');
      fetchSessions();
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-wide text-foreground/40">
          Remote
        </h2>
        <div className="flex items-center gap-1.5">
          <select
            value={permissionMode}
            onChange={(e) =>
              setPermissionMode(e.target.value as PermissionMode)
            }
            className="text-xs bg-foreground/5 border border-foreground/15 rounded-lg px-2 py-1.5"
          >
            {PERMISSION_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          <button
            onClick={start}
            disabled={starting}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/15 text-blue-500 border border-blue-500/20 active:opacity-80 disabled:opacity-40"
          >
            {starting ? 'Starting...' : 'New'}
          </button>
        </div>
      </div>

      {error && (
        <pre className="p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap text-red-500">
          {error}
        </pre>
      )}

      {!error && sessions === null && (
        <div className="text-sm text-foreground/40">Loading...</div>
      )}

      {!error && sessions?.length === 0 && (
        <div className="text-sm text-foreground/40">
          No environments open on this project.
        </div>
      )}

      {sessions?.map((session) => (
        <div
          key={session.unit}
          className="flex items-center justify-between gap-2 p-3 bg-foreground/5 border border-foreground/10 rounded-lg"
        >
          <button
            onClick={() => session.url && window.open(session.url, '_blank')}
            disabled={!session.url}
            className="flex items-center gap-3 min-w-0 flex-1 text-left active:opacity-80 disabled:opacity-60"
          >
            <div
              className={`w-2.5 h-2.5 shrink-0 rounded-full ${
                session.active ? 'bg-green-500' : 'bg-foreground/30'
              }`}
            />
            <div className="min-w-0">
              <div className="font-medium truncate">{session.name}</div>
              <div className="text-xs text-foreground/50 truncate">
                {[
                  since(session.startedAt),
                  session.projectId !== projectId ? session.projectId : null,
                  session.url ? null : 'no URL in the journal',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </button>

          <div className="relative shrink-0">
            <button
              onClick={() =>
                setMenuUnit(menuUnit === session.unit ? null : session.unit)
              }
              className="p-2 rounded-lg bg-foreground/10 active:bg-foreground/20 transition-colors"
            >
              <svg
                className="w-5 h-5 text-foreground/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01"
                />
              </svg>
            </button>
            {menuUnit === session.unit && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuUnit(null)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => stop(session)}
                    className="block w-full px-4 py-2 text-sm text-left text-red-500 hover:bg-foreground/10"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
