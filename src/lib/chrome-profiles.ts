import {
  existsSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const PROFILE_ROOT =
  process.env.GITMOB_CHROMIUM_PROFILES ??
  join(homedir(), '.local/share/gitmob/chromium-profiles');

export const THROWAWAY_ROOT = '/tmp/rlocal/gitmob/chromium-profiles';

const PROFILE_ID_RE = /^[a-zA-Z0-9._-]+$/;

export function profileDir(id: string): string {
  if (!PROFILE_ID_RE.test(id)) {
    throw new Error(`Invalid profile id: ${id}`);
  }
  return join(PROFILE_ROOT, id);
}

/**
 * Chromium writes DevToolsActivePort into the user-data-dir on startup:
 * line 1 is the debugging port, line 2 the browser websocket path. The file
 * survives a crash, so callers must probe the port before trusting it.
 */
export function readDevToolsPort(dir: string): number | null {
  const file = join(dir, 'DevToolsActivePort');
  if (!existsSync(file)) return null;
  const port = Number(readFileSync(file, 'utf8').split('\n')[0]?.trim());
  return Number.isInteger(port) && port > 0 ? port : null;
}

export async function fetchWsEndpoint(
  port: number,
  timeoutMs = 0
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const data = await res.json();
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch {}
    if (timeoutMs > 0) await new Promise((r) => setTimeout(r, 200));
  } while (Date.now() < deadline);
  return null;
}

/**
 * Chromium's own profile lock: a symlink named `<hostname>-<pid>`. A crash
 * leaves it behind, so the owning pid has to be checked for liveness the same
 * way chromium does before treating the profile as locked.
 */
export function lockOwnerPid(dir: string): number | null {
  let target: string;
  try {
    target = readlinkSync(join(dir, 'SingletonLock'));
  } catch {
    return null;
  }
  const pid = Number(target.split('-').pop());
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
  } catch {
    return null;
  }
  return pid;
}

export interface RunningBrowser {
  pid: number;
  dir: string;
}

export function listRunningBrowsers(): RunningBrowser[] {
  const found: RunningBrowser[] = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    let cmdline: string;
    try {
      cmdline = readFileSync(`/proc/${entry}/cmdline`, 'utf8');
    } catch {
      continue; // process exited while we were scanning
    }
    // Chromium rewrites its argv into one space-separated blob, so /proc
    // cmdline is not reliably NUL-delimited for these processes.
    const args = cmdline.split(/[\0\s]+/).filter(Boolean);
    if (args.some((a) => a.startsWith('--type='))) continue; // renderer/gpu child
    const arg = args.find((a) => a.startsWith('--user-data-dir='));
    if (!arg) continue;
    const dir = arg.slice('--user-data-dir='.length);
    if (
      dir.startsWith(`${PROFILE_ROOT}/`) ||
      dir.startsWith(`${THROWAWAY_ROOT}/`)
    ) {
      found.push({ pid: Number(entry), dir });
    }
  }
  return found;
}

/** SIGTERM so chromium flushes cookies and session state before exiting. */
export function closeAllBrowsers(): RunningBrowser[] {
  const running = listRunningBrowsers();
  for (const { pid } of running) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
  return running;
}

export interface ProfileInfo {
  id: string;
  lastUsed: number;
  running: boolean;
}

export async function listProfiles(): Promise<ProfileInfo[]> {
  if (!existsSync(PROFILE_ROOT)) return [];
  const dirs = readdirSync(PROFILE_ROOT, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && PROFILE_ID_RE.test(e.name)
  );
  const infos = await Promise.all(
    dirs.map(async (e) => {
      const dir = join(PROFILE_ROOT, e.name);
      const port = readDevToolsPort(dir);
      return {
        id: e.name,
        lastUsed: statSync(dir).mtimeMs,
        running: port !== null && (await fetchWsEndpoint(port)) !== null,
      };
    })
  );
  return infos.sort((a, b) => b.lastUsed - a.lastUsed);
}
