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

/**
 * `rpass env check` from a project's checkout checks that one project. It decrypts saved env
 * files, so each result is cached on disk and only rechecked once it is older than an hour,
 * and only the projects asked about — the ones open on the desktop — are checked at all.
 * Keyed by project id.
 */
export async function getEnvCheckFailures(
  projects: { id: string; path: string }[],
  now: number = Date.now()
): Promise<Record<string, boolean>> {
  const cache = readCache();
  const due = projects.filter(
    (project) =>
      !cache[project.id] || now - cache[project.id].checkedAt >= CACHE_TTL_MS
  );

  const fresh = await Promise.all(
    due.map(async (project) => ({
      id: project.id,
      status: await runCheck(project.path),
    }))
  );
  // A failed check must not be cached as "no findings" for an hour: keep serving the stale
  // status and retry on the next request.
  const checked = fresh.filter((check) => check.status !== null);
  for (const { id, status } of checked) {
    cache[id] = { status: status as EnvStatus, checkedAt: now };
  }
  if (checked.length > 0) writeCache(cache);

  const failures: Record<string, boolean> = {};
  for (const { id } of projects) {
    if (cache[id]) failures[id] = cache[id].status !== 'ok';
  }
  return failures;
}
