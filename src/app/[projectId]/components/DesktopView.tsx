'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { addToast, apiFetch } from '../../../lib/api';
import { DesktopScreenView } from './DesktopScreenView';

interface DesktopSession {
  windowId: string;
  title: string;
  workspace: string;
  projectId: string;
  focused: boolean;
  sessionId: string | null;
  cwd: string | null;
}

export function DesktopView({
  projectId,
  projectPath,
}: {
  projectId: string;
  projectPath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const windowParam = searchParams.get('window');

  const [sessions, setSessions] = useState<DesktopSession[] | null>(null);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuWindowId, setMenuWindowId] = useState<string | null>(null);
  const [remoteTarget, setRemoteTarget] = useState<DesktopSession | null>(null);
  const [remoteName, setRemoteName] = useState('');

  const fetchSessions = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/desktop`);
    const data = await res.json();
    if (res.ok) {
      setSessions(data.sessions);
      setWorkspaces(data.workspaces);
      setError(null);
    } else {
      setError(data.error || 'Could not read the desktop');
    }
  }, [projectId]);

  useEffect(() => {
    fetchSessions();
    if (windowParam) return;
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions, windowParam]);

  const openScreen = (windowId: string) => {
    router.push(
      `/${projectId}?tab=desktop&window=${encodeURIComponent(windowId)}`
    );
  };

  const openRemoteModal = (session: DesktopSession) => {
    setMenuWindowId(null);
    setRemoteName(projectPath.split('/').pop() || projectId);
    setRemoteTarget(session);
  };

  const startRemote = async () => {
    const target = remoteTarget;
    const name = remoteName.trim();
    setRemoteTarget(null);
    if (!target || !name) return;

    const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId: target.windowId, name }),
    });
    if (res.ok) {
      addToast(`Sent /remote-control ${name}`, 'success');
      openScreen(target.windowId);
    }
  };

  if (windowParam) {
    const session = sessions?.find((s) => s.windowId === windowParam);
    return (
      <DesktopScreenView
        projectId={projectId}
        windowId={windowParam}
        title={session?.title || `Window ${windowParam}`}
        onBack={() => router.back()}
      />
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-2 text-center">
        <div className="text-red-500">Could not read the desktop</div>
        <pre className="p-2 text-xs text-left bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap">
          {error}
        </pre>
        <button
          onClick={fetchSessions}
          className="px-3 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!sessions) {
    return (
      <div className="p-4 text-center text-foreground/50">
        Loading sessions...
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="p-4 text-center text-foreground/50">
        <code className="px-1 bg-foreground/10 rounded">{projectId}</code> is
        not open on the desktop.
        <div className="mt-2 text-sm">
          Switch to it there to give it workspaces.
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-foreground/50">
        No Claude sessions on this project&apos;s workspaces.
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-3">
        {sessions.map((session) => {
          const details = [`ws ${session.workspace}`];
          if (session.projectId !== projectId) details.push(session.projectId);
          if (session.sessionId) details.push(session.sessionId.slice(0, 8));

          return (
            <div
              key={session.windowId}
              className="flex items-center justify-between gap-2 p-3 bg-foreground/5 border border-foreground/10 rounded-lg"
            >
              <button
                onClick={() => openScreen(session.windowId)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left active:opacity-80"
              >
                <div
                  className={`w-2.5 h-2.5 shrink-0 rounded-full ${
                    session.focused ? 'bg-green-500' : 'bg-foreground/30'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{session.title}</div>
                  <div className="text-xs text-foreground/50 truncate">
                    {details.join(' · ')}
                  </div>
                </div>
              </button>

              <div className="relative shrink-0">
                <button
                  onClick={() =>
                    setMenuWindowId(
                      menuWindowId === session.windowId
                        ? null
                        : session.windowId
                    )
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
                {menuWindowId === session.windowId && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuWindowId(null)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[120px]">
                      <button
                        onClick={() => openRemoteModal(session)}
                        className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10"
                      >
                        Remote
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {remoteTarget &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setRemoteTarget(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full">
                <div className="px-4 py-3 border-b border-foreground/10">
                  <h3 className="font-medium">Remote control</h3>
                  <div className="text-xs text-foreground/50 truncate">
                    {remoteTarget.title}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="text-xs text-foreground/60 mb-1.5">
                    Session name
                  </div>
                  <input
                    value={remoteName}
                    onChange={(e) => setRemoteName(e.target.value)}
                    autoFocus
                    className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background"
                  />
                </div>
                <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
                  <button
                    onClick={() => setRemoteTarget(null)}
                    className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startRemote}
                    disabled={!remoteName.trim()}
                    className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
