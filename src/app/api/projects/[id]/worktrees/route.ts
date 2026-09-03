import { NextRequest, NextResponse } from 'next/server';
import { Project, getProject } from '@/lib/projects';
import {
  ProjectWorktree,
  createWorktree,
  listWorktrees,
  openWorktree,
} from '@/lib/wtman';

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

  const { name, branch } = await request.json();

  // A create carries `branch`, an open carries `name`. Everything else about the name is
  // git's to judge, and its complaint is a better one than any check here would be.
  if (branch !== undefined && branch.trim() === '') {
    return NextResponse.json(
      { error: 'Branch name is empty' },
      { status: 400 }
    );
  }

  try {
    const opened =
      branch === undefined
        ? await openExisting(project, name)
        : await createWorktree(project, branch.trim());

    return NextResponse.json({
      success: true,
      projectId: opened.projectId,
      worktrees: await listWorktrees(project).catch(() => undefined),
    });
  } catch (err) {
    if (err instanceof NoSuchWorktree) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'wtman open failed' },
      { status: 500 }
    );
  }
}

class NoSuchWorktree extends Error {}

/**
 * The worktree is looked up rather than taken from the request: the branch to open on is the
 * repo's answer, not the caller's, and a name that is no longer there must not reach `wtman
 * open`, which would take it for a branch to create.
 */
async function openExisting(
  project: Project,
  name: string
): Promise<ProjectWorktree> {
  const worktrees = await listWorktrees(project);
  const worktree = worktrees.find((w) => w.name === name);

  if (!worktree) {
    throw new NoSuchWorktree(`No worktree named ${name}`);
  }

  await openWorktree(project, worktree);
  return worktree;
}
