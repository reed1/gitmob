import { lstat, readFile } from 'fs/promises';
import { join } from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { codeToHtml } from 'shiki';
import { getLanguageFromPath } from './files';
import { loadDiffExclude } from './diff-exclude';

/** Past this many changed lines, one page of diffs is slow enough to ask first. */
export const REVIEW_LINE_LIMIT = 2000;

export type ReviewScope = 'staged' | 'all' | 'commit';

export type SkipReason = 'excluded' | 'binary' | 'symlink' | 'repository';

export type ReviewFile =
  | { kind: 'added'; path: string; lineCount: number; highlighted: string }
  | { kind: 'modified' | 'deleted'; path: string; diff: string }
  | { kind: 'renamed' | 'copied'; path: string; from: string; diff: string }
  | { kind: 'skipped'; path: string; reason: SkipReason };

export type Review =
  | { scope: ReviewScope; tooLarge: true; limit: number }
  | { scope: ReviewScope; tooLarge: false; files: ReviewFile[] };

interface Change {
  status: string;
  path: string;
  from?: string;
}

/** One change per path: git lists an unmerged one twice, as U and again as M. */
function parseNameStatus(output: string): Change[] {
  const tokens = output.split('\0');
  const changes: Change[] = [];
  let i = 0;
  while (i < tokens.length && tokens[i] !== '') {
    const status = tokens[i][0];
    if (status === 'R' || status === 'C') {
      changes.push({ status, from: tokens[i + 1], path: tokens[i + 2] });
      i += 3;
    } else {
      changes.push({ status, path: tokens[i + 1] });
      i += 2;
    }
  }
  const seen = new Set<string>();
  return changes.filter(({ path }) => !seen.has(path) && seen.add(path));
}

/** Changed lines per path, keyed by the new path of a rename; null for a binary file. */
function parseNumstat(output: string): Map<string, number | null> {
  const tokens = output.split('\0');
  const counts = new Map<string, number | null>();
  let i = 0;
  while (i < tokens.length && tokens[i] !== '') {
    const [added, deleted, ...rest] = tokens[i].split('\t');
    let path = rest.join('\t');
    if (path === '') {
      path = tokens[i + 2];
      i += 3;
    } else {
      i += 1;
    }
    counts.set(path, added === '-' ? null : Number(added) + Number(deleted));
  }
  return counts;
}

function countLines(text: string): number {
  if (text === '') return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

/** The hunks alone: the file's path already heads its section. */
function hunks(diff: string): string {
  const lines = diff.replace(/\n$/, '').split('\n');
  const start = lines.findIndex((line) => line.startsWith('@@'));
  return start === -1 ? '' : lines.slice(start).join('\n');
}

async function readUntracked(
  cwd: string,
  path: string
): Promise<{ content: string } | { reason: SkipReason }> {
  // ls-files reports a nested repository as its directory, slash and all.
  if (path.endsWith('/')) return { reason: 'repository' };
  const fullPath = join(cwd, path);
  if ((await lstat(fullPath)).isSymbolicLink()) return { reason: 'symlink' };
  const buffer = await readFile(fullPath);
  // Git's own test for a binary file: a NUL in the first 8000 bytes.
  if (buffer.subarray(0, 8000).includes(0)) return { reason: 'binary' };
  return { content: buffer.toString('utf-8') };
}

async function added(path: string, content: string): Promise<ReviewFile> {
  return {
    kind: 'added',
    path,
    lineCount: countLines(content),
    highlighted: await codeToHtml(content, {
      lang: getLanguageFromPath(path),
      theme: 'github-dark',
    }),
  };
}

const STAGED_DIFF = ['diff', '--cached', '-M', '--no-color', '--no-ext-diff'];
const WORKTREE_DIFF = ['diff', '-M', '--no-color', '--no-ext-diff'];

/** What a review diffs, and where a file it adds is read from. */
interface Source {
  scope: ReviewScope;
  diffArgs: string[];
  tracked: Change[];
  untracked: string[];
  readAdded: (path: string) => Promise<string>;
}

/** What the next commit would be: what is staged when anything is, otherwise the dirty tree. */
async function nextCommit(git: SimpleGit, cwd: string): Promise<Source> {
  const staged = parseNameStatus(
    await git.raw([...STAGED_DIFF, '--name-status', '-z'])
  );
  // An unmerged file sits in the index without being staged.
  if (staged.some((change) => change.status !== 'U')) {
    return {
      scope: 'staged',
      diffArgs: STAGED_DIFF,
      tracked: staged,
      untracked: [],
      readAdded: (path) => git.show([`:${path}`]),
    };
  }
  return {
    scope: 'all',
    diffArgs: WORKTREE_DIFF,
    tracked: parseNameStatus(
      await git.raw([...WORKTREE_DIFF, '--name-status', '-z'])
    ),
    untracked: (
      await git.raw(['ls-files', '--others', '--exclude-standard', '-z'])
    )
      .split('\0')
      .filter(Boolean),
    readAdded: (path) => readFile(join(cwd, path), 'utf-8'),
  };
}

/** A merge is diffed against its first parent, a root commit against the empty tree. */
async function pastCommit(git: SimpleGit, hash: string): Promise<Source> {
  const [commit, firstParent] = (
    await git.raw(['rev-list', '--parents', '-n1', hash, '--'])
  )
    .trim()
    .split(' ');
  const base =
    firstParent ??
    (await git.raw(['hash-object', '-t', 'tree', '/dev/null'])).trim();
  const diffArgs = [...WORKTREE_DIFF, base, commit];
  return {
    scope: 'commit',
    diffArgs,
    tracked: parseNameStatus(
      await git.raw([...diffArgs, '--name-status', '-z'])
    ),
    untracked: [],
    readAdded: (path) => git.show([`${commit}:${path}`]),
  };
}

async function renderTracked(
  git: SimpleGit,
  source: Source,
  { status, path, from }: Change
): Promise<ReviewFile> {
  if (status === 'A') return added(path, await source.readAdded(path));

  // A conflicted file's markers are only in the working tree, whatever the scope.
  const diffArgs = status === 'U' ? WORKTREE_DIFF : source.diffArgs;
  const paths = from === undefined ? [path] : [from, path];
  const diff = hunks(await git.raw([...diffArgs, '--', ...paths]));
  if (status === 'M' || status === 'T' || status === 'U') {
    return { kind: 'modified', path, diff };
  } else if (status === 'D') {
    return { kind: 'deleted', path, diff };
  } else if ((status === 'R' || status === 'C') && from !== undefined) {
    return { kind: status === 'R' ? 'renamed' : 'copied', path, from, diff };
  } else {
    throw new Error(`Unexpected diff status ${status} for ${path}`);
  }
}

/**
 * Every change on one page: the commit `hash` when given, otherwise what the next commit would
 * be, untracked files included. Changed lines are counted before any diff is read, and past
 * REVIEW_LINE_LIMIT the answer is only that — unless `force`.
 */
export async function getReview(
  cwd: string,
  force: boolean,
  hash: string | null
): Promise<Review> {
  const git = simpleGit(cwd);
  const isExcluded = await loadDiffExclude();

  const source =
    hash === null ? await nextCommit(git, cwd) : await pastCommit(git, hash);
  const { scope } = source;
  const lineCounts = parseNumstat(
    await git.raw([...source.diffArgs, '--numstat', '-z'])
  );

  let lineCount = 0;
  const overLimit = (lines: number) => {
    lineCount += lines;
    return !force && lineCount > REVIEW_LINE_LIMIT;
  };

  const renders: (() => Promise<ReviewFile>)[] = [];
  const skip = (path: string, reason: SkipReason) =>
    renders.push(async () => ({ kind: 'skipped', path, reason }));

  for (const change of source.tracked) {
    if (isExcluded(change.path)) {
      skip(change.path, 'excluded');
      continue;
    }
    const lines = lineCounts.get(change.path);
    if (lines === undefined) {
      throw new Error(`git diff --numstat has no entry for ${change.path}`);
    }
    if (lines === null) {
      skip(change.path, 'binary');
      continue;
    }
    if (overLimit(lines))
      return { scope, tooLarge: true, limit: REVIEW_LINE_LIMIT };
    renders.push(() => renderTracked(git, source, change));
  }

  for (const path of source.untracked) {
    if (isExcluded(path)) {
      skip(path, 'excluded');
      continue;
    }
    const file = await readUntracked(cwd, path);
    if ('reason' in file) {
      skip(path, file.reason);
      continue;
    }
    if (overLimit(countLines(file.content)))
      return { scope, tooLarge: true, limit: REVIEW_LINE_LIMIT };
    renders.push(() => added(path, file.content));
  }

  return {
    scope,
    tooLarge: false,
    files: await Promise.all(renders.map((render) => render())),
  };
}
