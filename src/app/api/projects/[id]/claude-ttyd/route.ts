import { NextRequest, NextResponse } from 'next/server';
import { createServer } from 'net';
import { spawn, execSync } from 'child_process';
import { getProject } from '@/lib/projects';
import { registerSession } from '@/lib/claude-sessions';

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

  const port = await findFreePort();
  const tmuxSession = `gitmob-ttyd-${port}`;

  execSync(
    `tmux new-session -d -s ${tmuxSession} -c ${JSON.stringify(project.path)} claude`
  );
  execSync(`tmux set -t ${tmuxSession} status off`);
  execSync(`tmux set -t ${tmuxSession} mouse off`);
  execSync(`tmux setw -t ${tmuxSession} alternate-screen off`);
  execSync(
    `tmux set -t ${tmuxSession} terminal-overrides ',*:smcup@:rmcup@'`
  );

  const child = spawn(
    'ttyd',
    [
      '-q',
      '-p',
      String(port),
      '-W',
      '-t',
      'fontSize=14',
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
  });

  return NextResponse.json({ url, pid, tmuxSession });
}
