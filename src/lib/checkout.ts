import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

export interface Checkout {
  /** `HEAD` when detached. */
  branch: string;
}

/** A worktree's or submodule's `.git` is a file pointing at its git dir. */
function resolveGitDir(path: string): string {
  const dotGit = resolve(path, '.git');
  if (statSync(dotGit).isDirectory()) return dotGit;

  const pointer = readFileSync(dotGit, 'utf-8').match(/^gitdir:\s*(.+)$/m);
  if (!pointer) throw new Error(`${dotGit} names no git dir`);
  return resolve(path, pointer[1].trim());
}

function readBranch(gitDir: string): string {
  const head = readFileSync(resolve(gitDir, 'HEAD'), 'utf-8').trim();
  const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
  return ref ? ref[1] : 'HEAD';
}

/**
 * The branch, read off the git dir rather than asked of git: the project list wants it for
 * every project, and a spawn per project is what makes it slow. Null for a checkout that is not
 * there, or is not a git repository.
 */
export function readCheckout(path: string): Checkout | null {
  if (!existsSync(resolve(path, '.git'))) return null;
  return { branch: readBranch(resolveGitDir(path)) };
}
