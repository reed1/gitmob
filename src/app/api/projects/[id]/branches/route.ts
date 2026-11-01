import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { getProject } from '@/lib/projects';
import {
  UnmergedBranch,
  listBranchRows,
  listWorktrees,
  removeBranch,
} from '@/lib/wtman';

/** Local and remote branches with no worktree, the remotes as of their last fetch. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    return NextResponse.json({ branches: await listBranchRows(project) });
  } catch (err) {
    return errorResponse(request, err, 'wtman branches failed');
  }
}

/**
 * Removes a local branch with no worktree. The row is looked up rather than taken from the
 * request, and whether it is merged is judged from that same fresh read.
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

  const { name, force }: { name: string; force: boolean } =
    await request.json();

  try {
    const row = (await listBranchRows(project)).find((r) => r.name === name);
    if (!row) {
      return NextResponse.json(
        { error: `No branch ${name} without a worktree` },
        { status: 404 }
      );
    }

    await removeBranch(project, row, force);

    return NextResponse.json({
      success: true,
      worktrees: await listWorktrees(project).catch(() => undefined),
    });
  } catch (err) {
    if (err instanceof UnmergedBranch) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return errorResponse(request, err, 'wtman remove failed');
  }
}
