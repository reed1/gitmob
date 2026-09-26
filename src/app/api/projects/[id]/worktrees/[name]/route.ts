import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  UnmergedBranch,
  listWorktrees,
  mergeWorktree,
  openWorktree,
  removeWorktree,
} from '@/lib/wtman';

type Action =
  | { action: 'open' }
  | { action: 'merge'; squash: boolean }
  | { action: 'remove'; removeBranch: boolean; force: boolean };

/**
 * The worktree is looked up rather than taken from the request: the branch wtman is handed is
 * the repo's answer, not the caller's, and a name that is no longer there must not reach `wtman
 * open`, which would take it for a branch to create. Merge and remove judge whether the branch
 * is merged from the same fresh read.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body: Action = await request.json();

  try {
    const worktree = (await listWorktrees(project)).find(
      (w) => w.name === name
    );
    if (!worktree) {
      return NextResponse.json(
        { error: `No worktree named ${name}` },
        { status: 404 }
      );
    }

    if (body.action === 'open') {
      await openWorktree(project, worktree);
    } else if (body.action === 'merge') {
      await mergeWorktree(project, worktree, body.squash);
    } else if (body.action === 'remove') {
      await removeWorktree(project, worktree, body.removeBranch, body.force);
    } else {
      throw new Error(
        `Unexpected action: ${(body as { action: string }).action}`
      );
    }

    return NextResponse.json({
      success: true,
      projectId: worktree.projectId,
      worktrees: await listWorktrees(project).catch(() => undefined),
    });
  } catch (err) {
    if (err instanceof UnmergedBranch) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : `wtman ${body.action} failed`,
      },
      { status: 500 }
    );
  }
}
