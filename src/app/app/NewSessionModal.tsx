'use client';

import { saveTextHistory } from '@/lib/text-history';

import { SessionModelSelect, useSessionModel } from './SessionModelSelect';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { launchDesktopSession } from '@/lib/desktop-client';
import { useModelCatalog } from '@/lib/use-model-catalog';
import { Modal } from './Modal';
import { KebabMenu, KebabMenuItem } from './KebabMenu';
import { SpeakButton, appendSpoken } from './SpeakButton';
import {
  ImageUploadMenuItem,
  ImageUploads,
  useImageUploads,
  withImagePaths,
} from './ImageUploads';
import { projectPagePath } from '@/lib/project-paths';

/**
 * The one way a desktop session is started from this app — the project card's menu on the front
 * page, the Claude tab and a pinboard note (its text as the opening prompt) all open this.
 * Provider, opening prompt and dictation sit behind the one button, the same trade every other
 * thing sent to a session already makes. A second composer only means the two drift: the front page kept
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
  const { catalog, error: catalogError } = useModelCatalog();
  const [sessionModel, setSessionModel] = useSessionModel(catalog);
  const [inWorktree, setInWorktree] = useState(false);
  const [branch, setBranch] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [launching, setLaunching] = useState(false);

  const uploads = useImageUploads();

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
    if (!sessionModel || launching || missingBranch || uploads.pending) return;
    saveTextHistory({ text: prompt, source: 'New session', projectId });
    setLaunching(true);
    try {
      const launchedIn = await launchDesktopSession(
        projectId,
        sessionModel.provider,
        withImagePaths(uploads.images, prompt.trim()),
        inWorktree ? branch.trim() : '',
        { model: sessionModel.model, effort: sessionModel.effort }
      );
      if (launchedIn === null) return;

      onClose();
      if (launchedIn === projectId) {
        onLaunched?.();
      } else {
        router.push(`${projectPagePath(launchedIn)}?tab=claude`);
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
      guardDismiss={Boolean(prompt || branch || uploads.images.length)}
      menu={
        <KebabMenu label="Session options" disabled={launching}>
          <KebabMenuItem onSelect={() => setInWorktree(!inWorktree)}>
            <span
              className={`flex items-center gap-2 ${inWorktree ? 'text-blue-500' : ''}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="6" cy="5" r="3" />
                <circle cx="6" cy="19" r="3" />
                <circle cx="18" cy="5" r="3" />
                <path d="M6 8v8m12-8a8 8 0 0 1-8 8H6" />
              </svg>
              Worktree{inWorktree ? ' ✓' : ''}
            </span>
          </KebabMenuItem>
          <ImageUploadMenuItem uploads={uploads} />
        </KebabMenu>
      }
    >
      <div className="px-4 py-3 space-y-2">
        <SessionModelSelect
          catalog={catalog}
          error={catalogError}
          value={sessionModel}
          onChange={setSessionModel}
          disabled={launching}
        />
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
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-none"
        />
        <ImageUploads uploads={uploads} disabled={launching} />
        <div className="flex items-center justify-between gap-2">
          <SpeakButton
            projectId={canonicalId}
            onText={(spoken) => setPrompt((prev) => appendSpoken(prev, spoken))}
          />
          <div className="flex gap-2">
            <button
              data-modal-cancel
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Cancel
            </button>
            <button
              onClick={launch}
              disabled={
                !sessionModel || launching || missingBranch || uploads.pending
              }
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
