import { NextRequest, NextResponse } from 'next/server';
import { createServer } from 'net';
import { spawn, execSync } from 'child_process';
import { getProject } from '@/lib/projects';
import { registerSession } from '@/lib/claude-sessions';
import { startChromeMcp, ChromeMcpHandle } from '@/lib/chrome-mcp';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let bypassPermissions = true;
  let chromeMcp = false;
  try {
    const body = await request.json();
    if (typeof body?.bypassPermissions === 'boolean') {
      bypassPermissions = body.bypassPermissions;
    }
    if (typeof body?.chromeMcp === 'boolean') {
      chromeMcp = body.chromeMcp;
    }
  } catch {}

  let chromeHandle: ChromeMcpHandle | null = null;
  if (chromeMcp) {
    chromeHandle = await startChromeMcp();
  }

  const port = await findFreePort();
  const tmuxSession = `gitmob-ttyd-${port}`;

  let claudeCmd = bypassPermissions
    ? 'claude --permission-mode bypassPermissions'
    : 'claude';
  if (chromeHandle) {
    claudeCmd += ` --mcp-config ${JSON.stringify(chromeHandle.mcpConfigPath)}`;
  }
  execSync(
    `tmux new-session -d -s ${tmuxSession} -c ${JSON.stringify(project.path)} ${claudeCmd}`
  );
  execSync(`tmux set -t ${tmuxSession} status off`);
  execSync(`tmux set -t ${tmuxSession} mouse off`);
  execSync(`tmux setw -t ${tmuxSession} alternate-screen off`);
  execSync(`tmux set -t ${tmuxSession} terminal-overrides ',*:smcup@:rmcup@'`);

  const child = spawn(
    'ttyd',
    [
      '-q',
      '-p',
      String(port),
      '-W',
      '-t',
      'fontSize=12',
      '-t',
      'fontFamily=ui-monospace, "SF Mono", Menlo, Consolas, "JetBrains Mono", "Fira Code", "Cascadia Code", "DejaVu Sans Mono", monospace',
      '-t',
      'scrollback=3000',
      '-t',
      'closeOnDisconnect=true',
      'tmux',
      'attach',
      '-t',
      tmuxSession,
    ],
    {
      detached: true,
      stdio: 'ignore',
    }
  );
  child.unref();

  const pid = child.pid ?? 0;
  const host = request.headers.get('host') ?? 'localhost';
  const hostname = host.replace(/:\d+$/, '');
  const url = `http://${hostname}:${port}`;

  registerSession({
    projectId: id,
    projectPath: project.path,
    url,
    pid,
    startedAt: Date.now(),
    type: 'ttyd',
    auxPid: chromeHandle?.chromiumPid,
  });

  return NextResponse.json({ url, pid, tmuxSession });
}
