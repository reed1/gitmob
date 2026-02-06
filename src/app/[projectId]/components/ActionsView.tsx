'use client';

import { useState, useEffect } from 'react';

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
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
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
  }, [projectId, pendingLoaded, setCommitMessage, setPendingSource, setPendingLoaded]);

  const clearPendingMessage = async () => {
    await fetch(`/api/projects/${projectId}/pending-message`, {
      method: 'DELETE',
    });
    setCommitMessage('');
    setPendingSource(null);
    setPendingShortOptions([]);
  };

  const handleAction = async (action: string, body?: object) => {
    setLoading(action);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/git`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error || 'Request failed'}`);
        return;
      }
      setResult(data.result || 'Success');
      if (action === 'commit') {
        setCommitMessage('');
        if (pendingSource) {
          await fetch(`/api/projects/${projectId}/pending-message`, {
            method: 'DELETE',
          });
          setPendingSource(null);
          setPendingShortOptions([]);
        }
      }
      onRefresh();
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const generateCommitMessage = async () => {
    setLoading('generate');
    const res = await fetch(
      `/api/projects/${projectId}/git?action=diff-summary`
    );
    const data = await res.json();
    if (data.summary) {
      setCommitMessage(data.summary);
    }
    setLoading(null);
  };

  const shortenCommitMessage = async () => {
    if (pendingSource && pendingShortOptions.length > 0) {
      setShortenVariants(pendingShortOptions);
      setShowShortenModal(true);
      return;
    }
    setLoading('shorten');
    const res = await fetch(
      `/api/projects/${projectId}/git?action=shorten-message&message=${encodeURIComponent(commitMessage)}`
    );
    const data = await res.json();
    if (data.variants) {
      setShortenVariants(data.variants);
      setShowShortenModal(true);
    }
    setLoading(null);
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
              disabled={loading === 'shorten' || commitMessage.trim() === ''}
              className="px-2 py-1 text-xs bg-foreground/10 rounded active:opacity-80 disabled:opacity-30"
            >
              {loading === 'shorten' ? 'Shortening...' : 'Shorten'}
            </button>
            <button
              onClick={generateCommitMessage}
              disabled={loading === 'generate' || commitMessage.trim() !== ''}
              className="px-2 py-1 text-xs bg-foreground/10 rounded active:opacity-80 disabled:opacity-30"
            >
              {loading === 'generate' ? 'Generating...' : 'Generate'}
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
          disabled={loading === 'commit' || !commitMessage.trim()}
          className="mt-2 w-full py-3 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-50"
        >
          {loading === 'commit' ? 'Committing...' : 'Commit'}
        </button>
      </section>

      <section>
        <h3 className="text-sm font-medium text-foreground/60 mb-3">Sync</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('pull')}
            disabled={loading === 'pull'}
            className="py-3 bg-blue-600 text-white font-medium rounded-lg active:opacity-80 disabled:opacity-50"
          >
            {loading === 'pull' ? 'Pulling...' : 'Pull'}
          </button>
          <button
            onClick={() => handleAction('push')}
            disabled={loading === 'push'}
            className="py-3 bg-green-600 text-white font-medium rounded-lg active:opacity-80 disabled:opacity-50"
          >
            {loading === 'push' ? 'Pushing...' : 'Push'}
          </button>
        </div>
      </section>

      {result && (
        <section>
          <h3 className="text-sm font-medium text-foreground/60 mb-2">
            Result
          </h3>
          <pre className="p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-auto max-h-48">
            {result}
          </pre>
        </section>
      )}

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
