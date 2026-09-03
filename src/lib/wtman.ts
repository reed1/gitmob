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
}

interface WtmanRow {
  branch: string;
  project: string;
  path: string;
  mtime: number;
}

function run(
  command: string,
  args: string[],
  timeout = 30000
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
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
  const [rows, branches, desktop] = await Promise.all([
    run('wtman', ['list', '--json']).then(
      (stdout) => JSON.parse(stdout) as WtmanRow[]
    ),
    branchesByPath(repo),
    getDesktopState(),
  ]);

  const openIds = new Set(desktop.worktrees.map((worktree) => worktree.id));

  return rows
    .filter((row) => row.project === basename(repo) && branches.has(row.path))
    .map((row) => ({
      name: row.branch,
      branch: branches.get(row.path) ?? null,
      path: row.path,
      touchedAt: new Date(row.mtime * 1000).toISOString(),
      projectId: `${project.canonicalId}${WORKTREE_SEP}${row.branch}`,
      open: openIds.has(`${project.canonicalId}${WORKTREE_SEP}${row.branch}`),
    }));
}

/** Opening a worktree can mean starting an editor and its terminals, as `rv open` does. */
const OPEN_TIMEOUT_MS = 120000;

/**
 * `wtman open` is one command for both buttons on the tab: it creates the branch and the
 * checkout when they are not there yet, and for one that already exists it is nothing but the
 * hand-off to `rofi-vscode open`. Either way that hand-off is what announces the worktree
 * project to rworkspaces, and so what gives it a page in this app.
 *
 * No `--interactive`, which is the whole contract with wtman from here. Without it wtman
 * declines every offer — the uncommitted changes in the main checkout stay where they are,
 * rather than being carried into a branch nobody at this end can see — and refuses every
 * confirmation, which is why `remove` and `merge` are not on this tab. It also forks a new
 * branch off main rather than off whatever the checkout is parked on, since that is not a base
 * anybody chose from here.
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
  if (worktree.branch === null) {
    throw new Error(`${worktree.name} is on a detached HEAD`);
  }

  await openBranch(project, worktree.branch);
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
