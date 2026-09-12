'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { addToast, apiFetch } from '../../lib/api';
import { relativeTime } from '../../lib/relative-time';
import { useAutoRefresh } from '../../lib/use-auto-refresh';

interface StagedFile {
  path: string;
  status: string;
}

interface StagedSummary {
  files: StagedFile[];
  insertions: number;
  deletions: number;
}

interface PendingCommit {
  id: string;
  repo: string;
  cwd: string | null;
  message: string;
  createdAt: string;
  source: string;
  windowId: string | null;
  closeSession: boolean;
  staged: StagedSummary | null;
  insideProject: string | null;
}

function repoName(repoPath: string): string {
  return repoPath.split('/').filter(Boolean).pop() || repoPath;
}

function shortPath(repoPath: string): string {
  return repoPath.replace(/^\/home\/[^/]+/, '~');
}

/**
 * The commits `gg kitty-commit` parked for repositories no project answers for — a dataset,
 * a submodule, anything rworkspaces holds no entry for. One whose repository *is* a project
 * is announced on that project's card instead, which is why nothing here needs a name for
 * the difference: what has a card is on it, and what has none is here.
 */
export function PendingCommits({ onCommitted }: { onCommitted: () => void }) {
  const [commits, setCommits] = useState<PendingCommit[]>([]);
  const [open, setOpen] = useState<PendingCommit | null>(null);
  const [message, setMessage] = useState('');
  const [committing, setCommitting] = useState(false);

  const fetchCommits = useCallback(async () => {
    const res = await fetch('/api/pending-commits');
    if (!res.ok) return;
    const data = await res.json();
    setCommits(data.commits);
  }, []);

  useAutoRefresh(fetchCommits, 15000);

  const openCommit = (pending: PendingCommit) => {
    setMessage(pending.message);
    setOpen(pending);
  };

  const accept = async () => {
    if (!open) return;
    setCommitting(true);
    try {
      const res = await apiFetch('/api/pending-commits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: open.id, message }),
      });
      // A commit that failed leaves the message parked, and the box open on the text to fix.
      if (!res.ok) return;
      addToast(`Committed in ${repoName(open.repo)}`, 'success');
      setOpen(null);
      await fetchCommits();
      onCommitted();
    } finally {
      setCommitting(false);
    }
  };

  // Rejecting means the work is not done, so the session that parked it is left alone.
  const reject = async () => {
    if (!open) return;
    const res = await apiFetch(
      `/api/pending-commits?pending=${encodeURIComponent(open.id)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) return;
    setOpen(null);
    addToast('Commit rejected', 'success');
    fetchCommits();
  };

  if (commits.length === 0) return null;

  const nothingStaged = open?.staged?.files.length === 0;

  return (
    <>
      <section>
        <h2 className="text-sm font-medium text-blue-400 mb-2">
          Pending Commits
        </h2>
        <div className="space-y-2">
          {commits.map((pending) => {
            const [title] = pending.message.split('\n');
            return (
              <button
                key={pending.id}
                onClick={() => openCommit(pending)}
                className="w-full text-left p-3 rounded-lg border border-blue-500/40 bg-blue-500/10 active:opacity-80"
              >
                <div className="flex items-center gap-2 text-xs text-foreground/50">
                  <span className="font-medium text-blue-400">
                    {repoName(pending.repo)}
                  </span>
                  <span>{relativeTime(pending.createdAt)}</span>
                  {pending.staged === null && (
                    <span className="text-red-400">no checkout</span>
                  )}
                </div>
                <div className="mt-1 text-sm line-clamp-2">{title}</div>
                <div className="mt-1 text-xs text-foreground/40 truncate">
                  {shortPath(pending.repo)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setOpen(null)}
          >
            <div
              className="bg-background border border-foreground/20 rounded-lg shadow-xl w-full max-w-lg max-h-full flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-foreground/10">
                <h3 className="font-medium">{repoName(open.repo)}</h3>
                <div className="text-xs text-foreground/50 truncate">
                  {shortPath(open.repo)}
                </div>
                {open.insideProject && (
                  <div className="text-xs text-foreground/40 mt-0.5">
                    inside {open.insideProject} — its own repository, committed
                    on its own
                  </div>
                )}
              </div>

              <div className="px-4 py-3 overflow-y-auto space-y-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background font-mono"
                />

                {/* No Changes tab stands behind these repositories, so this is the only
                    look at the tree the message is describing. */}
                {open.staged === null ? (
                  <div className="text-xs text-red-400">
                    {shortPath(open.repo)} is not on disk. The message can only
                    be rejected.
                  </div>
                ) : nothingStaged ? (
                  <div className="text-xs text-red-400">
                    Nothing is staged — this work was committed some other way,
                    and the message outlived it.
                  </div>
                ) : (
                  <div className="text-xs">
                    <div className="text-foreground/50 mb-1">
                      {open.staged.files.length} file
                      {open.staged.files.length === 1 ? '' : 's'} staged
                      <span className="text-green-500 ml-2">
                        +{open.staged.insertions}
                      </span>
                      <span className="text-red-500 ml-1">
                        −{open.staged.deletions}
                      </span>
                    </div>
                    <div className="font-mono text-foreground/70 space-y-0.5 max-h-40 overflow-y-auto">
                      {open.staged.files.map((file) => (
                        <div key={file.path} className="truncate">
                          <span className="text-foreground/40 mr-2">
                            {file.status}
                          </span>
                          {file.path}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-foreground/10 flex items-center justify-between gap-2">
                <button
                  onClick={reject}
                  className="px-3 py-1.5 text-sm rounded-lg text-red-500 hover:bg-red-500/10"
                >
                  Reject
                </button>
                <button
                  onClick={accept}
                  disabled={
                    committing ||
                    !message.trim() ||
                    open.staged === null ||
                    nothingStaged
                  }
                  className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
                >
                  {committing ? 'Committing...' : 'Commit'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
