import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { modifyUrlWithWorktree } from './worktree';
import { OpenWorktree, getOpenWorktrees } from './workspaces';

const PROJECTS_FILE =
  process.env.PROJECTS_FILE ||
  join(homedir(), '.cache/rlocal/rofi-vscode/projects.generated.json');

export interface PushTarget {
  ssh: string;
  path?: string;
  git_relay?: string;
}

export interface Project {
  id: string;
  /** The configured project a worktree belongs to; its own id for everything else. */
  canonicalId: string;
  worktreeName?: string;
  path: string;
  tags?: string[];
  pinned?: boolean;
  repo?: string;
  urls?: Record<string, string>;
  push?: Record<string, PushTarget>;
  cmd?: Record<
    string,
    | string
    | string[]
    | {
        run: string | string[];
        infrastructure?: boolean;
        run_in_terminal?: boolean;
      }
  >;
}

export function getProjects(): Project[] {
  const data: Record<string, Omit<Project, 'id'>> = JSON.parse(
    readFileSync(PROJECTS_FILE, 'utf-8')
  );

  return Object.entries(data).map(([id, raw]) => ({
    id,
    canonicalId: id,
    path: raw.path?.replace(/^~/, homedir()) || '',
    tags: raw.tags,
    pinned: raw.pinned,
    repo: raw.repo,
    urls: raw.urls,
    push: raw.push,
    cmd: raw.cmd,
  }));
}

const LOCAL_URL_KEY = 'loc';

function worktreeUrls(
  urls: Project['urls'],
  worktreeName: string
): Project['urls'] {
  const local = urls?.[LOCAL_URL_KEY];
  if (!local) return urls;

  return {
    ...urls,
    [LOCAL_URL_KEY]: modifyUrlWithWorktree(local, worktreeName),
  };
}

/**
 * A worktree has no entry of its own: it runs on the config of the project it is a checkout
 * of, pointed at its own checkout, with the local url carrying the worktree's name.
 */
function asWorktreeProject(worktree: OpenWorktree): Project | undefined {
  const canonical = getProjects().find((p) => p.id === worktree.canonicalId);
  if (!canonical) return undefined;

  return {
    ...canonical,
    id: worktree.id,
    canonicalId: worktree.canonicalId,
    worktreeName: worktree.worktreeName,
    path: worktree.path,
    urls: worktreeUrls(canonical.urls, worktree.worktreeName),
  };
}

/**
 * Configured projects answer from the file alone; anything else can only be a worktree, and
 * rworkspaces is asked which ones are open. So this costs a socket round trip on worktree
 * pages and nothing at all on the rest.
 */
export async function getProject(id: string): Promise<Project | undefined> {
  const configured = getProjects().find((p) => p.id === id);
  if (configured) return configured;

  const worktree = (await getOpenWorktrees()).find((w) => w.id === id);
  return worktree && asWorktreeProject(worktree);
}

/**
 * The project list: everything configured, plus the worktrees open on the desktop. An open
 * worktree with no configured project behind it drops out here — there is nothing this app
 * could show for one.
 */
export async function getProjectsWithWorktrees(): Promise<Project[]> {
  const worktrees = (await getOpenWorktrees())
    .map(asWorktreeProject)
    .filter((project) => project !== undefined);

  return [...getProjects(), ...worktrees];
}

export function expandPath(path: string): string {
  return path.replace(/^~/, homedir());
}
