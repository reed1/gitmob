import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { getProject } from '@/lib/projects';
import { registerSession } from '@/lib/claude-sessions';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const remoteDir = '/tmp/rlocal/gitmob/remote';
  mkdirSync(remoteDir, { recursive: true });
  const logFile = `${remoteDir}/${id}-${Date.now()}.log`;
  const logFd = openSync(logFile, 'w');

  let childPid = 0;
  const url = await new Promise<string>((resolve, reject) => {
    const folderName = project.path.split('/').pop() || id;
    const child = spawn(
      'claude',
      [
        'remote-control',
        '--name',
        folderName,
        '--permission-mode',
        'bypassPermissions',
      ],
      {
        cwd: project.path,
        detached: true,
        stdio: ['ignore', logFd, logFd],
      }
    );
    childPid = child.pid ?? 0;
    child.unref();

    const cleanup = () => {
      clearInterval(poll);
      clearTimeout(timeout);
      try {
        unlinkSync(logFile);
      } catch {}
    };

    const timeout = setTimeout(() => {
      cleanup();
      child.kill();
      reject(new Error('Timed out waiting for URL'));
    }, 10000);

    const poll = setInterval(() => {
      const content = readFileSync(logFile, 'utf-8');
      const match = content.match(/https:\/\/\S+/);
      if (match) {
        cleanup();
        resolve(match[0]);
      }
    }, 200);
  });

  registerSession({
    projectId: id,
    projectPath: project.path,
    url,
    pid: childPid,
    startedAt: Date.now(),
    type: 'remote',
  });

  return NextResponse.json({ url, pid: childPid });
}
