import { execFile } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { resolveCommonDir } from './checkout';

/**
 * `gg hold` stops a repository's autopush and auto-pull, across every worktree and branch of it,
 * once a branch is rewound or amended. The hold is a file gg keeps in the common git dir, one
 * line per rewind. It is read off that file rather than asked of `gg hold check`: the project
 * list wants it for every project, and a spawn per project is what makes the list slow.
 * Null when the repository is not held, or the checkout is not there.
 */
export function readHold(path: string): string[] | null {
  if (!existsSync(resolve(path, '.git'))) return null;
  const holdFile = resolve(resolveCommonDir(path), 'gg-hold');
  if (!existsSync(holdFile)) return null;
  return readFileSync(holdFile, 'utf-8').split('\n').filter(Boolean);
}

export function releaseHold(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'gg',
      ['hold', 'release'],
      { cwd: path, timeout: 10000 },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr.trim() || error.message));
        else resolve();
      }
    );
  });
}
