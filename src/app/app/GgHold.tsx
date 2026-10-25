'use client';

import { addToast, apiFetch } from '@/lib/api';
import { Modal } from './Modal';
import { projectApiPath } from '@/lib/project-paths';

export function HoldBadge() {
  return (
    <span
      className="flex items-center gap-1 shrink-0 whitespace-nowrap text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400"
      aria-label="Autopush and auto-pull held"
      title="Autopush and auto-pull held"
    >
      <svg
        className="w-2.5 h-2.5"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
      </svg>
      gg hold
    </span>
  );
}

export function ReleaseHoldModal({
  projectId,
  hold,
  onCancel,
  onReleased,
}: {
  projectId: string;
  hold: string[];
  onCancel: () => void;
  onReleased: () => void;
}) {
  const release = async () => {
    const res = await apiFetch(`${projectApiPath(projectId)}/hold`, {
      method: 'DELETE',
    });
    if (!res.ok) return;
    addToast(`Released ${projectId}: autopush and auto-pull resume`, 'success');
    onReleased();
  };

  return (
    <Modal heading="Release the hold?" subtitle={projectId} onClose={onCancel}>
      <div className="px-4 py-3 space-y-3 text-sm text-foreground/70">
        <p>
          Autopush and auto-pull resume for every worktree and branch of the
          repository. Release once the rewind has settled — force-pushed, if the
          dropped commits had reached origin — or the next auto-rebase brings
          them back.
        </p>
        {hold.length > 0 && (
          <ul className="space-y-1.5 font-mono text-xs text-foreground/60 break-all">
            {hold.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
        <button
          data-modal-cancel
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Cancel
        </button>
        <button
          onClick={release}
          className="px-3 py-1.5 text-sm rounded-lg bg-red-500/15 text-red-500 active:bg-red-500/25"
        >
          Release
        </button>
      </div>
    </Modal>
  );
}
