'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api';
import { RecentCommits } from './RecentCommits';

function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      className={`w-4 h-4 ${direction === 'down' ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function splitMessage(message: string): { title: string; body: string } {
  const [subject, ...rest] = message.split('\n');
  return { title: subject.trim(), body: rest.join('\n').trim() };
}

function joinMessage(title: string, body: string): string {
  return body.trim() ? `${title.trim()}\n\n${body.trim()}` : title.trim();
}

export function CommitView({
  projectId,
  onRefresh,
  commitTitle,
  setCommitTitle,
  commitBody,
  setCommitBody,
  pendingSource,
  setPendingSource,
  pendingLoaded,
  setPendingLoaded,
}: {
  projectId: string;
  onRefresh: () => void;
  commitTitle: string;
  setCommitTitle: (title: string) => void;
  commitBody: string;
  setCommitBody: (body: string) => void;
  pendingSource: string | null;
  setPendingSource: (source: string | null) => void;
  pendingLoaded: boolean;
  setPendingLoaded: (loaded: boolean) => void;
}) {
  const [shortenVariants, setShortenVariants] = useState<string[]>([]);
  const [showShortenModal, setShowShortenModal] = useState(false);
  // Bumped after commit/pull/push, to remount the commit list with fresh data.
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (pendingLoaded) return;
    async function checkPending() {
      const res = await fetch(`/api/projects/${projectId}/pending-message`);
      const data = await res.json();
      if (data.pending) {
        const { title, body } = splitMessage(data.pending.message);
        setCommitTitle(title);
        setCommitBody(body);
        setPendingSource(data.pending.source);
      }
      setPendingLoaded(true);
    }
    checkPending();
  }, [
    projectId,
    pendingLoaded,
    setCommitTitle,
    setCommitBody,
    setPendingSource,
    setPendingLoaded,
  ]);

  const clearPendingMessage = async () => {
    await apiFetch(`/api/projects/${projectId}/pending-message`, {
      method: 'DELETE',
    });
    setCommitTitle('');
    setCommitBody('');
    setPendingSource(null);
  };

  const handleAction = async (action: string, body?: object) => {
    const res = await apiFetch(`/api/projects/${projectId}/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) return;
    setHistoryKey((key) => key + 1);
    if (action === 'commit') {
      setCommitTitle('');
      setCommitBody('');
      if (pendingSource) {
        await apiFetch(`/api/projects/${projectId}/pending-message`, {
          method: 'DELETE',
        });
        setPendingSource(null);
      }
    }
    onRefresh();
  };

  const generateCommitMessage = async () => {
    const res = await apiFetch(
      `/api/projects/${projectId}/git?action=diff-summary`
    );
    const data = await res.json();
    if (data.summary) {
      const { title, body } = splitMessage(data.summary);
      setCommitTitle(title);
      setCommitBody(body);
    }
  };

  const shortenCommitTitle = async () => {
    const res = await apiFetch(
      `/api/projects/${projectId}/git?action=shorten-message&message=${encodeURIComponent(commitTitle)}`
    );
    const data = await res.json();
    if (data.variants) {
      setShortenVariants(data.variants);
      setShowShortenModal(true);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground/60">Commit</h3>
            {pendingSource && (
              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                from {pendingSource}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pendingSource && (
              <button
                onClick={clearPendingMessage}
                className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded active:opacity-80"
              >
                Clear
              </button>
            )}
            <button
              onClick={shortenCommitTitle}
              disabled={commitTitle.trim() === ''}
              className="px-2 py-1 text-xs bg-foreground/10 rounded active:opacity-80 disabled:opacity-30"
            >
              Shorten
            </button>
            <button
              onClick={generateCommitMessage}
              disabled={commitTitle.trim() !== '' || commitBody.trim() !== ''}
              className="px-2 py-1 text-xs bg-foreground/10 rounded active:opacity-80 disabled:opacity-30"
            >
              Generate
            </button>
          </div>
        </div>
        <textarea
          value={commitTitle}
          onChange={(e) => setCommitTitle(e.target.value.replace(/\n/g, ' '))}
          placeholder="Title..."
          className="w-full p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-sm resize-none h-16"
        />
        <textarea
          value={commitBody}
          onChange={(e) => setCommitBody(e.target.value)}
          placeholder="Body (optional)..."
          className="mt-2 w-full p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-sm resize-none h-32"
        />
        <button
          onClick={() =>
            handleAction('commit', {
              message: joinMessage(commitTitle, commitBody),
            })
          }
          disabled={!commitTitle.trim()}
          className="mt-2 w-full py-2.5 text-sm bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:bg-foreground/10 disabled:text-foreground/40"
        >
          Commit
        </button>
      </section>

      <RecentCommits key={historyKey} projectId={projectId} />

      <section>
        <h3 className="text-sm font-medium text-foreground/60 mb-3">Sync</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction('pull')}
            className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg active:opacity-80"
          >
            <ArrowIcon direction="down" />
            Pull
          </button>
          <button
            onClick={() => handleAction('push')}
            className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg active:opacity-80"
          >
            <ArrowIcon direction="up" />
            Push
          </button>
        </div>
      </section>

      {showShortenModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowShortenModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-lg w-full">
              <div className="px-4 py-3 border-b border-foreground/10">
                <h3 className="font-medium">Select shortened title</h3>
              </div>
              <div className="py-2 space-y-1">
                {shortenVariants.map((variant, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCommitTitle(variant);
                      setShowShortenModal(false);
                    }}
                    className="block w-full px-4 py-3 text-sm text-left hover:bg-foreground/10 whitespace-pre-wrap"
                  >
                    {variant}
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-foreground/10 flex justify-end">
                <button
                  onClick={() => setShowShortenModal(false)}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
