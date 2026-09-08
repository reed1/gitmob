import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { getProject } from '@/lib/projects';
import { readCloneJob, startClone } from '@/lib/clone';

/**
 * The poll while a clone runs. The job is keyed by project id alone, so this costs no lookup —
 * and an id with no clone behind it answers with a null job rather than an error.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ job: readCloneJob(id) });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const running = readCloneJob(id);
  if (running?.status === 'running') {
    return NextResponse.json(
      { error: 'A clone is already running for this project', job: running },
      { status: 409 }
    );
  }

  // A worktree is wtman's to create — cloning into its path would put a second checkout of the
  // repo where git expects the worktree it is tracking.
  if (project.worktreeName) {
    return NextResponse.json(
      { error: 'A worktree is created by wtman, not cloned' },
      { status: 409 }
    );
  }
  if (!project.repo) {
    return NextResponse.json(
      { error: 'No repository is configured for this project' },
      { status: 409 }
    );
  }
  if (existsSync(project.path)) {
    return NextResponse.json(
      { error: `${project.path} already exists` },
      { status: 409 }
    );
  }

  startClone(project, project.repo);

  return NextResponse.json({ job: readCloneJob(id) });
}
