'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { addToast, apiFetch } from '../../../../../lib/api';
import { launchDesktopSession } from '../../../../../lib/desktop-client';
import {
  CLAUDE_MODES,
  ClaudeMode,
  DEFAULT_CLAUDE_MODE,
} from '../../../../../lib/desktop-modes';
import type { DesktopSession } from './ClaudeView';

export function DesktopSessions({
  projectId,
  projectPath,
  sessions,
  workspaces,
  error,
  onRetry,
  onOpenScreen,
}: {
  projectId: string;
  projectPath: string;
  sessions: DesktopSession[] | null;
  workspaces: string[];
  error: string | null;
  onRetry: () => void;
  onOpenScreen: (windowId: string) => void;
}) {
  const [menuWindowId, setMenuWindowId] = useState<string | null>(null);
  const [remoteTarget, setRemoteTarget] = useState<DesktopSession | null>(null);
  const [remoteName, setRemoteName] = useState('');
  const [mode, setMode] = useState<ClaudeMode>(DEFAULT_CLAUDE_MODE);
  const [launching, setLaunching] = useState(false);

  const launch = async () => {
    setLaunching(true);
    try {
      if (await launchDesktopSession(projectId, mode)) onRetry();
    } finally {
      setLaunching(false);
    }
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
      body: JSON.stringify({
        windowId: target.windowId,
        name,
        action: 'remote',
      }),
    });
    if (res.ok) addToast(`Sent /remote-control ${name}`, 'success');
  };

  const sendExit = async (session: DesktopSession) => {
    setMenuWindowId(null);

    const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId: session.windowId, action: 'exit' }),
    });
    if (res.ok) addToast('Sent /exit', 'success');
  };

  return (
    <>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs uppercase tracking-wide text-foreground/40">
            Desktop
          </h2>
          <div className="flex items-center gap-1.5">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ClaudeMode)}
              className="text-xs bg-foreground/5 border border-foreground/15 rounded-lg px-2 py-1.5"
            >
              {CLAUDE_MODES.map((entry) => (
                <option key={entry.mode} value={entry.mode}>
                  {entry.label}
                </option>
              ))}
            </select>
            <button
              onClick={launch}
              disabled={launching}
              className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/15 text-blue-500 border border-blue-500/20 active:opacity-80 disabled:opacity-40"
            >
              {launching ? 'Starting...' : 'New'}
            </button>
          </div>
        </div>

        {error && (
          <div className="space-y-2">
            <pre className="p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap text-red-500">
              {error}
            </pre>
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {!error && sessions === null && (
          <div className="text-sm text-foreground/40">Loading...</div>
        )}

        {!error && sessions && workspaces.length === 0 && (
          <div className="text-sm text-foreground/40">
            <code className="px-1 bg-foreground/10 rounded">{projectId}</code>{' '}
            is not open on the desktop.
          </div>
        )}

        {!error && sessions?.length === 0 && workspaces.length > 0 && (
          <div className="text-sm text-foreground/40">
            No Claude windows on this project&apos;s workspaces.
          </div>
        )}

        {sessions?.map((session) => {
          const details = [`ws ${session.workspace}`];
          if (session.projectId !== projectId) details.push(session.projectId);
          if (session.sessionId) details.push(session.sessionId.slice(0, 8));

          return (
            <div
              key={session.windowId}
              className="flex items-center justify-between gap-2 p-3 bg-foreground/5 border border-foreground/10 rounded-lg"
            >
              <button
                onClick={() => onOpenScreen(session.windowId)}
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
                      <button
                        onClick={() => sendExit(session)}
                        className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10"
                      >
                        Exit
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={(e) => {
              e.stopPropagation();
              setRemoteTarget(null);
            }}
          >
            <div
              className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
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
          </div>,
          document.body
        )}
    </>
  );
}
