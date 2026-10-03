import { execFile } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

const CACHE_FILE = join(homedir(), '.local/share/gitmob/env-checks.json');
const CACHE_TTL_MS = 60 * 60 * 1000;

type EnvStatus = 'ok' | 'warning' | 'error';

interface CachedCheck {
  status: EnvStatus;
  checkedAt: number;
}

type Cache = Record<string, CachedCheck>;

function readCache(): Cache {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeCache(cache: Cache): void {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // cache is best-effort; a failed write just means we recheck next time
  }
}

function runCheck(cwd: string): Promise<EnvStatus | null> {
  return new Promise((resolve) => {
    execFile(
      'rpass',
      ['env', 'check', '--json'],
      { cwd, timeout: 30000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve((JSON.parse(stdout) as { status: EnvStatus }).status);
      }
    );
  });
}

// Route handlers can each get their own copy of a module; a check already running is one
// to wait for, not to start again.
const IN_FLIGHT = Symbol.for('gitmob.envChecksInFlight');
const globalChecks = globalThis as unknown as {
  [IN_FLIGHT]?: Map<string, Promise<void>>;
};
const inFlight = (globalChecks[IN_FLIGHT] ??= new Map());

function check(project: { id: string; path: string }): Promise<void> {
  let running = inFlight.get(project.id);
  if (running === undefined) {
    running = runCheck(project.path)
      .then((status) => {
        // A failed check must not be cached as "no findings" for an hour: keep the stale
        // status and retry on the next request.
        if (status === null) {
          throw new Error(`rpass env check failed for ${project.id}`);
        }
        writeCache({
          ...readCache(),
          [project.id]: { status, checkedAt: Date.now() },
        });
      })
      .finally(() => inFlight.delete(project.id));
    inFlight.set(project.id, running);
  }
  return running;
}

/**
 * `rpass env check` from a project's checkout checks that one project. It decrypts saved env
 * files, so each result is kept on disk, and the project list answers from that alone: an
 * answer older than an hour is still the one it gets, with a new check started behind it. Only
 * the projects asked about — the ones open on the desktop — are checked at all. Keyed by
 * project id.
 */
export function getEnvCheckFailures(
  projects: { id: string; path: string }[],
  now: number = Date.now()
): Record<string, boolean> {
  const cache = readCache();
  for (const project of projects) {
    const cached = cache[project.id];
    if (!cached || now - cached.checkedAt >= CACHE_TTL_MS) {
      check(project).catch(() => {});
    }
  }

  const failures: Record<string, boolean> = {};
  for (const { id } of projects) {
    if (cache[id]) failures[id] = cache[id].status !== 'ok';
  }
  return failures;
}

/** Checks every one of `projects` now, and resolves once their answers are on disk. */
export async function refreshEnvChecks(
  projects: { id: string; path: string }[]
): Promise<void> {
  await Promise.all(projects.map(check));
}
