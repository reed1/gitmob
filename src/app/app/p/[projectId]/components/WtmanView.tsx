'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { apiFetch } from '../../../../../lib/api';
import { relativeTime } from '../../../../../lib/relative-time';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';

interface Worktree {
  name: string;
  branch: string | null;
  path: string;
  touchedAt: string;
  projectId: string;
  open: boolean;
}

export function WtmanView({
  projectId,
  currentProjectId,
}: {
  projectId: string;
  currentProjectId: string;
}) {
  const router = useRouter();
  const [worktrees, setWorktrees] = useState<Worktree[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [newBranch, setNewBranch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/worktrees`);
    const data = await res.json();
    if (res.ok) {
      setWorktrees(data.worktrees);
      setError(null);
    } else {
      setError(data.error || 'Could not read worktrees');
    }
  }, [projectId]);

  // The desktop takes a while to finish opening one, so the badge catches up on its own.
  useAutoRefresh(load, 10000);

  const post = async (body: Record<string, string>) => {
    const res = await apiFetch(`/api/projects/${projectId}/worktrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.worktrees) setWorktrees(data.worktrees);
    if (res.ok) router.push(`/app/p/${data.projectId}?tab=pinboard`);
    return res.ok;
  };

  const open = async (worktree: Worktree) => {
    setOpening(worktree.name);
    try {
      await post({ name: worktree.name });
    } finally {
      setOpening(null);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      if (await post({ branch: newBranch })) setNewBranch('');
    } finally {
      setCreating(false);
    }
  };

  const busy = creating || opening !== null;

  // The branch is created off main, and the changes sitting in the main checkout stay there:
  // wtman puts both of those questions to a person at a terminal, and there is nobody here.
  const createBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (newBranch.trim() !== '' && !busy) create();
      }}
      className="flex gap-2"
    >
      <input
        value={newBranch}
        onChange={(e) => setNewBranch(e.target.value)}
        placeholder="New branch, off main"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1 min-w-0 px-3 py-2 text-sm bg-foreground/5 border border-foreground/15 rounded outline-none focus:border-foreground/40"
      />
      <button
        type="submit"
        disabled={newBranch.trim() === '' || busy}
        className="shrink-0 px-3 py-2 text-sm bg-blue-600 text-white rounded active:opacity-80 disabled:opacity-40"
      >
        {creating ? 'Creating…' : 'Create'}
      </button>
    </form>
  );

  if (error) {
    return (
      <div className="p-4 space-y-2 text-center">
        <div className="text-red-500">Could not read worktrees</div>
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

  if (!worktrees) {
    return (
      <div className="p-4 text-center text-foreground/50">
        Loading worktrees...
      </div>
    );
  }

  if (worktrees.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {createBox}
        <div className="text-center text-foreground/50">
          No worktrees checked out for this project yet.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {createBox}
      {worktrees.map((worktree) => {
        const isCurrent = worktree.projectId === currentProjectId;
        return (
          <div
            key={worktree.name}
            className={`p-3 border rounded-lg ${
              isCurrent
                ? 'border-foreground/30 bg-foreground/10'
                : 'border-foreground/10 bg-foreground/5'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{worktree.name}</div>
                <div className="text-xs text-foreground/50 truncate">
                  {worktree.branch ?? 'detached HEAD'} ·{' '}
                  {relativeTime(worktree.touchedAt)}
                </div>
              </div>
              {isCurrent ? (
                <span className="shrink-0 text-xs text-foreground/50">
                  You are here
                </span>
              ) : worktree.open ? (
                <button
                  onClick={() =>
                    router.push(`/app/p/${worktree.projectId}?tab=pinboard`)
                  }
                  className="shrink-0 px-2 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80"
                >
                  Go to
                </button>
              ) : (
                <button
                  onClick={() => open(worktree)}
                  disabled={busy || worktree.branch === null}
                  className="shrink-0 px-2 py-1.5 text-xs bg-blue-600 text-white rounded active:opacity-80 disabled:opacity-40"
                >
                  {opening === worktree.name ? 'Opening…' : 'Open'}
                </button>
              )}
            </div>

            <div className="mt-2 text-xs">
              {worktree.open ? (
                <span className="text-green-500">Open on the desktop</span>
              ) : (
                <span className="text-foreground/40 break-all">
                  {worktree.path}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-foreground/40 pt-1">
        Every worktree git still knows about, whether or not it is open. Opening
        one starts its editor and terminal at the desktop, which is also what
        gives it a project of its own here. Removing or merging one is{' '}
        <code className="px-1 bg-foreground/10 rounded">wtman menu</code> at the
        desktop: both ask before they act.
      </p>
    </div>
  );
}
