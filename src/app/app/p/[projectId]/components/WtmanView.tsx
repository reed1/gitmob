'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { addToast, apiFetch } from '@/lib/api';
import { goHome } from '@/lib/app-depth';
import { relativeTime } from '@/lib/relative-time';
import { useLoad } from '@/lib/use-load';
import {
  actOnDesktop,
  CloseOnDesktopModal,
} from '@/app/app/CloseOnDesktopModal';
import { KebabMenu, KebabMenuItem } from '@/app/app/KebabMenu';
import { Modal } from '@/app/app/Modal';
import {
  MergeBadge,
  Worktree,
  WorktreeActionsModal,
  WorktreeConflicts,
  isMerged,
} from '@/app/app/WorktreeActions';
import { projectApiPath, projectPagePath } from '@/lib/project-paths';

interface BranchRow {
  kind: 'local' | 'remote';
  name: string;
  branch: string;
  remote: string | null;
  committedAt: string | null;
  into: string | null;
  ahead: number;
  behind: number;
  state: Worktree['state'];
  stale: boolean;
  remotes: Record<string, boolean>;
}

/** What the wtman modal does not cover: where the worktree is on the desktop. */
function WorktreeKebabMenu({
  worktree,
  isCurrent,
  disabled,
  onGoTo,
  onOpen,
  onClose,
}: {
  worktree: Worktree;
  isCurrent: boolean;
  disabled: boolean;
  onGoTo: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <KebabMenu label={`Actions for ${worktree.name}`} disabled={disabled}>
      {worktree.open ? (
        <>
          <KebabMenuItem onSelect={onGoTo} disabled={isCurrent}>
            {isCurrent ? 'You are here' : 'Go to'}
          </KebabMenuItem>
          <KebabMenuItem onSelect={onClose}>Close</KebabMenuItem>
        </>
      ) : (
        <KebabMenuItem onSelect={onOpen}>Open</KebabMenuItem>
      )}
    </KebabMenu>
  );
}

/** Why wtman would refuse to remove it, or null when it would go ahead. */
function branchRemoveBlocked(row: BranchRow): string | null {
  if (row.kind === 'remote') {
    return row.stale
      ? 'stale, the remote has moved since the last fetch'
      : null;
  }
  const differs = Object.entries(row.remotes)
    .filter(([, same]) => !same)
    .map(([remote]) => remote);
  return differs.length > 0
    ? `${differs.join(', ')} is on another commit`
    : null;
}

function branchBadges(row: BranchRow): { text: string; className: string }[] {
  if (row.kind === 'remote') {
    return row.stale
      ? [{ text: 'stale', className: 'bg-amber-500/15 text-amber-500' }]
      : [];
  }
  return [
    { text: 'local', className: 'bg-foreground/10 text-foreground/60' },
    ...Object.entries(row.remotes).map(([remote, same]) =>
      same
        ? {
            text: `same on ${remote}`,
            className: 'bg-foreground/10 text-foreground/50',
          }
        : {
            text: `differs from ${remote}`,
            className: 'bg-amber-500/15 text-amber-500',
          }
    ),
  ];
}

function BranchKebabMenu({
  row,
  disabled,
  onCreate,
  onRemove,
}: {
  row: BranchRow;
  disabled: boolean;
  onCreate: () => void;
  onRemove: () => void;
}) {
  const removeBlocked = branchRemoveBlocked(row);
  return (
    <KebabMenu label={`Actions for ${row.name}`} disabled={disabled}>
      <KebabMenuItem onSelect={onCreate}>Create worktree</KebabMenuItem>
      <KebabMenuItem
        onSelect={onRemove}
        disabled={removeBlocked !== null}
        danger
      >
        {row.kind === 'remote' ? `Remove from ${row.remote}` : 'Remove branch'}
      </KebabMenuItem>
      {removeBlocked && (
        <div className="px-4 pt-1 pb-2 text-xs text-foreground/40">
          Remove: {removeBlocked}
        </div>
      )}
    </KebabMenu>
  );
}

/** Where a new branch starts: main, or the branch of the worktree this page is for. */
function BaseModal({
  branch,
  current,
  onCancel,
  onPick,
}: {
  branch: string;
  current: Worktree;
  onCancel: () => void;
  onPick: (base: Worktree | null) => void;
}) {
  const choices: { base: Worktree | null; label: string; detail: string }[] = [
    {
      base: null,
      label: 'Off main',
      detail: 'Uncommitted changes in the main checkout stay there.',
    },
    {
      base: current,
      label: `Off ${current.branch}`,
      detail:
        'The worktree this page is for, at its last commit. Its uncommitted changes stay there.',
    },
  ];

  return (
    <Modal heading="Make the branch off" subtitle={branch} onClose={onCancel}>
      <div className="divide-y divide-foreground/10">
        {choices.map((choice) => (
          <button
            key={choice.label}
            onClick={() => onPick(choice.base)}
            className="w-full text-left px-4 py-3 hover:bg-foreground/5 active:bg-foreground/10"
          >
            <div className="text-sm font-medium truncate">{choice.label}</div>
            <div className="text-xs text-foreground/50">{choice.detail}</div>
          </button>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end">
        <button
          data-modal-cancel
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function RemoveBranchModal({
  row,
  onCancel,
  onConfirm,
}: {
  row: BranchRow;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const into = row.into ?? 'the main checkout';
  const warnings: string[] = [];
  let body: string;

  if (row.kind === 'local') {
    const remotes = Object.keys(row.remotes);
    body = `Deletes the branch${remotes.length > 0 ? `, here and on ${remotes.join(', ')}` : ''}. Refused unless each remote is on the same commit. wtman keeps a backup bundle of commits not in main.`;
    if (!isMerged(row)) {
      warnings.push(
        `${row.ahead} commit${row.ahead === 1 ? '' : 's'} not in ${into}: the branch is force deleted.`
      );
    }
  } else if (row.kind === 'remote') {
    body = `Deletes ${row.branch} on ${row.remote}. Nothing backs it up.`;
    if (row.ahead > 0) {
      warnings.push(
        `${row.ahead} commit${row.ahead === 1 ? '' : 's'} not in ${into} go with it.`
      );
    }
  } else {
    throw new Error(`Unexpected branch kind: ${(row as BranchRow).kind}`);
  }

  return (
    <Modal heading="Remove branch?" subtitle={row.name} onClose={onCancel}>
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
          className="px-3 py-1.5 text-sm rounded-lg bg-red-500/15 text-red-500 active:bg-red-500/25"
        >
          Remove
        </button>
      </div>
    </Modal>
  );
}

/** The worktree this page is for first, the rest by branch name, as the wtman menu orders them. */
function sortedWorktrees(
  worktrees: Worktree[],
  currentProjectId: string
): Worktree[] {
  return [...worktrees].sort(
    (a, b) =>
      Number(b.projectId === currentProjectId) -
        Number(a.projectId === currentProjectId) ||
      a.branch.localeCompare(b.branch)
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
  const [branches, setBranches] = useState<BranchRow[] | null>(null);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<{
    name: string;
    label: string;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [closing, setClosing] = useState<Worktree | null>(null);
  const [removing, setRemoving] = useState<BranchRow | null>(null);
  const [newBranch, setNewBranch] = useState('');
  const [creating, setCreating] = useState(false);
  const [choosingBase, setChoosingBase] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`${projectApiPath(projectId)}/worktrees`);
    const data = await res.json();
    if (res.ok) {
      setWorktrees(data.worktrees);
      setError(null);
    } else {
      setError(data.error || 'Could not read worktrees');
    }
  }, [projectId]);

  useLoad(load);

  const loadBranches = useCallback(async () => {
    const res = await fetch(`${projectApiPath(projectId)}/branches`);
    const data = await res.json();
    if (res.ok) {
      setBranches(data.branches);
      setBranchesError(null);
    } else {
      setBranchesError(data.error || 'Could not read branches');
    }
  }, [projectId]);

  useLoad(loadBranches);

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

  const open = async (worktree: Worktree) => {
    setWorking({ name: worktree.name, label: 'Opening…' });
    try {
      const { ok, projectId: opened } = await post(
        `${projectApiPath(projectId)}/worktrees/${encodeURIComponent(worktree.name)}`,
        { action: 'open' }
      );
      if (ok) router.push(projectPagePath(opened));
    } finally {
      setWorking(null);
    }
  };

  const close = async (worktree: Worktree) => {
    setClosing(null);
    setWorking({ name: worktree.name, label: 'Closing…' });
    try {
      const ok = await actOnDesktop(worktree.projectId, 'close');
      // The page is the worktree's own, and it has no project left to show.
      if (ok && worktree.projectId === currentProjectId) goHome(router);
      else await load();
    } finally {
      setWorking(null);
    }
  };

  const create = async (base: Worktree | null) => {
    setChoosingBase(false);
    setCreating(true);
    try {
      const { ok, projectId: created } = await post(
        `${projectApiPath(projectId)}/worktrees`,
        base
          ? { from: 'worktree', branch: newBranch, base: base.name }
          : { from: 'main', branch: newBranch }
      );
      if (ok) {
        setNewBranch('');
        router.push(projectPagePath(created));
      }
    } finally {
      setCreating(false);
    }
  };

  const createFrom = async (row: BranchRow) => {
    setWorking({ name: row.name, label: 'Creating…' });
    try {
      const { ok, projectId: opened } = await post(
        `${projectApiPath(projectId)}/worktrees`,
        { from: 'branch', name: row.name }
      );
      if (ok) router.push(projectPagePath(opened));
      else loadBranches();
    } finally {
      setWorking(null);
    }
  };

  const removeBranch = async (row: BranchRow) => {
    setRemoving(null);
    setWorking({ name: row.name, label: 'Removing…' });
    try {
      const { ok } = await post(`${projectApiPath(projectId)}/branches`, {
        name: row.name,
        force: row.kind === 'local' && !isMerged(row),
      });
      if (ok) addToast(`Removed ${row.name}`, 'success');
      await loadBranches();
    } finally {
      setWorking(null);
    }
  };

  const busy = creating || working !== null;
  const selectedWorktree = worktrees?.find((w) => w.name === selected);
  const currentWorktree =
    worktrees?.find((worktree) => worktree.projectId === currentProjectId) ??
    null;

  // From a worktree's page the branch can start off main or off that worktree's branch, which
  // is asked; from the main checkout's it is off main. Uncommitted changes stay where they are,
  // and a name already taken, locally or on a remote, is refused by wtman.
  const createBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (newBranch.trim() === '' || busy) return;
        if (currentWorktree) setChoosingBase(true);
        else create(null);
      }}
      className="flex gap-2"
    >
      <input
        value={newBranch}
        onChange={(e) => setNewBranch(e.target.value)}
        placeholder="New branch"
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

  return (
    <div className="p-4 space-y-3">
      {createBox}
      {worktrees.length === 0 && (
        <div className="text-center text-foreground/50">
          No worktrees checked out for this project yet.
        </div>
      )}
      {sortedWorktrees(worktrees, currentProjectId).map((worktree) => {
        const isCurrent = worktree.projectId === currentProjectId;
        return (
          <div
            key={worktree.name}
            onClick={() => {
              if (working?.name !== worktree.name) setSelected(worktree.name);
            }}
            className={`p-3 border rounded-lg cursor-pointer ${
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
                    router.push(projectPagePath(worktree.projectId))
                  }
                  onOpen={() => open(worktree)}
                  onClose={() => setClosing(worktree)}
                />
              )}
            </div>

            <WorktreeConflicts worktree={worktree} className="mt-2" />

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

      <p className="text-xs text-foreground/40">
        Merge and remove delete the branch here and on its remotes, and stop if
        a remote has commits it lacks.
      </p>

      <div className="space-y-2 pt-2">
        <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
          Branches without a worktree
        </div>
        {branchesError && (
          <div className="text-xs text-red-500 break-all">{branchesError}</div>
        )}
        {branches === null && !branchesError && (
          <div className="text-xs text-foreground/50">Asking the remotes…</div>
        )}
        {branches?.length === 0 && (
          <div className="text-xs text-foreground/50">None.</div>
        )}
        {branches?.map((row) => (
          <div
            key={row.name}
            className="p-3 border border-foreground/10 rounded-lg flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{row.name}</div>
              <div className="text-xs text-foreground/50">
                {row.committedAt
                  ? relativeTime(row.committedAt)
                  : 'never fetched'}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
                <MergeBadge worktree={row} extra={branchBadges(row)} />
              </div>
            </div>
            {working?.name === row.name ? (
              <span className="shrink-0 text-xs text-foreground/50">
                {working.label}
              </span>
            ) : (
              <BranchKebabMenu
                row={row}
                disabled={busy}
                onCreate={() => createFrom(row)}
                onRemove={() => setRemoving(row)}
              />
            )}
          </div>
        ))}
      </div>

      {choosingBase && currentWorktree && (
        <BaseModal
          branch={newBranch.trim()}
          current={currentWorktree}
          onCancel={() => setChoosingBase(false)}
          onPick={create}
        />
      )}

      {removing && (
        <RemoveBranchModal
          row={removing}
          onCancel={() => setRemoving(null)}
          onConfirm={() => removeBranch(removing)}
        />
      )}

      {selectedWorktree && (
        <WorktreeActionsModal
          repoId={projectId}
          worktree={selectedWorktree}
          onClose={() => setSelected(null)}
          onDone={(chosen, ok, fresh) => {
            if (fresh) setWorktrees(fresh);
            if (ok && (chosen.kind === 'merge' || chosen.kind === 'remove')) {
              loadBranches();
            }
          }}
        />
      )}

      {closing && (
        <CloseOnDesktopModal
          projectId={closing.projectId}
          onCancel={() => setClosing(null)}
          onConfirm={() => close(closing)}
        />
      )}
    </div>
  );
}
