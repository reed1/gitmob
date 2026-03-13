'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface SessionStatus {
  projectId: string;
  projectPath: string;
  url: string;
  pid: number;
  startedAt: number;
  alive: boolean;
}

function formatUptime(startedAt: number): string {
  if (!startedAt) return 'unknown';
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function ClaudeSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    fetch('/api/claude-sessions')
      .then((res) => res.json())
      .then((data) => {
        setSessions(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const alive = sessions.filter((s) => s.alive);
  const dead = sessions.filter((s) => !s.alive);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-1 rounded-lg hover:bg-foreground/10"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Claude Code Sessions</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground/50">
              {alive.length} active
            </span>
            {dead.length > 0 && (
              <button
                onClick={async () => {
                  await apiFetch('/api/claude-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clearDead' }),
                  });
                  refresh();
                }}
                className="text-xs px-2 py-1 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/60"
              >
                Clear dead
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {loading && (
          <div className="text-center text-foreground/50 py-8">Loading...</div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center text-foreground/50 py-8">
            No Claude Code sessions found
          </div>
        )}

        {sessions.map((session) => (
          <div
            key={session.pid}
            className={`p-4 rounded-lg border ${
              session.alive
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-foreground/10 bg-foreground/5 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${session.alive ? 'bg-green-500' : 'bg-foreground/30'}`}
                  />
                  <span className="font-medium">{session.projectId}</span>
                  <span className="text-xs text-foreground/40">
                    PID {session.pid}
                  </span>
                </div>
                <div className="mt-1 text-sm text-foreground/50 truncate">
                  {session.projectPath}
                </div>
                {session.startedAt > 0 && (
                  <div className="mt-1 text-xs text-foreground/40">
                    Up {formatUptime(session.startedAt)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {session.url && (
                  <button
                    onClick={() => window.open(session.url, '_blank')}
                    className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                  >
                    Open
                  </button>
                )}
                {session.alive && (
                  <button
                    onClick={async () => {
                      await apiFetch('/api/claude-sessions', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          pid: session.pid,
                          kill: true,
                        }),
                      });
                      refresh();
                    }}
                    className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  >
                    Kill
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
