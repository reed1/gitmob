import { execFile } from 'child_process';
import { basename } from 'path';
import { Project, getProjects } from './projects';
import { getDesktopState } from './workspaces';

const WORKTREE_SEP = '::';

export interface ProjectWorktree {
  /** The `~/wtman` directory that names it, and the suffix of its project id. */
  name: string;
  /** What the checkout is actually on — not the directory name, which is normalized. */
  branch: string | null;
  path: string;
  /** When the checkout was last touched, ISO. */
  touchedAt: string;
  /** `canonical::name`, the id this becomes on the desktop and in this app. */
  projectId: string;
  /** Open on the desktop right now, so this app already has a page for it. */
  open: boolean;
  /** Uncommitted changes in the checkout. */
  dirty: boolean;
  /** What the main checkout is on, which is what `wtman merge` merges into. */
  into: string | null;
  /** Commits on the branch that `into` does not have. */
  ahead: number;
  /** wtman menu's tag, before it hides it for a dirty checkout. Null with nothing to compare. */
  state: MergeState | null;
}

/**
 * `merged` has every commit in `into` already; `no-commits` sits on the very commit `into`
 * does, so it never got one of its own. Both are what the wtman menu tags a worktree with.
 */
export type MergeState = 'merged' | 'no-commits' | 'unmerged';

interface WtmanRow {
  branch: string;
  project: string;
  path: string;
  mtime: number;
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
 * Which checkout is on which branch, straight from the repo. `wtman list` answers with the
 * directory name, which is the branch with everything git allows and a path does not folded
 * away — `refactor/api-endpoint-registry` lives in `refactor_api-endpoint-registry`. Opening
 * one by that folded name would ask wtman for a branch nobody has, which it would then create.
 *
 * It is also what "living" means: a directory left behind by a worktree git no longer knows
 * about is not one this tab can open.
 */
async function branchesByPath(
  repo: string
): Promise<Map<string, string | null>> {
  const output = await run('git', [
    '-C',
    repo,
    'worktree',
    'list',
    '--porcelain',
  ]);

  const branches = new Map<string, string | null>();
  let path: string | null = null;

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      path = line.slice('worktree '.length);
      branches.set(path, null);
    } else if (line.startsWith('branch ') && path !== null) {
      branches.set(path, line.slice('branch refs/heads/'.length));
    }
  }

  return branches;
}

async function currentBranch(path: string): Promise<string | null> {
  const branch = (
    await run('git', ['-C', path, 'branch', '--show-current'])
  ).trim();
  return branch === '' ? null : branch;
}

async function revParse(repo: string, ref: string): Promise<string> {
  return (await run('git', ['-C', repo, 'rev-parse', ref])).trim();
}

/**
 * The same judgement as `removable_worktree_branches` in wtman, which tags the menu rows:
 * against whatever the main checkout is on, since that is the branch `wtman merge` merges into.
 */
async function mergeStatus(
  repo: string,
  into: string | null,
  path: string,
  branch: string | null
): Promise<Pick<ProjectWorktree, 'dirty' | 'ahead' | 'state'>> {
  const dirty =
    (await run('git', ['-C', path, 'status', '--porcelain'])).trim() !== '';

  if (into === null || branch === null || branch === into) {
    return { dirty, ahead: 0, state: null };
  }

  const [ahead, head, target] = await Promise.all([
    run('git', [
      '-C',
      repo,
      'rev-list',
      '--count',
      `refs/heads/${into}..refs/heads/${branch}`,
    ]).then((count) => Number(count.trim())),
    revParse(repo, `refs/heads/${branch}`),
    revParse(repo, `refs/heads/${into}`),
  ]);

  const state: MergeState =
    ahead > 0 ? 'unmerged' : head === target ? 'no-commits' : 'merged';
  return { dirty, ahead, state };
}

/**
 * The worktrees of one project, most recently touched first.
 *
 * `wtman list --json` is the whole index of what exists: every direct child of `~/wtman` is a
 * branch directory and every child of that is a repo, so a worktree is this project's when the
 * repo directory carries its name. That is wtman's own idea of which repo a worktree belongs
 * to — two projects checked out under the same folder name share worktrees there as far as it
 * is concerned — so nothing here holds a second opinion about it.
 */
export async function listWorktrees(
  project: Project
): Promise<ProjectWorktree[]> {
  const repo = repoPath(project);
  const [rows, branches, desktop, into] = await Promise.all([
    run('wtman', ['list', '--json']).then(
      (stdout) => JSON.parse(stdout) as WtmanRow[]
    ),
    branchesByPath(repo),
    getDesktopState(),
    currentBranch(repo),
  ]);

  const openIds = new Set(desktop.worktrees.map((worktree) => worktree.id));

  return Promise.all(
    rows
      .filter((row) => row.project === basename(repo) && branches.has(row.path))
      .map(async (row) => {
        const branch = branches.get(row.path) ?? null;
        const projectId = `${project.canonicalId}${WORKTREE_SEP}${row.branch}`;
        return {
          name: row.branch,
          branch,
          path: row.path,
          touchedAt: new Date(row.mtime * 1000).toISOString(),
          projectId,
          open: openIds.has(projectId),
          into,
          ...(await mergeStatus(repo, into, row.path, branch)),
        };
      })
  );
}

/** Opening a worktree can mean starting an editor and its terminals, as `rv open` does. */
const OPEN_TIMEOUT_MS = 120000;

/**
 * `wtman open` is one command for both buttons on the tab: it creates the branch and the
 * checkout when they are not there yet, and for one that already exists it is nothing but the
 * hand-off to `rofi-vscode open`. Either way that hand-off is what announces the worktree
 * project to rworkspaces, and so what gives it a page in this app.
 *
 * No `--interactive`: without it wtman declines every offer — the uncommitted changes in the
 * main checkout stay where they are, rather than being carried into a branch nobody at this
 * end can see. It also forks a new branch off main rather than off whatever the checkout is
 * parked on, since that is not a base anybody chose from here.
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
  await openBranch(project, requireBranch(worktree));
}

/**
 * Creates a worktree for a branch that has none, and opens it. wtman creates the branch too
 * when it does not exist, which is the ordinary case here; a local branch that was never
 * checked out gets its worktree instead of a second branch, and that is wtman's call to make,
 * not something this app checks for first.
 */
export async function createWorktree(
  project: Project,
  branch: string
): Promise<ProjectWorktree> {
  await openBranch(project, branch);

  const worktrees = await listWorktrees(project);
  const created = worktrees.find((worktree) => worktree.branch === branch);
  if (!created) {
    throw new Error(`wtman opened ${branch} but left no worktree for it`);
  }
  return created;
}

/** A merge can push the branch to its upstream first, which is the network's time to take. */
const MERGE_TIMEOUT_MS = 120000;

function requireBranch(worktree: ProjectWorktree): string {
  if (worktree.branch === null) {
    throw new Error(`${worktree.name} is on a detached HEAD`);
  }
  return worktree.branch;
}

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
      requireBranch(worktree),
      ...(squash ? ['--squash'] : []),
    ],
    ['y'],
    MERGE_TIMEOUT_MS
  );
}

/**
 * Removes the worktree, and with `removeBranch` the branch too, which wtman bundles into a
 * backup first. Deleting a branch git does not consider merged is a second question, and
 * `force` is the answer to it; without it the worktree is kept rather than removed halfway.
 */
export async function removeWorktree(
  project: Project,
  worktree: ProjectWorktree,
  removeBranch: boolean,
  force: boolean
): Promise<string> {
  const unmerged =
    worktree.state !== 'merged' && worktree.state !== 'no-commits';
  if (removeBranch && unmerged && !force) {
    throw new UnmergedBranch(
      `${worktree.name} has commits ${worktree.into ?? 'the main checkout'} does not`
    );
  }

  return runAnswered(
    [
      'remove',
      ...(removeBranch ? ['--remove-branch'] : []),
      repoPath(project),
      requireBranch(worktree),
    ],
    removeBranch && unmerged ? ['y', 'y'] : ['y']
  );
}

export class UnmergedBranch extends Error {}
