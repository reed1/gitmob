'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { addToast, apiFetch } from '../../../../../lib/api';
import { relativeTime } from '../../../../../lib/relative-time';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';
import { KebabMenu, KebabMenuItem } from '../../../KebabMenu';
import { Modal } from '../../../Modal';

interface Worktree {
  name: string;
  branch: string;
  path: string;
  touchedAt: string;
  projectId: string;
  open: boolean;
  dirty: boolean;
  into: string | null;
  ahead: number;
  behind: number;
  state: 'merged' | 'no commits' | 'unmerged' | null;
  operation: 'rebase' | 'merge' | null;
  conflicts: string[];
}

type Pending =
  | { kind: 'merge'; worktree: Worktree; squash: boolean }
  | { kind: 'remove'; worktree: Worktree; removeBranch: boolean }
  | { kind: 'rebase'; worktree: Worktree }
  | { kind: 'abort-rebase'; worktree: Worktree }
  | { kind: 'sync'; worktree: Worktree };

function isMerged(worktree: Worktree): boolean {
  return worktree.state === 'merged' || worktree.state === 'no commits';
}

/** Why wtman would refuse to rebase it, or null when it would go ahead. */
function rebaseBlocked(worktree: Worktree): string | null {
  if (worktree.operation !== null) return `${worktree.operation} not finished`;
  if (worktree.into === null) return 'main checkout is detached';
  if (worktree.dirty) return 'commit the uncommitted changes first';
  if (worktree.behind === 0) return `already on top of ${worktree.into}`;
  return null;
}

/** Why wtman would refuse to sync it, or null when it would go ahead. The main checkout's own
 * uncommitted changes are not on the row, and only wtman refuses those. */
function syncBlocked(worktree: Worktree): string | null {
  if (worktree.operation !== null) return `${worktree.operation} not finished`;
  if (worktree.into === null) return 'main checkout is detached';
  if (worktree.dirty) return 'commit the uncommitted changes first';
  if (worktree.ahead === 0 && worktree.behind === 0)
    return `already on the same commit as ${worktree.into}`;
  return null;
}

function MergeBadge({ worktree }: { worktree: Worktree }) {
  const badges: { text: string; className: string }[] = [];

  if (worktree.operation !== null) {
    badges.push({
      text: `${worktree.operation} not finished`,
      className: 'bg-red-500/15 text-red-500',
    });
  }

  if (worktree.state === 'merged') {
    badges.push({
      text: 'merged',
      className: 'bg-green-500/15 text-green-500',
    });
  } else if (worktree.state === 'no commits') {
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

  if (worktree.behind > 0) {
    badges.push({
      text: `${worktree.behind} behind ${worktree.into}`,
      className: 'bg-foreground/10 text-foreground/50',
    });
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

function WorktreeKebabMenu({
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
  // wtman refuses to delete a folder Cursor has open, since the window goes down with it.
  const removeBlocked = worktree.open ? 'close it on the desktop first' : null;
  // A merge would take the branch as it was before the unfinished rebase began.
  const mergeBlocked =
    worktree.operation !== null
      ? `finish the ${worktree.operation} first`
      : removeBlocked;
  const into = worktree.into ?? 'main checkout';
  const canMerge = mergeBlocked === null && worktree.into !== null;
  const notRebasable = rebaseBlocked(worktree);
  const notSyncable = syncBlocked(worktree);

  const reasons: string[] = [];
  if (worktree.operation === null && notRebasable) {
    reasons.push(`Rebase: ${notRebasable}`);
  }
  if (worktree.operation === null && notSyncable) {
    reasons.push(`Merge sync: ${notSyncable}`);
  }
  if (mergeBlocked !== null && mergeBlocked === removeBlocked) {
    reasons.push(`Merge and remove: ${mergeBlocked}`);
  } else {
    if (mergeBlocked !== null) reasons.push(`Merge: ${mergeBlocked}`);
    if (removeBlocked !== null) reasons.push(`Remove: ${removeBlocked}`);
  }

  return (
    <KebabMenu label={`Actions for ${worktree.name}`} disabled={disabled}>
      {worktree.open ? (
        <KebabMenuItem onSelect={onGoTo} disabled={isCurrent}>
          {isCurrent ? 'You are here' : 'Go to'}
        </KebabMenuItem>
      ) : (
        <KebabMenuItem onSelect={onOpen}>Open</KebabMenuItem>
      )}
      {worktree.operation === 'rebase' ? (
        <KebabMenuItem
          onSelect={() => onPick({ kind: 'abort-rebase', worktree })}
          danger
        >
          Abort rebase
        </KebabMenuItem>
      ) : (
        <KebabMenuItem
          onSelect={() => onPick({ kind: 'rebase', worktree })}
          disabled={notRebasable !== null}
        >
          Rebase onto {into}
        </KebabMenuItem>
      )}
      <KebabMenuItem
        onSelect={() => onPick({ kind: 'sync', worktree })}
        disabled={notSyncable !== null}
      >
        Merge sync with {into}
      </KebabMenuItem>
      <KebabMenuItem
        onSelect={() => onPick({ kind: 'merge', worktree, squash: false })}
        disabled={!canMerge}
      >
        Merge into {into}
      </KebabMenuItem>
      <KebabMenuItem
        onSelect={() => onPick({ kind: 'merge', worktree, squash: true })}
        disabled={!canMerge}
      >
        Squash merge into {into}
      </KebabMenuItem>
      <KebabMenuItem
        onSelect={() =>
          onPick({ kind: 'remove', worktree, removeBranch: false })
        }
        disabled={removeBlocked !== null}
        danger
      >
        Remove worktree
      </KebabMenuItem>
      <KebabMenuItem
        onSelect={() =>
          onPick({ kind: 'remove', worktree, removeBranch: true })
        }
        disabled={removeBlocked !== null}
        danger
      >
        Remove worktree and branch
      </KebabMenuItem>
      {reasons.map((reason) => (
        <div key={reason} className="px-4 pt-1 pb-2 text-xs text-foreground/40">
          {reason}
        </div>
      ))}
    </KebabMenu>
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
  } else if (pending.kind === 'rebase') {
    heading = `Rebase onto ${into}?`;
    body = `Replays the branch's ${worktree.ahead} commit${worktree.ahead === 1 ? '' : 's'} on top of the ${worktree.behind} ${into} has gained, in the worktree. A conflict stops it there, unfinished, to be resolved in the worktree or aborted from here.`;
    confirmLabel = 'Rebase';
  } else if (pending.kind === 'abort-rebase') {
    heading = 'Abort the rebase?';
    body =
      'Puts the branch back where it was before the rebase began. Any conflict already resolved in the worktree is dropped with it.';
    confirmLabel = 'Abort rebase';
  } else if (pending.kind === 'sync') {
    heading = `Merge sync with ${into}?`;
    body = `Merges ${into} into the branch in the worktree, then fast-forwards ${into} in the main checkout to it, so both end on the same commit. The worktree stays. All or nothing: both checkouts must have no uncommitted changes, a conflict aborts the merge, and a failed fast-forward puts the branch back.`;
    confirmLabel = 'Merge sync';
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
          data-modal-cancel
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            pending.kind === 'remove' ||
            pending.kind === 'abort-rebase' ||
            warnings.length > 0
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
    } else if (chosen.kind === 'rebase') {
      // A conflict comes back as a warning toast from apiFetch, and the row stays mid-rebase.
      const { ok } = await act(worktree, 'Rebasing…', { action: 'rebase' });
      if (ok)
        addToast(`Rebased ${worktree.name} onto ${worktree.into}`, 'success');
    } else if (chosen.kind === 'abort-rebase') {
      const { ok } = await act(worktree, 'Aborting…', {
        action: 'abort-rebase',
      });
      if (ok) addToast(`Aborted the rebase of ${worktree.name}`, 'success');
    } else if (chosen.kind === 'sync') {
      const { ok } = await act(worktree, 'Syncing…', { action: 'sync' });
      if (ok)
        addToast(`Synced ${worktree.name} with ${worktree.into}`, 'success');
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
                  {worktree.branch} · {relativeTime(worktree.touchedAt)}
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
                <WorktreeKebabMenu
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

            {worktree.conflicts.length > 0 && (
              <div className="mt-2 text-xs text-red-500 break-all">
                Conflict in {worktree.conflicts.join(', ')}. Resolve it in the
                worktree and run git rebase --continue, or abort it here.
              </div>
            )}

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
        open on the desktop has to be closed before either. Rebasing replays the
        branch on top of that same branch, and a conflict leaves it unfinished
        in the worktree. Merge sync merges that branch into the worktree and
        fast-forwards it to the result, keeping the worktree, or does nothing.
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
