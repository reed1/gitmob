import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  createWorktree,
  createWorktreeFrom,
  listBranchRows,
  listWorktrees,
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

type Create =
  | { from: 'main'; branch: string }
  | { from: 'branch'; name: string };

/**
 * A worktree for a new branch off main, or for a local or remote branch with none. The
 * existing branch is looked up rather than taken from the request, so only a row the tab listed
 * reaches wtman.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body: Create = await request.json();

  try {
    let projectId: string;

    if (body.from === 'main') {
      // Everything else about the name is git's and wtman's to judge, a name already taken
      // included, and their complaint is a better one than any check here would be.
      if (body.branch.trim() === '') {
        return NextResponse.json(
          { error: 'Branch name is empty' },
          { status: 400 }
        );
      }
      projectId = (await createWorktree(project, body.branch.trim())).projectId;
    } else if (body.from === 'branch') {
      const row = (await listBranchRows(project)).find(
        (r) => r.name === body.name
      );
      if (!row) {
        return NextResponse.json(
          { error: `No branch ${body.name} without a worktree` },
          { status: 404 }
        );
      }
      projectId = (await createWorktreeFrom(project, row)).projectId;
    } else {
      throw new Error(`Unexpected source: ${(body as { from: string }).from}`);
    }

    return NextResponse.json({
      success: true,
      projectId,
      worktrees: await listWorktrees(project).catch(() => undefined),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'wtman failed' },
      { status: 500 }
    );
  }
}
