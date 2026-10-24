'use client';

import { useCallback, useState } from 'react';
import { addToast, apiFetch } from '@/lib/api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { Modal } from './Modal';

export interface Worktree {
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

/** What a row's badges say: against the main checkout's branch, for a worktree or not. */
type Comparison = Pick<Worktree, 'state' | 'ahead' | 'behind' | 'into'> &
  Partial<Pick<Worktree, 'dirty' | 'operation'>>;

export type Pending =
  | { kind: 'merge'; worktree: Worktree; squash: boolean }
  | { kind: 'remove'; worktree: Worktree }
  | { kind: 'sync'; worktree: Worktree; propagate: boolean };

interface WorktreeAction {
  label: string;
  pending: Pending;
  disabled: boolean;
  danger: boolean;
}

export function isMerged(worktree: Comparison): boolean {
  return worktree.state === 'merged' || worktree.state === 'no commits';
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

/** The wtman actions on a worktree, and why the ones that are disabled are. */
function worktreeActions(worktree: Worktree): {
  actions: WorktreeAction[];
  reasons: string[];
} {
  // wtman refuses to delete a folder Cursor has open, since the window goes down with it.
  const removeBlocked = worktree.open ? 'close it on the desktop first' : null;
  // A merge would take the branch as it was before the unfinished operation began.
  const mergeBlocked =
    worktree.operation !== null
      ? `finish the ${worktree.operation} first`
      : removeBlocked;
  const into = worktree.into ?? 'main checkout';
  const canMerge = mergeBlocked === null && worktree.into !== null;
  const notSyncable = syncBlocked(worktree);

  const actions: WorktreeAction[] = [
    {
      label: `Merge sync with ${into}`,
      pending: { kind: 'sync', worktree, propagate: false },
      disabled: notSyncable !== null,
      danger: false,
    },
    {
      label: `Merge sync propagate with ${into}`,
      pending: { kind: 'sync', worktree, propagate: true },
      disabled: notSyncable !== null,
      danger: false,
    },
    {
      label: `Merge into ${into}`,
      pending: { kind: 'merge', worktree, squash: false },
      disabled: !canMerge,
      danger: false,
    },
    {
      label: `Squash merge into ${into}`,
      pending: { kind: 'merge', worktree, squash: true },
      disabled: !canMerge,
      danger: false,
    },
    {
      label: 'Remove worktree and branch',
      pending: { kind: 'remove', worktree },
      disabled: removeBlocked !== null,
      danger: true,
    },
  ];

  const reasons: string[] = [];
  if (worktree.operation === null && notSyncable) {
    reasons.push(`Merge sync: ${notSyncable}`);
  }
  if (mergeBlocked !== null && mergeBlocked === removeBlocked) {
    reasons.push(`Merge and remove: ${mergeBlocked}`);
  } else {
    if (mergeBlocked !== null) reasons.push(`Merge: ${mergeBlocked}`);
    if (removeBlocked !== null) reasons.push(`Remove: ${removeBlocked}`);
  }

  return { actions, reasons };
}

function workingLabel(chosen: Pending): string {
  if (chosen.kind === 'merge') return 'Merging…';
  if (chosen.kind === 'remove') return 'Removing…';
  if (chosen.kind === 'sync') return 'Syncing…';
  throw new Error(`Unexpected action: ${(chosen as Pending).kind}`);
}

/** Runs the chosen action through wtman, toasting when it went through. */
async function performWorktreeAction(
  repoId: string,
  chosen: Pending
): Promise<{ ok: boolean; worktrees?: Worktree[] }> {
  const { worktree } = chosen;
  let body: object;
  let done: string;

  if (chosen.kind === 'merge') {
    body = { action: 'merge', squash: chosen.squash };
    done = `Merged ${worktree.name} into ${worktree.into}`;
  } else if (chosen.kind === 'remove') {
    body = { action: 'remove', force: !isMerged(worktree) };
    done = `Removed ${worktree.name}`;
  } else if (chosen.kind === 'sync') {
    body = { action: 'sync', propagate: chosen.propagate };
    done = chosen.propagate
      ? `Synced ${worktree.name} with ${worktree.into} and propagated it`
      : `Synced ${worktree.name} with ${worktree.into}`;
  } else {
    throw new Error(`Unexpected action: ${(chosen as Pending).kind}`);
  }

  const res = await apiFetch(
    `/api/projects/${repoId}/worktrees/${encodeURIComponent(worktree.name)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (res.ok) addToast(done, 'success');
  return { ok: res.ok, worktrees: data.worktrees };
}

export function MergeBadge({
  worktree,
  extra = [],
}: {
  worktree: Comparison;
  extra?: { text: string; className: string }[];
}) {
  const badges: { text: string; className: string }[] = [...extra];

  if (worktree.operation) {
    badges.push({
      text: `${worktree.operation} not finished`,
      className: 'bg-red-500/15 text-red-500',
    });
  }

  if (worktree.dirty === true) {
    badges.push({
      text: 'dirty',
      className: 'bg-red-500/15 text-red-500',
    });
  } else if (worktree.dirty === false) {
    badges.push({
      text: 'clean',
      className: 'bg-green-500/15 text-green-500',
    });
  }

  if (worktree.state === 'merged') {
    // Already implied by being 0 ahead.
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

export function WorktreeConflicts({
  worktree,
  className,
}: {
  worktree: Worktree;
  className: string;
}) {
  if (worktree.conflicts.length === 0) return null;
  return (
    <div className={`text-xs text-red-500 break-all ${className}`}>
      Conflict in {worktree.conflicts.join(', ')}. Resolve it in the
      worktree.
    </div>
  );
}

function WorktreeConfirmModal({
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
    } on ${into} in the main checkout, then removes the worktree and the branch, here and on its remotes. Refused if a remote has commits the branch lacks; a conflict stops it before anything is removed.`;
    confirmLabel = pending.squash ? 'Squash merge' : 'Merge';
  } else if (pending.kind === 'remove') {
    heading = 'Remove worktree and branch?';
    body = `Deletes the checkout, the branch, and ${worktree.branch} on every remote it was pushed to. Refused if a remote has commits the branch lacks. wtman keeps a backup bundle of commits not in main.`;
    if (!isMerged(worktree)) {
      warnings.push(
        worktree.state === 'unmerged'
          ? `${worktree.ahead} commit${worktree.ahead === 1 ? '' : 's'} not in ${into}: the branch is force deleted.`
          : 'Whether the branch is merged is unknown: it is force deleted.'
      );
    }
    confirmLabel = 'Remove';
  } else if (pending.kind === 'sync') {
    heading = `Merge sync${pending.propagate ? ' propagate' : ''} with ${into}?`;
    body = `Merges ${into} into the branch in the worktree, then fast-forwards ${into} in the main checkout to it, so both end on the same commit. The worktree stays. All or nothing: both checkouts must have no uncommitted changes, a conflict aborts the merge, and a failed fast-forward puts the branch back.${
      pending.propagate
        ? ` Then fast-forwards every other worktree that was on ${into}'s commit, so they stay on it. One with uncommitted changes or an unfinished rebase or merge is left behind, without undoing the sync.`
        : ''
    }`;
    confirmLabel = pending.propagate ? 'Merge sync propagate' : 'Merge sync';
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

/**
 * The wtman actions on one worktree, each confirmed first. `onDone` hears how each one went,
 * with the fresh worktree list when the server sent one, and the modal closes once one went
 * through.
 */
export function WorktreeActionsModal({
  repoId,
  worktree,
  error = null,
  onClose,
  onDone,
}: {
  repoId: string;
  /** Null while it loads. */
  worktree: Worktree | null;
  error?: string | null;
  onClose: () => void;
  onDone: (chosen: Pending, ok: boolean, worktrees?: Worktree[]) => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const confirm = async (chosen: Pending) => {
    setPending(null);
    setWorking(workingLabel(chosen));
    let result: Awaited<ReturnType<typeof performWorktreeAction>>;
    try {
      result = await performWorktreeAction(repoId, chosen);
    } finally {
      setWorking(null);
    }
    onDone(chosen, result.ok, result.worktrees);
    if (result.ok) onClose();
  };

  if (pending) {
    return (
      <WorktreeConfirmModal
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => confirm(pending)}
      />
    );
  }

  const { actions, reasons } = worktree
    ? worktreeActions(worktree)
    : { actions: [], reasons: [] };

  return (
    <Modal
      heading="Wtman"
      subtitle={worktree ? `${worktree.name} · ${worktree.branch}` : undefined}
      onClose={onClose}
    >
      {error ? (
        <pre className="m-4 p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap text-red-500">
          {error}
        </pre>
      ) : !worktree ? (
        <div className="px-4 py-3 text-sm text-foreground/50">
          Loading worktree…
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 flex flex-wrap gap-1 empty:hidden">
            <MergeBadge worktree={worktree} />
          </div>
          <WorktreeConflicts worktree={worktree} className="px-4 pt-2" />
          {working ? (
            <div className="px-4 py-3 text-sm text-foreground/50">
              {working}
            </div>
          ) : (
            <div className="py-2">
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => setPending(action.pending)}
                  disabled={action.disabled}
                  className={`block w-full px-4 py-2 text-sm text-left ${
                    action.disabled
                      ? 'text-foreground/30 cursor-not-allowed'
                      : `hover:bg-foreground/10 ${action.danger ? 'text-red-500' : ''}`
                  }`}
                >
                  {action.label}
                </button>
              ))}
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="px-4 pt-1 pb-2 text-xs text-foreground/40"
                >
                  {reason}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end">
        <button
          data-modal-cancel
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

/**
 * The modal for the worktree a project is a checkout of, read fresh from wtman. A merge or a
 * remove takes the worktree, and the project with it, so those end in `onGone`.
 */
export function ProjectWorktreeModal({
  repoId,
  projectId,
  onClose,
  onChanged,
  onGone,
}: {
  repoId: string;
  projectId: string;
  onClose: () => void;
  onChanged: () => void;
  onGone: () => void;
}) {
  const [worktrees, setWorktrees] = useState<Worktree[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${repoId}/worktrees`);
    const data = await res.json();
    if (res.ok) setWorktrees(data.worktrees);
    else setError(data.error || 'Could not read worktrees');
  }, [repoId]);

  useAutoRefresh(load);

  const worktree = worktrees?.find((w) => w.projectId === projectId) ?? null;

  return (
    <WorktreeActionsModal
      repoId={repoId}
      worktree={worktree}
      error={
        error ??
        (worktrees && !worktree
          ? `wtman lists no worktree for ${projectId}`
          : null)
      }
      onClose={onClose}
      onDone={(chosen, ok, fresh) => {
        if (fresh) setWorktrees(fresh);
        if (!ok) return;
        if (chosen.kind === 'merge' || chosen.kind === 'remove') onGone();
        else onChanged();
      }}
    />
  );
}

function commits(n: number): string {
  return `${n} commit${n === 1 ? '' : 's'}`;
}

/**
 * On a worktree's page: a warning that this is not the main checkout, and, once the branch and
 * what the main checkout is on have moved apart, a sync through wtman.
 */
export function WorktreeSyncNotice({
  repoId,
  projectId,
}: {
  repoId: string;
  projectId: string;
}) {
  const [worktree, setWorktree] = useState<Worktree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [syncing, setSyncing] = useState(false);

  const pick = useCallback(
    (worktrees: Worktree[]) =>
      setWorktree(worktrees.find((w) => w.projectId === projectId) ?? null),
    [projectId]
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${repoId}/worktrees`);
    const data = await res.json();
    if (res.ok) {
      pick(data.worktrees);
      setError(null);
    } else {
      setError(data.error || 'Could not read worktrees');
    }
  }, [repoId, pick]);

  useAutoRefresh(load, 10000);

  const sync = async (chosen: Pending) => {
    setPending(null);
    setSyncing(true);
    try {
      const { worktrees } = await performWorktreeAction(repoId, chosen);
      if (worktrees) pick(worktrees);
    } finally {
      setSyncing(false);
    }
  };

  const into = worktree?.into ?? 'main';
  const diverged =
    worktree !== null && (worktree.ahead > 0 || worktree.behind > 0);
  const blocked = worktree ? syncBlocked(worktree) : null;

  return (
    <section className="p-3 space-y-2 text-sm border border-amber-500/40 bg-amber-500/10 rounded-lg">
      <p className="font-medium text-amber-500">
        Warning: you are not on the main worktree.
      </p>
      {error ? (
        <p className="text-xs text-red-500 break-all">{error}</p>
      ) : !worktree ? (
        <p className="text-xs text-foreground/50">Asking wtman…</p>
      ) : (
        <>
          <p className="text-xs text-foreground/60">
            This checkout is on <code>{worktree.branch}</code>, not {into}.
          </p>
          {diverged && (
            <>
              <p className="text-xs text-foreground/60">
                {[
                  worktree.ahead > 0 &&
                    `${commits(worktree.ahead)} not in ${into}`,
                  worktree.behind > 0 &&
                    `${commits(worktree.behind)} on ${into} not here`,
                ]
                  .filter(Boolean)
                  .join(', ')}
                . Sync merges this branch and {into} both ways, leaving them on
                one commit.
              </p>
              <WorktreeConflicts worktree={worktree} className="" />
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setPending({ kind: 'sync', worktree, propagate: false })
                  }
                  disabled={blocked !== null || syncing}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg active:opacity-80 disabled:opacity-40"
                >
                  {syncing ? 'Syncing…' : 'Sync'}
                </button>
                {blocked && (
                  <span className="text-xs text-foreground/50">{blocked}</span>
                )}
              </div>
            </>
          )}
        </>
      )}
      {pending && (
        <WorktreeConfirmModal
          pending={pending}
          onCancel={() => setPending(null)}
          onConfirm={() => sync(pending)}
        />
      )}
    </section>
  );
}
