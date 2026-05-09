import { spawn } from 'child_process';
import { createServer } from 'net';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';

const MCP_DIR = '/tmp/rlocal/gitmob/mcp';
const PROFILE_BASE = '/tmp/rlocal/gitmob/chromium-profiles';

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to get port'));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function fetchWsEndpoint(
  port: number,
  timeoutMs = 10000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      if (res.ok) {
        const data = await res.json();
        if (data.webSocketDebuggerUrl) {
          return data.webSocketDebuggerUrl as string;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timed out waiting for chromium debugger');
}

export interface ChromeMcpHandle {
  mcpConfigPath: string;
  chromiumPid: number;
}

export async function startChromeMcp(): Promise<ChromeMcpHandle> {
  mkdirSync(MCP_DIR, { recursive: true });
  mkdirSync(PROFILE_BASE, { recursive: true });

  const port = await findFreePort();
  const profileDir = mkdtempSync(join(PROFILE_BASE, 'p-'));

  const child = spawn(
    'chromium',
    [
      '--headless=new',
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    {
      detached: true,
      stdio: 'ignore',
    }
  );
  child.unref();
  const chromiumPid = child.pid ?? 0;
  if (!chromiumPid) {
    throw new Error('Failed to spawn chromium');
  }

  let wsUrl: string;
  try {
    wsUrl = await fetchWsEndpoint(port);
  } catch (e) {
    try {
      process.kill(chromiumPid);
    } catch {}
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
    `mcp-chromium-${chromiumPid}-${Date.now()}.json`
  );
  writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));

  return { mcpConfigPath, chromiumPid };
}
