import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { createWorktree, listWorktrees } from '@/lib/wtman';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    return NextResponse.json({ worktrees: await listWorktrees(project) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'wtman list failed' },
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

  const { branch } = await request.json();

  // Everything else about the name is git's to judge, and its complaint is a better one than
  // any check here would be.
  if (branch.trim() === '') {
    return NextResponse.json(
      { error: 'Branch name is empty' },
      { status: 400 }
    );
  }

  try {
    const created = await createWorktree(project, branch.trim());
    return NextResponse.json({
      success: true,
      projectId: created.projectId,
      worktrees: await listWorktrees(project).catch(() => undefined),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'wtman open failed' },
      { status: 500 }
    );
  }
}
