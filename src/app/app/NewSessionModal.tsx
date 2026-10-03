'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { launchDesktopSession } from '../../lib/desktop-client';
import {
  CLAUDE_MODES,
  ClaudeMode,
  DEFAULT_CLAUDE_MODE,
} from '../../lib/desktop-modes';
import { Modal } from './Modal';
import { SpeakButton, appendSpoken } from './SpeakButton';

/**
 * The one way a Claude session is started from this app — the project card's menu on the front
 * page, the Claude tab and a pinboard note (its text as the opening prompt) all open this. Mode,
 * opening prompt and dictation sit behind the one button, the same trade every other thing sent
 * to a session already makes. A second composer only means the two drift: the front page kept
 * its own for a while, and it was the one without a Speak button.
 *
 * Worktree opens the session in a new worktree instead, on a branch forked off main — named by
 * hand, or suggested from the opening prompt. A worktree is a project of its own, so the page
 * moves to it once the session is up.
 */
export function NewSessionModal({
  projectId,
  canonicalId,
  initialPrompt = '',
  onClose,
  onLaunched,
}: {
  projectId: string;
  canonicalId: string;
  initialPrompt?: string;
  onClose: () => void;
  onLaunched?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ClaudeMode>(DEFAULT_CLAUDE_MODE);
  const [inWorktree, setInWorktree] = useState(false);
  const [branch, setBranch] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [launching, setLaunching] = useState(false);

  const missingBranch = inWorktree && branch.trim() === '';

  const suggestBranch = async () => {
    setSuggesting(true);
    try {
      const res = await apiFetch('/api/branch-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt }),
      });
      if (res.ok) setBranch((await res.json()).branch);
    } finally {
      setSuggesting(false);
    }
  };

  const launch = async () => {
    setLaunching(true);
    try {
      const launchedIn = await launchDesktopSession(
        projectId,
        mode,
        prompt.trim(),
        inWorktree ? branch.trim() : ''
      );
      if (launchedIn === null) return;

      onClose();
      if (launchedIn === projectId) {
        onLaunched?.();
      } else {
        router.push(`/app/p/${launchedIn}?tab=claude`);
      }
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Modal
      heading={inWorktree ? 'New session in a worktree' : 'New session'}
      subtitle={projectId}
      onClose={onClose}
    >
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ClaudeMode)}
            className="flex-1 min-w-0 text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2"
          >
            {CLAUDE_MODES.map((entry) => (
              <option key={entry.mode} value={entry.mode}>
                {entry.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setInWorktree(!inWorktree)}
            aria-pressed={inWorktree}
            className={`shrink-0 px-3 py-2 text-sm rounded-lg border ${
              inWorktree
                ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
                : 'bg-foreground/10 border-foreground/15 active:bg-foreground/20'
            }`}
          >
            Worktree
          </button>
        </div>
        {inWorktree && (
          <div className="flex gap-2">
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="New branch, off main"
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 min-w-0 text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2"
            />
            <button
              onClick={suggestBranch}
              disabled={prompt.trim() === '' || suggesting}
              title="Name it from the opening prompt"
              aria-label="Name the branch from the opening prompt"
              className="shrink-0 px-3 py-2 rounded-lg bg-foreground/10 border border-foreground/15 active:bg-foreground/20 disabled:opacity-40"
            >
              <svg
                className={`w-4 h-4 ${suggesting ? 'animate-pulse' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </button>
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Opening prompt (optional)"
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-y"
        />
        <div className="flex items-center justify-between gap-2">
          <SpeakButton
            projectId={canonicalId}
            onText={(spoken) => setPrompt((prev) => appendSpoken(prev, spoken))}
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Cancel
            </button>
            <button
              onClick={launch}
              disabled={launching || missingBranch}
              className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              {launching
                ? inWorktree
                  ? 'Creating...'
                  : 'Starting...'
                : 'Start'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
