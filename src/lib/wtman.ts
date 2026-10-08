import { execFile } from 'child_process';
import { Project, getProjects } from './projects';
import { getDesktopState } from './workspaces';

const WORKTREE_SEP = '::';

export interface ProjectWorktree {
  /** The `~/wtman` directory that names it, and the suffix of its project id. */
  name: string;
  /** What the checkout is actually on — not the directory name, which is normalized. */
  branch: string;
  path: string;
  /** When the checkout was last touched, ISO. */
  touchedAt: string;
  /** `canonical::name`, the id this becomes on the desktop and in this app. */
  projectId: string;
  /** Open on the desktop right now, so this app already has a page for it. */
  open: boolean;
  /** Uncommitted changes in the checkout. */
  dirty: boolean;
  /** What the main checkout is on: what `merge` merges into and `rebase` rebases onto. */
  into: string | null;
  /** Commits on the branch that `into` does not have. */
  ahead: number;
  /** Commits on `into` that the branch does not have, which a rebase brings in. */
  behind: number;
  /** Null with no `into` to compare against. */
  state: MergeState | null;
  /** A rebase or merge that stopped in the checkout and is not finished. */
  operation: Operation | null;
  /** Paths still conflicted in that operation. */
  conflicts: string[];
}

/**
 * `merged` has every commit in `into` already; `no commits` still sits on the commit it was
 * created from, so nothing was ever committed on it. Both are what the wtman menu tags a
 * worktree with.
 */
export type MergeState = 'merged' | 'no commits' | 'unmerged';

export type Operation = 'rebase' | 'merge';

export interface RemoteBranch {
  /** `<remote>/<branch>`, what `wtman open --branch` takes. */
  name: string;
  /** The local branch it opens as, and so the branch its worktree reports. */
  branch: string;
  /** When its tip was committed, ISO. */
  committedAt: string;
}

interface WtmanRemoteRow {
  name: string;
  branch: string;
  committed: number;
}

interface WtmanStatusRow {
  name: string;
  branch: string;
  path: string;
  mtime: number;
  into: string | null;
  dirty: boolean;
  ahead: number;
  behind: number;
  state: MergeState | null;
  operation: Operation | null;
  conflicts: string[];
}

function run(
  command: string,
  args: string[],
  timeout = 30000,
  input?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { timeout, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(stdout);
      }
    );
    child.stdin?.end(input ?? '');
  });
}

/** The main checkout a worktree belongs to. A worktree project has no path of its own here. */
function repoPath(project: Project): string {
  const canonical = getProjects().find((p) => p.id === project.canonicalId);
  if (!canonical) {
    throw new Error(`No configured project behind ${project.id}`);
  }
  return canonical.path;
}

/**
 * The worktrees of one project, most recently touched first, as `wtman status --json` sees
 * them — the same call the wtman menu labels its rows from, so nothing here holds a second
 * opinion about whether a branch is merged.
 *
 * `name` is the `~/wtman` directory, which is the branch with everything git allows and a path
 * does not folded away — `refactor/api-endpoint-registry` lives in
 * `refactor_api-endpoint-registry`. It names the project; `branch` is what goes back to wtman.
 */
export async function listWorktrees(
  project: Project
): Promise<ProjectWorktree[]> {
  const [rows, desktop] = await Promise.all([
    run('wtman', ['status', '--json', repoPath(project)]).then(
      (stdout) => JSON.parse(stdout) as WtmanStatusRow[]
    ),
    getDesktopState(),
  ]);

  const openIds = new Set(desktop.worktrees.map((worktree) => worktree.id));

  return rows.map(({ mtime, ...row }) => {
    const projectId = `${project.canonicalId}${WORKTREE_SEP}${row.name}`;
    return {
      ...row,
      touchedAt: new Date(mtime * 1000).toISOString(),
      projectId,
      open: openIds.has(projectId),
    };
  });
}

/**
 * Remote branches with no local branch yet, most recently committed first — the wtman menu's
 * `[remote]` rows, read from the remote-tracking refs as of the last fetch.
 */
export async function listRemoteBranches(
  project: Project
): Promise<RemoteBranch[]> {
  const rows = JSON.parse(
    await run('wtman', ['remotes', '--json', repoPath(project)])
  ) as WtmanRemoteRow[];
  return rows.map(({ committed, ...row }) => ({
    ...row,
    committedAt: new Date(committed * 1000).toISOString(),
  }));
}

/** What the Wtman tab shows, read together so one never answers for a later state than the
 * other. */
export async function listBranches(project: Project): Promise<{
  worktrees: ProjectWorktree[];
  remoteBranches: RemoteBranch[];
}> {
  const [worktrees, remoteBranches] = await Promise.all([
    listWorktrees(project),
    listRemoteBranches(project),
  ]);
  return { worktrees, remoteBranches };
}

/** Opening a worktree can mean starting an editor and its terminals, as `rv open` does. */
const OPEN_TIMEOUT_MS = 120000;

/**
 * `wtman open` opens a worktree already on disk, or gives a remote branch a tracking branch and
 * a worktree first; for one that already exists it is nothing but the hand-off to
 * `rofi-vscode open`. Either way that hand-off is what announces the worktree project to
 * rworkspaces, and so what gives it a page in this app. Only names wtman already listed reach
 * it: given anything else it would create a branch, which is `wtman new`'s job.
 *
 * This waits for the whole open, which is a few seconds of workspace switching and window
 * launching — but only for the launching. Cursor and the project terminal are started through
 * i3's own `exec` by `launch-on-left`, so they belong to i3 and none of them is a child of this
 * request; what comes back is whether the open succeeded, which is the one thing worth waiting
 * for and the reason nothing here detaches it.
 */
function openBranch(project: Project, branch: string): Promise<string> {
  return run(
    'wtman',
    ['open', repoPath(project), '--branch', branch],
    OPEN_TIMEOUT_MS
  );
}

/** Opens a worktree that is already on disk. The branch is the repo's answer, never the
 * directory name: see above. */
export async function openWorktree(
  project: Project,
  worktree: ProjectWorktree
): Promise<void> {
  await openBranch(project, worktree.branch);
}

/** The worktree wtman just opened for `branch`, which it must have left behind. */
async function worktreeOf(
  project: Project,
  branch: string
): Promise<ProjectWorktree> {
  const opened = (await listWorktrees(project)).find(
    (worktree) => worktree.branch === branch
  );
  if (!opened) {
    throw new Error(`wtman opened ${branch} but left no worktree for it`);
  }
  return opened;
}

/**
 * Creates a branch off main in a worktree of its own, and opens it, as `wtman new` does. wtman
 * refuses a name already taken by a local branch or on a remote, and that refusal is the
 * request's answer: a new branch is only ever new.
 *
 * No `--interactive`: without it wtman declines its one offer, and the uncommitted changes in
 * the main checkout stay where they are rather than being carried into a branch nobody at this
 * end can see.
 */
export async function createWorktree(
  project: Project,
  branch: string
): Promise<ProjectWorktree> {
  await run('wtman', ['new', repoPath(project), branch], OPEN_TIMEOUT_MS);
  return worktreeOf(project, branch);
}

/** Checks a remote branch out as the local branch tracking it, in a worktree, and opens it. */
export async function openRemoteBranch(
  project: Project,
  remote: RemoteBranch
): Promise<ProjectWorktree> {
  await openBranch(project, remote.name);
  return worktreeOf(project, remote.branch);
}

/** A merge can push the branch to its upstream first, which is the network's time to take. */
const MERGE_TIMEOUT_MS = 120000;

/**
 * `merge` and `remove` only run under `--interactive`, and every question they put is answered
 * on stdin with what the person already said yes to in the dialog here — one line per prompt,
 * in the order wtman asks them. A prompt nobody answered for reads end of input, which wtman
 * turns into a refusal of its own rather than a guess.
 */
function runAnswered(
  args: string[],
  answers: string[],
  timeout = 30000
): Promise<string> {
  return run(
    'wtman',
    ['--interactive', ...args],
    timeout,
    answers.map((answer) => `${answer}\n`).join('')
  );
}

/**
 * Merges the branch into whatever the main checkout is on, then removes its worktree and the
 * branch, as `wtman merge` does. The one question it may ask is whether to copy the branch's
 * box directories into the main checkout first, and yes is its default at the terminal too.
 * wtman refuses a worktree still open on the desktop, since Cursor goes down with its folder.
 */
export async function mergeWorktree(
  project: Project,
  worktree: ProjectWorktree,
  squash: boolean
): Promise<string> {
  return runAnswered(
    [
      'merge',
      repoPath(project),
      worktree.branch,
      ...(squash ? ['--squash'] : []),
    ],
    ['y'],
    MERGE_TIMEOUT_MS
  );
}

/**
 * Removes the worktree, the branch, which wtman bundles into a backup first, and the branch on
 * every remote it was pushed to. Deleting a branch with commits the main checkout's branch does
 * not have is a second question, and `force` is the answer to it; without it nothing is removed.
 */
export async function removeWorktree(
  project: Project,
  worktree: ProjectWorktree,
  force: boolean
): Promise<string> {
  const unmerged =
    worktree.state !== 'merged' && worktree.state !== 'no commits';
  if (unmerged && !force) {
    throw new UnmergedBranch(
      `${worktree.name} has commits ${worktree.into ?? 'the main checkout'} does not`
    );
  }

  return runAnswered(
    ['remove', repoPath(project), worktree.branch],
    unmerged ? ['y', 'y'] : ['y'],
    MERGE_TIMEOUT_MS
  );
}

export class UnmergedBranch extends Error {}

/** A rebase replays the branch's commits one by one, and a hook may run on each. */
const REBASE_TIMEOUT_MS = 120000;

/**
 * Rebases the branch onto whatever the main checkout is on, in its own worktree. It asks
 * nothing, so it runs without `--interactive`. A conflict stops it there unfinished, for
 * whoever opens the worktree to resolve or abort — wtman does not abort it on their behalf, and
 * fails saying so. That is told apart from any other failure by reading the worktree again:
 * an unfinished rebase comes back as the worktree, still mid-rebase, rather than as an error.
 */
export async function rebaseWorktree(
  project: Project,
  worktree: ProjectWorktree
): Promise<{ unfinished: ProjectWorktree | null }> {
  try {
    await run(
      'wtman',
      ['rebase', repoPath(project), worktree.branch],
      REBASE_TIMEOUT_MS
    );
    return { unfinished: null };
  } catch (err) {
    const stopped = (await listWorktrees(project)).find(
      (w) => w.name === worktree.name
    );
    if (stopped?.operation === 'rebase') return { unfinished: stopped };
    throw err;
  }
}

/**
 * Merges whatever the main checkout is on into the branch, in its worktree, then fast-forwards
 * the main checkout to it, leaving both on one commit. wtman does it all or nothing: it refuses
 * either checkout with uncommitted changes, aborts a merge that conflicts, and puts the branch
 * back when the fast-forward fails. It asks nothing, so it runs without `--interactive`.
 */
export async function syncWorktree(
  project: Project,
  worktree: ProjectWorktree
): Promise<void> {
  await run(
    'wtman',
    ['sync', repoPath(project), worktree.branch],
    MERGE_TIMEOUT_MS
  );
}

/** Puts the branch back where it was before a rebase that stopped at a conflict. */
export async function abortRebase(
  project: Project,
  worktree: ProjectWorktree
): Promise<void> {
  await run('wtman', ['rebase', '--abort', repoPath(project), worktree.branch]);
}
