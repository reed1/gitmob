import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  captureLog,
  getRunStatus,
  startRun,
  stopRun,
  restartRun,
} from '@/lib/run';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const action = request.nextUrl.searchParams.get('action');

  if (action === 'status') {
    const runs = getRunStatus(id, project.cmd);
    return NextResponse.json({
      runs,
      hasRuns: runs.length > 0,
    });
  }

  if (action === 'logs') {
    const name = request.nextUrl.searchParams.get('name');
    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }
    return NextResponse.json(captureLog(id, name));
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
  const { action, runName } = body;

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  let result: { success: boolean; error?: string };

  if (!runName) {
    return NextResponse.json({ error: 'Missing runName' }, { status: 400 });
  } else if (action === 'start') {
    result = await startRun(id, runName);
  } else if (action === 'stop') {
    result = await stopRun(id, runName, project.cmd);
  } else if (action === 'restart') {
    result = await restartRun(id, runName, project.cmd);
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
