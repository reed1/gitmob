import { execFile } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

const CACHE_FILE = join(homedir(), '.local/share/gitmob/env-check-cache.json');
const CACHE_TTL_MS = 60 * 60 * 1000;

type EnvStatus = 'ok' | 'warning' | 'error';

interface Cache {
  checkedAt: number;
  statuses: Record<string, EnvStatus>;
}

function readCache(): Cache | null {
  try {
    const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    return typeof cache.checkedAt === 'number' && cache.statuses ? cache : null;
  } catch {
    return null;
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

function runCheckAll(): Promise<Record<string, EnvStatus> | null> {
  return new Promise((resolve) => {
    execFile(
      'rpass',
      ['env', 'check', '--all-projects', '--json'],
      { timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const entries = JSON.parse(stdout) as Array<{
          id: string;
          status: EnvStatus;
        }>;
        resolve(Object.fromEntries(entries.map((e) => [e.id, e.status])));
      }
    );
  });
}

/**
 * `rpass env check --all-projects` sweeps every project in one process, so this is a single
 * exec regardless of project count. It still decrypts saved env files, so the
 * result is cached on disk and only refreshed once it is older than an hour.
 */
export async function getEnvCheckFailures(
  now: number = Date.now()
): Promise<Record<string, boolean>> {
  const cached = readCache();
  let statuses: Record<string, EnvStatus>;

  if (cached && now - cached.checkedAt < CACHE_TTL_MS) {
    statuses = cached.statuses;
  } else {
    const fresh = await runCheckAll();
    // A failed sweep must not be cached as "no findings" for an hour: keep
    // serving the stale statuses and retry on the next request.
    if (fresh) writeCache({ checkedAt: now, statuses: fresh });
    statuses = fresh ?? cached?.statuses ?? {};
  }

  const failures: Record<string, boolean> = {};
  for (const [id, status] of Object.entries(statuses)) {
    failures[id] = status !== 'ok';
  }
  return failures;
}
