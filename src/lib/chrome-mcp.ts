import { spawn } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  PROFILE_ROOT,
  THROWAWAY_ROOT,
  fetchWsEndpoint,
  lockOwnerPid,
  profileDir,
  readDevToolsPort,
} from './chrome-profiles';

const MCP_DIR = '/tmp/rlocal/gitmob/mcp';
const CHROMIUM = process.env.GITMOB_CHROMIUM ?? 'chromium';

export interface ChromeMcpHandle {
  mcpConfigPath: string;
  /** Absent when attaching to a browser we did not spawn — do not kill it. */
  chromiumPid?: number;
}

function spawnChromium(dir: string): number {
  const child = spawn(
    CHROMIUM,
    [
      '--headless=new',
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${dir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
  if (!child.pid) {
    throw new Error('Failed to spawn chromium');
  }
  return child.pid;
}

async function waitForWsEndpoint(
  dir: string,
  timeoutMs = 15000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const port = readDevToolsPort(dir);
    if (port !== null) {
      const ws = await fetchWsEndpoint(port);
      if (ws) return ws;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timed out waiting for chromium debugger');
}

/**
 * `profileId` null means a one-time profile discarded with /tmp. A named
 * profile that is already open (e.g. launched on the desktop via
 * scripts/browser) is attached to rather than relaunched, since chromium
 * only allows one process per user-data-dir.
 */
export async function startChromeMcp(
  profileId: string | null
): Promise<ChromeMcpHandle> {
  mkdirSync(MCP_DIR, { recursive: true });

  let dir: string;
  let chromiumPid: number | undefined;
  let wsUrl: string;

  if (profileId === null) {
    mkdirSync(THROWAWAY_ROOT, { recursive: true });
    dir = mkdtempSync(join(THROWAWAY_ROOT, 'p-'));
    chromiumPid = spawnChromium(dir);
  } else {
    dir = profileDir(profileId);
    mkdirSync(PROFILE_ROOT, { recursive: true });
    mkdirSync(dir, { recursive: true });
    const port = readDevToolsPort(dir);
    const existing = port === null ? null : await fetchWsEndpoint(port);
    if (!existing) {
      const owner = lockOwnerPid(dir);
      if (owner !== null) {
        throw new Error(
          `Profile '${profileId}' is already open without remote debugging (pid ${owner}). ` +
            `Close it, or reopen it with: scripts/browser open ${profileId}`
        );
      }
      chromiumPid = spawnChromium(dir);
    }
  }

  try {
    wsUrl = await waitForWsEndpoint(dir);
  } catch (e) {
    if (chromiumPid) {
      try {
        process.kill(chromiumPid);
      } catch {}
    }
    throw e;
  }

  const config = {
    mcpServers: {
      'chrome-devtools': {
        command: 'npx',
        args: ['-y', 'chrome-devtools-mcp@latest', `--wsEndpoint=${wsUrl}`],
      },
    },
  };
  const mcpConfigPath = join(
    MCP_DIR,
    `mcp-chromium-${profileId ?? 'throwaway'}-${Date.now()}.json`
  );
  writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));

  return { mcpConfigPath, chromiumPid };
}
