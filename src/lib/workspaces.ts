import { execFile } from 'child_process';

export interface OpenWorktree {
  id: string;
  canonicalId: string;
  worktreeName: string;
  path: string;
}

interface WorkspaceProject {
  id: string;
  active: boolean;
  path: string | null;
  canonical_project_id: string;
  worktree_name: string | null;
}

interface WorkspaceState {
  projects: Record<string, WorkspaceProject>;
  warnings: ProjectWarnings;
}

/** Project id -> warning id -> message. rworkspaces owns what raises one. */
export type ProjectWarnings = Record<string, Record<string, string>>;

export interface DesktopState {
  worktrees: OpenWorktree[];
  warnings: ProjectWarnings;
}

/**
 * `rw-msg` is the client for the rworkspaces socket, which owns which projects are open on
 * the desktop and is the only place a worktree project is ever announced — opening one is
 * what brings it into existence. Nothing here reads i3 or the socket directly.
 */
function rwMsg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'rw-msg',
      args,
      { timeout: 10000, maxBuffer: 4 * 1024 * 1024 },
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

/**
 * The worktree projects open on the desktop right now, each already telling us which project
 * it is a checkout of and where that checkout lives, plus the warnings rworkspaces holds
 * against any project. This throws when rworkspaces is unreachable rather than reporting an
 * empty desktop, since the two are indistinguishable from here and only one of them is worth
 * knowing about.
 */
export async function getDesktopState(): Promise<DesktopState> {
  const state: WorkspaceState = JSON.parse(await rwMsg(['get_state']));

  const worktrees = Object.values(state.projects)
    .filter(
      (project) => project.active && project.worktree_name && project.path
    )
    .map((project) => ({
      id: project.id,
      canonicalId: project.canonical_project_id,
      worktreeName: project.worktree_name as string,
      path: project.path as string,
    }));

  return { worktrees, warnings: state.warnings };
}
