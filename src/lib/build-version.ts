import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

/** Written by `run_production.sh` after every successful compile — the sha being served. */
const BUILD_SHA_FILE = join(homedir(), '.cache/rlocal/gitmob/build_sha');

export interface StaleBuild {
  builtSha: string;
  headSha: string;
  /** Commits from the built one up to HEAD, or null when the built sha is no longer in the repo. */
  behind: number | null;
}

function git(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd: process.cwd(), timeout: 5000 },
      (error, stdout) => resolve(error ? null : stdout.trim())
    );
  });
}

/**
 * The deployed server against the checkout it was built from. Only the deployed one can fall
 * behind — a dev server compiles the working tree as it goes — so the other two dist dirs report
 * nothing, and neither does a missing build sha, which is no answer rather than a stale one.
 *
 * Restarting is the whole fix: `run_production.sh` rebuilds whatever HEAD says on the way up.
 */
export async function getStaleBuild(): Promise<StaleBuild | null> {
  if (process.env.GITMOB_DIST_DIR !== '.next-prod') return null;

  const [builtSha, headSha] = await Promise.all([
    readFile(BUILD_SHA_FILE, 'utf8')
      .then((sha) => sha.trim())
      .catch(() => null),
    git(['rev-parse', 'HEAD']),
  ]);
  if (!builtSha || !headSha || builtSha === headSha) return null;

  const count = await git(['rev-list', '--count', `${builtSha}..${headSha}`]);
  return { builtSha, headSha, behind: count ? Number(count) : null };
}
