'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { addToast, apiFetch } from '../../lib/api';
import { relativeTime } from '../../lib/relative-time';
import { useAutoRefresh } from '../../lib/use-auto-refresh';
import {
  CLAUDE_MODES,
  ClaudeMode,
  DEFAULT_CLAUDE_MODE,
} from '../../lib/desktop-modes';

interface PendingHandoff {
  id: string;
  projectId: string;
  directory: string;
  prompt: string;
  createdAt: string;
}

/**
 * The handoffs `claudex handoff` parked because nobody was at the desktop to receive the window
 * it would have opened. They lead the front page rather than sitting on one project's tab: a
 * briefing waiting for a session to be started is an announcement, and nothing announces it if
 * it has to be gone looking for.
 */
export function PendingHandoffs({ onLaunched }: { onLaunched: () => void }) {
  const [handoffs, setHandoffs] = useState<PendingHandoff[]>([]);
  const [open, setOpen] = useState<PendingHandoff | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ClaudeMode>(DEFAULT_CLAUDE_MODE);
  const [launching, setLaunching] = useState(false);

  const fetchHandoffs = useCallback(async () => {
    const res = await fetch('/api/handoffs');
    if (!res.ok) return;
    const data = await res.json();
    setHandoffs(data.handoffs);
  }, []);

  useAutoRefresh(fetchHandoffs, 15000);

  const openHandoff = (handoff: PendingHandoff) => {
    setPrompt(handoff.prompt);
    setMode(DEFAULT_CLAUDE_MODE);
    setOpen(handoff);
  };

  const launch = async () => {
    if (!open) return;
    setLaunching(true);
    try {
      const res = await apiFetch('/api/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoffId: open.id, prompt, mode }),
      });
      // A launch that failed leaves the handoff parked, and the box open on the text to fix.
      if (!res.ok) return;
      const { name } = await res.json();
      addToast(`Started ${name}`, 'success');
      setOpen(null);
      await fetchHandoffs();
      onLaunched();
    } finally {
      setLaunching(false);
    }
  };

  const discard = async () => {
    if (!open) return;
    const res = await apiFetch(
      `/api/handoffs?handoff=${encodeURIComponent(open.id)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) return;
    setOpen(null);
    addToast('Handoff deleted', 'success');
    fetchHandoffs();
  };

  if (handoffs.length === 0) return null;

  return (
    <>
      <section>
        <h2 className="text-sm font-medium text-amber-300 mb-2">
          Claude Handoff
        </h2>
        <div className="space-y-2">
          {handoffs.map((handoff) => {
            const [title] = handoff.prompt.split('\n');
            return (
              <button
                key={handoff.id}
                onClick={() => openHandoff(handoff)}
                className="w-full text-left p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 active:opacity-80"
              >
                <div className="flex items-center gap-2 text-xs text-foreground/50">
                  <span className="font-medium text-amber-300">
                    {handoff.projectId}
                  </span>
                  <span>{relativeTime(handoff.createdAt)}</span>
                </div>
                <div className="mt-1 text-sm line-clamp-2">{title}</div>
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
              className="bg-background border border-foreground/20 rounded-lg shadow-xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-foreground/10">
                <h3 className="font-medium">{open.projectId}</h3>
                <div className="text-xs text-foreground/50 truncate">
                  {open.directory}
                </div>
              </div>
              <div className="px-4 py-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={12}
                  className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background font-mono"
                />
              </div>
              <div className="px-4 py-3 border-t border-foreground/10 flex items-center justify-between gap-2">
                <button
                  onClick={discard}
                  className="px-3 py-1.5 text-sm rounded-lg text-red-500 hover:bg-red-500/10"
                >
                  Delete
                </button>
                <div className="flex items-center gap-2">
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
                    disabled={launching || !prompt.trim()}
                    className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
                  >
                    {launching ? 'Starting...' : 'Launch'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
