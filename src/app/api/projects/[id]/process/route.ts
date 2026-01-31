import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  getProcessStatus,
  startProcess,
  stopProcess,
  restartProcess,
  stopAllProcesses,
} from '@/lib/process';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const action = request.nextUrl.searchParams.get('action');

  if (action === 'status') {
    const processes = getProcessStatus(id, project.cmd);
    return NextResponse.json({
      processes,
      hasProcesses: processes.length > 0,
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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

  const body = await request.json();
  const { action, processName } = body;

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  let result: { success: boolean; error?: string };

  if (action === 'stopAll') {
    result = await stopAllProcesses(id);
  } else if (!processName) {
    return NextResponse.json(
      { error: 'Missing processName' },
      { status: 400 }
    );
  } else if (action === 'start') {
    result = await startProcess(id, processName);
  } else if (action === 'stop') {
    result = await stopProcess(id, processName);
  } else if (action === 'restart') {
    result = await restartProcess(id, processName);
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
