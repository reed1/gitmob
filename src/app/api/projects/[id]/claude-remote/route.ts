import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { getProject } from '@/lib/projects';
import { registerSession } from '@/lib/claude-sessions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const ALLOWED_PERMISSION_MODES = [
    'auto',
    'default',
    'bypassPermissions',
  ] as const;
  type PermissionMode = (typeof ALLOWED_PERMISSION_MODES)[number];
  let permissionMode: PermissionMode = 'auto';
  try {
    const body = await request.json();
    if (
      typeof body?.permissionMode === 'string' &&
      (ALLOWED_PERMISSION_MODES as readonly string[]).includes(
        body.permissionMode
      )
    ) {
      permissionMode = body.permissionMode as PermissionMode;
    }
  } catch {}

  const remoteDir = '/tmp/rlocal/gitmob/remote';
  mkdirSync(remoteDir, { recursive: true });
  const logFile = `${remoteDir}/${id}-${Date.now()}.log`;
  const logFd = openSync(logFile, 'w');

  let childPid = 0;
  const url = await new Promise<string>((resolve, reject) => {
    const folderName = project.path.split('/').pop() || id;
    const args = ['remote-control', '--name', folderName];
    args.push('--permission-mode', permissionMode);
    const child = spawn('claude', args, {
      cwd: project.path,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, CLAUDE_CODE_NO_FLICKER: '1' },
    });
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
