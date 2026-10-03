'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { addToast, apiFetch } from '../../lib/api';
import { copyText } from '../../lib/clipboard';
import { relativeTime } from '../../lib/relative-time';
import { useAutoRefresh } from '../../lib/use-auto-refresh';
import { CollapsedRows } from './CollapsedRows';
import { KebabMenu, KebabMenuItem } from './KebabMenu';
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
  path: string;
  clean: boolean | null;
}

/**
 * Whether the tree the briefing would run in is carrying uncommitted work. A session launched on
 * a dirty one mixes its changes with whatever was already there, which is the difference between
 * watching what it did and picking it out afterwards — so the answer is on the row, before
 * anything is opened, and again beside the Launch button.
 */
function CleanBadge({ clean }: { clean: boolean | null }) {
  const base = 'px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0';
  if (clean === true) {
    return (
      <span className={`${base} bg-emerald-400/15 text-emerald-400`}>
        clean
      </span>
    );
  } else if (clean === false) {
    return (
      <span className={`${base} bg-yellow-400/20 text-yellow-400`}>dirty</span>
    );
  } else if (clean === null) {
    return (
      <span className={`${base} bg-foreground/10 text-foreground/50`}>
        no git
      </span>
    );
  } else {
    throw new Error(`Unexpected cleanliness: ${clean}`);
  }
}

function HandoffKebabMenu({
  handoff,
  onPinned,
}: {
  handoff: PendingHandoff;
  onPinned: () => void;
}) {
  const moveToPinboard = async () => {
    const res = await apiFetch('/api/handoffs/pinboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoffId: handoff.id }),
    });
    if (!res.ok) return;
    addToast(`Moved to ${handoff.projectId}'s pinboard`, 'success');
    onPinned();
  };

  const copyPath = async () => {
    if (await copyText(handoff.path)) addToast('Copied the path', 'success');
    else addToast('Could not copy to the clipboard');
  };

  return (
    <KebabMenu label={`Actions for the ${handoff.projectId} handoff`}>
      <KebabMenuItem onSelect={moveToPinboard}>Move to pinboard</KebabMenuItem>
      <KebabMenuItem onSelect={copyPath}>Copy path</KebabMenuItem>
    </KebabMenu>
  );
}

/**
 * The handoffs `claudex handoff` parked for the user to read before anything runs on them. They
 * lead the front page rather than sitting on one project's tab: a briefing waiting for a session
 * to be started is an announcement, and nothing announces it if it has to be gone looking for.
 */
export function PendingHandoffs({
  hidden,
  onLaunched,
}: {
  hidden: boolean;
  onLaunched: () => void;
}) {
  const [handoffs, setHandoffs] = useState<PendingHandoff[]>([]);
  // The open handoff is held by id and read back out of the list, so its git status keeps up
  // with the refresh while the box is up — cleaning the tree up in another tab and coming back
  // shows clean — and a handoff launched from the desktop closes the box instead of going stale.
  const [openId, setOpenId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ClaudeMode>(DEFAULT_CLAUDE_MODE);
  const [launching, setLaunching] = useState(false);

  const open = handoffs.find((handoff) => handoff.id === openId) ?? null;

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
    setOpenId(handoff.id);
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
      setOpenId(null);
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
    setOpenId(null);
    addToast('Handoff deleted', 'success');
    fetchHandoffs();
  };

  if (handoffs.length === 0 || hidden) return null;

  return (
    <>
      <section>
        <h2 className="text-sm font-medium text-amber-300 mb-2">
          Claude Handoff
          <span className="ml-1.5 text-amber-300/60">{handoffs.length}</span>
        </h2>
        <CollapsedRows
          items={handoffs}
          toggleClassName="text-amber-300/80"
          renderItem={(handoff) => {
            const [title] = handoff.prompt.split('\n');
            return (
              <div
                key={handoff.id}
                className="flex items-center gap-1 pr-4 rounded-lg border border-amber-500/40 bg-amber-500/10"
              >
                <button
                  onClick={() => openHandoff(handoff)}
                  className="flex-1 min-w-0 text-left p-3 active:opacity-80"
                >
                  <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span className="font-medium text-amber-300">
                      {handoff.projectId}
                    </span>
                    <CleanBadge clean={handoff.clean} />
                    <span>{relativeTime(handoff.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-sm line-clamp-2">{title}</div>
                </button>
                <HandoffKebabMenu handoff={handoff} onPinned={fetchHandoffs} />
              </div>
            );
          }}
        />
      </section>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setOpenId(null)}
          >
            <div
              className="bg-background border border-foreground/20 rounded-lg shadow-xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-foreground/10">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{open.projectId}</h3>
                      <CleanBadge clean={open.clean} />
                    </div>
                    <div className="text-xs text-foreground/50 truncate">
                      {open.directory}
                    </div>
                  </div>
                  <HandoffKebabMenu handoff={open} onPinned={fetchHandoffs} />
                </div>
                {/* Dirty is a warning and not a refusal — the briefing may well be about those
                    very changes — so the Changes tab is one tap away and Launch stays live. The
                    handoff waits parked either way; only the edits in the box are lost. */}
                {open.clean === false && (
                  <Link
                    href={`/app/p/${open.projectId}?tab=changes`}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-yellow-400 active:opacity-80"
                  >
                    Uncommitted changes here — open Changes
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                )}
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
