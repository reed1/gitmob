import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const REMOTE_PREFERENCE = ['origin', 'personal'];

const GITHUB_REMOTE =
  /^(?:(?:https?|ssh|git):\/\/)?(?:[^@/]+@)?github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

export interface Checkout {
  /** `HEAD` when detached. */
  branch: string;
  githubUrl: string | null;
}

/**
 * A worktree's or submodule's `.git` is a file pointing at its git dir, and a worktree's
 * config lives in the main checkout's git dir, named by `commondir`.
 */
function resolveGitDirs(path: string): { gitDir: string; commonDir: string } {
  const dotGit = resolve(path, '.git');
  if (statSync(dotGit).isDirectory()) {
    return { gitDir: dotGit, commonDir: dotGit };
  }

  const pointer = readFileSync(dotGit, 'utf-8').match(/^gitdir:\s*(.+)$/m);
  if (!pointer) throw new Error(`${dotGit} names no git dir`);
  const gitDir = resolve(path, pointer[1].trim());
  const commonDirFile = resolve(gitDir, 'commondir');
  const commonDir = existsSync(commonDirFile)
    ? resolve(gitDir, readFileSync(commonDirFile, 'utf-8').trim())
    : gitDir;
  return { gitDir, commonDir };
}

function readBranch(gitDir: string): string {
  const head = readFileSync(resolve(gitDir, 'HEAD'), 'utf-8').trim();
  const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
  return ref ? ref[1] : 'HEAD';
}

function readRemoteUrls(commonDir: string): Record<string, string> {
  const config = readFileSync(resolve(commonDir, 'config'), 'utf-8');
  const urls: Record<string, string> = {};
  let remote: string | null = null;

  for (const line of config.split('\n')) {
    const section = line.match(/^\s*\[\s*([^\s\]]+)(?:\s+"([^"]*)")?\s*\]/);
    if (section) {
      remote = section[1] === 'remote' ? (section[2] ?? null) : null;
      continue;
    }
    if (remote === null || remote in urls) continue;
    const url = line.match(/^\s*url\s*=\s*(.+?)\s*$/);
    if (url) urls[remote] = url[1];
  }
  return urls;
}

function githubUrlOf(remoteUrls: Record<string, string>): string | null {
  for (const name of REMOTE_PREFERENCE) {
    const repo = remoteUrls[name]?.match(GITHUB_REMOTE)?.[1];
    if (repo) return `https://github.com/${repo}`;
  }
  return null;
}

/**
 * The branch and the GitHub link, read off the git dir rather than asked of git: the project
 * list wants both for every project, and a spawn per project is what makes it slow. Null for
 * a checkout that is not there, or is not a git repository.
 */
export function readCheckout(path: string): Checkout | null {
  if (!existsSync(resolve(path, '.git'))) return null;

  const { gitDir, commonDir } = resolveGitDirs(path);
  return {
    branch: readBranch(gitDir),
    githubUrl: githubUrlOf(readRemoteUrls(commonDir)),
  };
}
