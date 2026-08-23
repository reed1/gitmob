import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { getPushConfig, readPushJob, resolvePush, startPush } from '@/lib/push';
import { checkSelection, PushSelection } from '@/lib/push-command';

function selectionFromQuery(params: URLSearchParams): PushSelection {
  const list = (name: string) =>
    (params.get(name) ?? '').split(',').filter(Boolean);
  return {
    servers: list('servers'),
    targets: list('targets'),
    scope: params.get('scope'),
  };
}

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

  // What the tab confirms against, asked when Push is tapped: pt's dry run of this selection.
  if (request.nextUrl.searchParams.get('action') === 'resolve') {
    try {
      const resolution = await resolvePush(
        project,
        selectionFromQuery(request.nextUrl.searchParams)
      );
      return NextResponse.json({ resolution });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'pt push -n failed' },
        { status: 500 }
      );
    }
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
