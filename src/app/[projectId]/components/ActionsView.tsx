'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api';

export function ActionsView({
  projectId,
  onRefresh,
  commitMessage,
  setCommitMessage,
  pendingSource,
  setPendingSource,
  pendingLoaded,
  setPendingLoaded,
}: {
  projectId: string;
  onRefresh: () => void;
  commitMessage: string;
  setCommitMessage: (msg: string) => void;
  pendingSource: string | null;
  setPendingSource: (source: string | null) => void;
  pendingLoaded: boolean;
  setPendingLoaded: (loaded: boolean) => void;
}) {
  const [shortenVariants, setShortenVariants] = useState<string[]>([]);
  const [showShortenModal, setShowShortenModal] = useState(false);
  const [pendingShortOptions, setPendingShortOptions] = useState<string[]>([]);

  useEffect(() => {
    if (pendingLoaded) return;
    async function checkPending() {
      const res = await fetch(`/api/projects/${projectId}/pending-message`);
      const data = await res.json();
      if (data.pending) {
        setCommitMessage(data.pending.message);
        setPendingSource(data.pending.source);
        setPendingShortOptions(data.pending.short_options ?? []);
      }
      setPendingLoaded(true);
    }
    checkPending();
  }, [
    projectId,
    pendingLoaded,
    setCommitMessage,
    setPendingSource,
    setPendingLoaded,
  ]);

  const clearPendingMessage = async () => {
    await apiFetch(`/api/projects/${projectId}/pending-message`, {
      method: 'DELETE',
    });
    setCommitMessage('');
    setPendingSource(null);
    setPendingShortOptions([]);
  };

  const handleAction = async (action: string, body?: object) => {
    const res = await apiFetch(`/api/projects/${projectId}/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) return;
    if (action === 'commit') {
      setCommitMessage('');
      if (pendingSource) {
        await apiFetch(`/api/projects/${projectId}/pending-message`, {
          method: 'DELETE',
        });
        setPendingSource(null);
        setPendingShortOptions([]);
      }
    }
    onRefresh();
  };

  const generateCommitMessage = async () => {
    const res = await fetch(
      `/api/projects/${projectId}/git?action=diff-summary`
    );
    const data = await res.json();
    if (data.summary) {
      setCommitMessage(data.summary);
    }
  };

  const shortenCommitMessage = async () => {
    if (pendingSource && pendingShortOptions.length > 0) {
      setShortenVariants(pendingShortOptions);
      setShowShortenModal(true);
      return;
    }
    const res = await fetch(
      `/api/projects/${projectId}/git?action=shorten-message&message=${encodeURIComponent(commitMessage)}`
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
              onClick={shortenCommitMessage}
              disabled={commitMessage.trim() === ''}
              className="px-2 py-1 text-xs bg-foreground/10 rounded active:opacity-80 disabled:opacity-30"
            >
              Shorten
            </button>
            <button
              onClick={generateCommitMessage}
              disabled={commitMessage.trim() !== ''}
              className="px-2 py-1 text-xs bg-foreground/10 rounded active:opacity-80 disabled:opacity-30"
            >
              Generate
            </button>
          </div>
        </div>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className="w-full p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-sm resize-none h-24"
        />
        <button
          onClick={() => handleAction('commit', { message: commitMessage })}
          disabled={!commitMessage.trim()}
          className="mt-2 w-full py-3 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-50"
        >
          Commit
        </button>
      </section>

      <section>
        <h3 className="text-sm font-medium text-foreground/60 mb-3">Sync</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('pull')}
            className="py-3 bg-blue-600 text-white font-medium rounded-lg active:opacity-80 disabled:opacity-50"
          >
            Pull
          </button>
          <button
            onClick={() => handleAction('push')}
            className="py-3 bg-green-600 text-white font-medium rounded-lg active:opacity-80 disabled:opacity-50"
          >
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
                <h3 className="font-medium">Select shortened message</h3>
              </div>
              <div className="py-2 space-y-1">
                {shortenVariants.map((variant, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCommitMessage(variant);
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
