import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

export interface Checkout {
  /** `HEAD` when detached. */
  branch: string;
  /** When HEAD last moved — a commit, pull, reset or checkout — in epoch ms; null without a reflog. */
  headMovedAt: number | null;
}

/** A worktree's or submodule's `.git` is a file pointing at its git dir. */
function resolveGitDir(path: string): string {
  const dotGit = resolve(path, '.git');
  if (statSync(dotGit).isDirectory()) return dotGit;

  const pointer = readFileSync(dotGit, 'utf-8').match(/^gitdir:\s*(.+)$/m);
  if (!pointer) throw new Error(`${dotGit} names no git dir`);
  return resolve(path, pointer[1].trim());
}

/** A linked worktree's git dir names the repository's shared one in `commondir`. */
export function resolveCommonDir(path: string): string {
  const gitDir = resolveGitDir(path);
  const pointer = resolve(gitDir, 'commondir');
  if (!existsSync(pointer)) return gitDir;
  return resolve(gitDir, readFileSync(pointer, 'utf-8').trim());
}

function readBranch(gitDir: string): string {
  const head = readFileSync(resolve(gitDir, 'HEAD'), 'utf-8').trim();
  const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
  return ref ? ref[1] : 'HEAD';
}

/**
 * Git appends to the reflog every time HEAD moves, so its mtime is the last commit, pull, reset
 * or checkout. `HEAD` itself is rewritten only on a branch switch, and `index` and `FETCH_HEAD`
 * change on a status or a fetch that moves nothing.
 */
function readHeadMovedAt(gitDir: string): number | null {
  const reflog = resolve(gitDir, 'logs/HEAD');
  return existsSync(reflog) ? statSync(reflog).mtimeMs : null;
}

/**
 * Read off the git dir rather than asked of git: the project list wants this for every project,
 * and a spawn per project is what makes it slow. Null for a checkout that is not there, or is
 * not a git repository.
 */
export function readCheckout(path: string): Checkout | null {
  if (!existsSync(resolve(path, '.git'))) return null;
  const gitDir = resolveGitDir(path);
  return { branch: readBranch(gitDir), headMovedAt: readHeadMovedAt(gitDir) };
}
