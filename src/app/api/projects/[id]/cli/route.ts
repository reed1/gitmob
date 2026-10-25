import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { readCliJob, startCli } from '@/lib/cli';

/** The job is keyed by project id alone, so the poll costs no project lookup. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ job: readCliJob(id) });
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

  const { command, notify } = await request.json();
  if (!command?.trim()) {
    return NextResponse.json({ error: 'command required' }, { status: 400 });
  }

  const running = readCliJob(id);
  if (running?.status === 'running') {
    return NextResponse.json(
      { error: 'A command is already running for this project', job: running },
      { status: 409 }
    );
  }

  startCli(project, command, !!notify);

  return NextResponse.json({ job: readCliJob(id) });
}
