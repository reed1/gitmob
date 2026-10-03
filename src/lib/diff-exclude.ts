import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import picomatch from 'picomatch';
import { parse } from 'yaml';

const DIFF_EXCLUDE_PATH = join(homedir(), '.config/git/diff-exclude.yaml');

/**
 * The dotfiles' list of files whose diffs nobody reads — lockfiles, notebooks, vaults — shared
 * with gg's AI commit message and the powerts formatter. Globs as in .gitignore: a slashless one
 * matches the file name in any directory.
 */
export async function loadDiffExclude(): Promise<(path: string) => boolean> {
  const patterns: unknown = parse(await readFile(DIFF_EXCLUDE_PATH, 'utf-8'));
  if (
    !Array.isArray(patterns) ||
    !patterns.every((p) => typeof p === 'string')
  ) {
    throw new Error(`${DIFF_EXCLUDE_PATH} is not a list of globs`);
  }
  return picomatch(
    patterns.map((p) => (p.includes('/') ? p : `**/${p}`)),
    { dot: true }
  );
}
