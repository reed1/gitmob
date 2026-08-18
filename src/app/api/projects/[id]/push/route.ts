import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { getPushConfig, readPushJob, startPush } from '@/lib/push';
import { checkSelection, PushSelection } from '@/lib/push-command';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // The poll while a push runs: just the log, without re-asking pt what could be pushed.
  if (request.nextUrl.searchParams.get('action') === 'job') {
    return NextResponse.json({ job: readPushJob(id) });
  }

  try {
    const config = await getPushConfig(project);
    return NextResponse.json({ config, job: readPushJob(id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'pt push config failed' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const selection: PushSelection = {
    servers: body.servers ?? [],
    targets: body.targets ?? [],
    scope: body.scope ?? null,
  };

  const running = readPushJob(id);
  if (running?.status === 'running') {
    return NextResponse.json(
      { error: 'A push is already running for this project', job: running },
      { status: 409 }
    );
  }

  const config = await getPushConfig(project);
  const problem = checkSelection(config, selection);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  startPush(project, selection, !!body.notify);

  return NextResponse.json({ job: readPushJob(id) });
}
