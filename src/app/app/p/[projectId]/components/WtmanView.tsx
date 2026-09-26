'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { addToast, apiFetch } from '../../../../../lib/api';
import { relativeTime } from '../../../../../lib/relative-time';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';
import { useOutsideClick } from '../../../../../lib/use-outside-click';
import { Modal } from '../../../Modal';

interface Worktree {
  name: string;
  branch: string | null;
  path: string;
  touchedAt: string;
  projectId: string;
  open: boolean;
  dirty: boolean;
  into: string | null;
  ahead: number;
  state: 'merged' | 'no-commits' | 'unmerged' | null;
}

type Pending =
  | { kind: 'merge'; worktree: Worktree; squash: boolean }
  | { kind: 'remove'; worktree: Worktree; removeBranch: boolean };

function isMerged(worktree: Worktree): boolean {
  return worktree.state === 'merged' || worktree.state === 'no-commits';
}

function MergeBadge({ worktree }: { worktree: Worktree }) {
  const badges: { text: string; className: string }[] = [];

  if (worktree.state === 'merged') {
    badges.push({
      text: 'merged',
      className: 'bg-green-500/15 text-green-500',
    });
  } else if (worktree.state === 'no-commits') {
    badges.push({
      text: 'no commits',
      className: 'bg-foreground/10 text-foreground/50',
    });
  } else if (worktree.state === 'unmerged') {
    badges.push({
      text: `${worktree.ahead} not in ${worktree.into}`,
      className: 'bg-amber-500/15 text-amber-500',
    });
  } else if (worktree.state !== null) {
    throw new Error(`Unexpected merge state: ${worktree.state}`);
  }

  if (worktree.dirty) {
    badges.push({
      text: 'uncommitted',
      className: 'bg-red-500/15 text-red-500',
    });
  }

  return (
    <>
      {badges.map((badge) => (
        <span
          key={badge.text}
          className={`px-1.5 py-0.5 rounded text-[11px] leading-none ${badge.className}`}
        >
          {badge.text}
        </span>
      ))}
    </>
  );
}

function WorktreeMenu({
  worktree,
  isCurrent,
  disabled,
  onGoTo,
  onOpen,
  onPick,
}: {
  worktree: Worktree;
  isCurrent: boolean;
  disabled: boolean;
  onGoTo: () => void;
  onOpen: () => void;
  onPick: (pending: Pending) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(menuOpen, menuRef, () => setMenuOpen(false));

  // wtman refuses to delete a folder Cursor has open, since the window goes down with it.
  const blocked =
    worktree.branch === null
      ? 'detached HEAD'
      : worktree.open
        ? 'close it on the desktop first'
        : null;
  const into = worktree.into ?? 'main checkout';
  const canMerge = blocked === null && worktree.into !== null;

  const item = (
    label: string,
    onClick: () => void,
    enabled = true,
    danger = false
  ) => (
    <button
      key={label}
      onClick={() => {
        setMenuOpen(false);
        onClick();
      }}
      disabled={!enabled}
      className={`block w-full px-4 py-2 text-sm text-left whitespace-nowrap ${
        enabled
          ? `hover:bg-foreground/10 ${danger ? 'text-red-500' : ''}`
          : 'text-foreground/30 cursor-not-allowed'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        disabled={disabled}
        className="p-2 rounded-lg bg-foreground/10 active:bg-foreground/20 disabled:opacity-40"
        aria-label={`Actions for ${worktree.name}`}
      >
        <svg
          className="w-5 h-5 text-foreground/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01"
          />
        </svg>
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[200px]">
          {worktree.open
            ? item(isCurrent ? 'You are here' : 'Go to', onGoTo, !isCurrent)
            : item('Open', onOpen, worktree.branch !== null)}
          {item(
            `Merge into ${into}`,
            () => onPick({ kind: 'merge', worktree, squash: false }),
            canMerge
          )}
          {item(
            `Squash merge into ${into}`,
            () => onPick({ kind: 'merge', worktree, squash: true }),
            canMerge
          )}
          {item(
            'Remove worktree',
            () => onPick({ kind: 'remove', worktree, removeBranch: false }),
            blocked === null,
            true
          )}
          {item(
            'Remove worktree and branch',
            () => onPick({ kind: 'remove', worktree, removeBranch: true }),
            blocked === null,
            true
          )}
          {blocked && (
            <div className="px-4 pt-1 pb-2 text-xs text-foreground/40">
              Merge and remove: {blocked}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmModal({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { worktree } = pending;
  const into = worktree.into ?? 'the main checkout';
  const warnings: string[] = [];

  if (worktree.dirty) {
    warnings.push(
      'The worktree has uncommitted changes. They are deleted with it.'
    );
  }

  let heading: string;
  let body: string;
  let confirmLabel: string;

  if (pending.kind === 'merge') {
    heading = `${pending.squash ? 'Squash merge' : 'Merge'} into ${into}?`;
    body = `Backs the branch up, ${
      pending.squash ? 'squashes its commits into one commit' : 'merges it'
    } on ${into} in the main checkout, then removes the worktree and the branch. A conflict stops it before anything is removed.`;
    confirmLabel = pending.squash ? 'Squash merge' : 'Merge';
  } else if (pending.kind === 'remove') {
    heading = pending.removeBranch
      ? 'Remove worktree and branch?'
      : 'Remove worktree?';
    body = pending.removeBranch
      ? 'Deletes the checkout and the branch. wtman keeps a backup bundle of any commits not in main.'
      : 'Deletes the checkout. The branch stays, and can be opened again.';
    if (pending.removeBranch && !isMerged(worktree)) {
      warnings.push(
        worktree.state === 'unmerged'
          ? `${worktree.ahead} commit${worktree.ahead === 1 ? '' : 's'} not in ${into}: the branch is force deleted.`
          : 'Whether the branch is merged is unknown: it is force deleted.'
      );
    }
    confirmLabel = 'Remove';
  } else {
    throw new Error(`Unexpected action: ${(pending as Pending).kind}`);
  }

  return (
    <Modal heading={heading} subtitle={worktree.name} onClose={onCancel}>
      <div className="px-4 py-3 space-y-2 text-sm text-foreground/70">
        <p>{body}</p>
        {warnings.map((warning) => (
          <p key={warning} className="text-red-500">
            {warning}
          </p>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            pending.kind === 'remove' || warnings.length > 0
              ? 'bg-red-500/15 text-red-500 active:bg-red-500/25'
              : 'bg-blue-600 text-white active:opacity-80'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
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
  const [working, setWorking] = useState<{
    name: string;
    label: string;
  } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
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

  const post = async (url: string, body: object) => {
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.worktrees) setWorktrees(data.worktrees);
    return { ok: res.ok, projectId: data.projectId as string };
  };

  const act = async (worktree: Worktree, label: string, body: object) => {
    setWorking({ name: worktree.name, label });
    try {
      return await post(
        `/api/projects/${projectId}/worktrees/${encodeURIComponent(worktree.name)}`,
        body
      );
    } finally {
      setWorking(null);
    }
  };

  const open = async (worktree: Worktree) => {
    const { ok, projectId: opened } = await act(worktree, 'Opening…', {
      action: 'open',
    });
    if (ok) router.push(`/app/p/${opened}?tab=pinboard`);
  };

  const confirm = async (chosen: Pending) => {
    setPending(null);
    const { worktree } = chosen;

    if (chosen.kind === 'merge') {
      const { ok } = await act(worktree, 'Merging…', {
        action: 'merge',
        squash: chosen.squash,
      });
      if (ok)
        addToast(`Merged ${worktree.name} into ${worktree.into}`, 'success');
    } else if (chosen.kind === 'remove') {
      const { ok } = await act(worktree, 'Removing…', {
        action: 'remove',
        removeBranch: chosen.removeBranch,
        force: chosen.removeBranch && !isMerged(worktree),
      });
      if (ok) addToast(`Removed ${worktree.name}`, 'success');
    } else {
      throw new Error(`Unexpected action: ${(chosen as Pending).kind}`);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const { ok, projectId: created } = await post(
        `/api/projects/${projectId}/worktrees`,
        { branch: newBranch }
      );
      if (ok) {
        setNewBranch('');
        router.push(`/app/p/${created}?tab=pinboard`);
      }
    } finally {
      setCreating(false);
    }
  };

  const busy = creating || working !== null;

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
                <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
                  <MergeBadge worktree={worktree} />
                </div>
              </div>
              {working?.name === worktree.name ? (
                <span className="shrink-0 text-xs text-foreground/50">
                  {working.label}
                </span>
              ) : (
                <WorktreeMenu
                  worktree={worktree}
                  isCurrent={isCurrent}
                  disabled={busy}
                  onGoTo={() =>
                    router.push(`/app/p/${worktree.projectId}?tab=pinboard`)
                  }
                  onOpen={() => open(worktree)}
                  onPick={setPending}
                />
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
        gives it a project of its own here. Merging goes into whatever the main
        checkout is on, and removes the worktree and branch after; a worktree
        open on the desktop has to be closed before either.
      </p>

      {pending && (
        <ConfirmModal
          pending={pending}
          onCancel={() => setPending(null)}
          onConfirm={() => confirm(pending)}
        />
      )}
    </div>
  );
}
