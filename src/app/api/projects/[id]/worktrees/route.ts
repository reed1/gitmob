import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  createWorktree,
  listBranches,
  listRemoteBranches,
  openRemoteBranch,
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
    return NextResponse.json(await listBranches(project));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'wtman list failed' },
      { status: 500 }
    );
  }
}

type Create =
  | { from: 'main'; branch: string }
  | { from: 'remote'; name: string };

/**
 * A new branch off main, or a worktree for a remote branch. The remote one is looked up rather
 * than taken from the request: `wtman open` given a name that is not there would create it.
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
    } else if (body.from === 'remote') {
      const remote = (await listRemoteBranches(project)).find(
        (r) => r.name === body.name
      );
      if (!remote) {
        return NextResponse.json(
          { error: `No remote branch ${body.name} without a local one` },
          { status: 404 }
        );
      }
      projectId = (await openRemoteBranch(project, remote)).projectId;
    } else {
      throw new Error(`Unexpected source: ${(body as { from: string }).from}`);
    }

    return NextResponse.json({
      success: true,
      projectId,
      ...(await listBranches(project).catch(() => ({}))),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'wtman failed' },
      { status: 500 }
    );
  }
}
