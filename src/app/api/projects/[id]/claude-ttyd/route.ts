import { NextRequest, NextResponse } from 'next/server';
import { createServer } from 'net';
import { spawn } from 'child_process';
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

  const child = spawn(
    'ttyd',
    ['-o', '-p', String(port), '-W', '-w', project.path, 'claude'],
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

  return NextResponse.json({ url, pid });
}
