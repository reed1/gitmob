import { readdirSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Commits `gg kitty-commit` parked instead of reviewing, which is what it does whenever the
 * user is not at the desktop: the message waits here for them to accept or reject it, the way
 * `claudex handoff` parks a briefing nobody has read yet. One file per parked commit, written
 * by gg and consumed here.
 */
const PENDING_COMMITS_DIR = join(
  homedir(),
  '.local/share/gitmob/pending-commits'
);

export interface PendingCommit {
  id: string;
  /** The repository the commit lands in — the toplevel, not wherever gg was run. */
  repo: string;
  /** Where gg was run, when that was below the toplevel; null when it was the toplevel. */
  cwd: string | null;
  /** Subject, blank line and body, exactly as it will be committed. */
  message: string;
  createdAt: string;
  source: string;
  /** The kitty window of the session that parked it, null when it had none. */
  windowId: string | null;
  /** Whether accepting should also send that session to purgatory — only the default. */
  closeSession: boolean;
}

/** The id is a filename, and it arrives from the browser. */
export function isPendingCommitId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]+$/.test(value);
}

function pendingCommitPath(id: string): string {
  if (!isPendingCommitId(id)) {
    throw new Error(`Unexpected pending commit id: ${id}`);
  }
  return join(PENDING_COMMITS_DIR, `${id}.txt`);
}

function parseBoolean(id: string, value: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Unexpected Close-Session in ${id}: ${value}`);
}

/**
 * Headers, a blank line, then the message — a commit object's own shape. Splitting once at the
 * first blank line is what keeps a body free: a line reading `Fix: whatever`, or a `---` fence,
 * is message rather than syntax because the headers were already over.
 */
function parsePendingCommit(id: string, text: string): PendingCommit {
  const separator = text.indexOf('\n\n');
  if (separator === -1) {
    throw new Error(`Pending commit ${id} has headers but no message`);
  }

  const headers = new Map<string, string>();
  for (const line of text.slice(0, separator).split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) {
      throw new Error(`Unexpected header line in ${id}: ${line}`);
    }
    headers.set(line.slice(0, colon), line.slice(colon + 1).trim());
  }

  const required = (name: string): string => {
    const value = headers.get(name);
    if (value === undefined) {
      throw new Error(`Pending commit ${id} has no ${name} header`);
    }
    return value;
  };

  const closeSession = headers.get('Close-Session');

  return {
    id,
    repo: required('Repo'),
    cwd: headers.get('Cwd') ?? null,
    message: text.slice(separator + 2).trim(),
    createdAt: required('Time'),
    source: required('Source'),
    windowId: headers.get('Window') ?? null,
    closeSession:
      closeSession === undefined ? false : parseBoolean(id, closeSession),
  };
}

function readPendingCommitFile(id: string): PendingCommit {
  return parsePendingCommit(id, readFileSync(pendingCommitPath(id), 'utf-8'));
}

function pendingCommitIds(): string[] {
  if (!existsSync(PENDING_COMMITS_DIR)) return [];
  return readdirSync(PENDING_COMMITS_DIR)
    .filter((name) => name.endsWith('.txt'))
    .map((name) => name.slice(0, -'.txt'.length));
}

/** Every parked commit, oldest first: the one waiting longest is the one to answer. */
export function listPendingCommits(): PendingCommit[] {
  return pendingCommitIds()
    .map(readPendingCommitFile)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function readPendingCommit(id: string): PendingCommit | null {
  if (!existsSync(pendingCommitPath(id))) return null;
  return readPendingCommitFile(id);
}

/**
 * The commit parked for one repository, matched on the path exactly. A repository inside
 * another is its own: committing `gloss/datasets/oss` from `gloss` would commit the wrong
 * repository, so being underneath one is never being it.
 */
export function findPendingCommitForRepo(
  repoPath: string
): PendingCommit | null {
  return listPendingCommits().find((c) => c.repo === repoPath) ?? null;
}

export function deletePendingCommit(id: string): void {
  const path = pendingCommitPath(id);
  if (existsSync(path)) unlinkSync(path);
}

/**
 * The session that parked a commit holds the repository's commit lock until it lands, so
 * whichever way the commit is answered the lock has to go back — a session parked while still
 * holding it would take it to the grave.
 */
export function releaseCommitLock(repoPath: string): void {
  execFileSync('claudex', ['gitlock', 'release', '--repo', repoPath], {
    stdio: 'ignore',
  });
}
