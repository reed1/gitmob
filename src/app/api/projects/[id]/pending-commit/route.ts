import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  findPendingCommitForRepo,
  deletePendingCommit,
  releaseCommitLock,
} from '@/lib/pending-commits';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const pending = findPendingCommitForRepo(project.path);
  if (!pending) {
    return NextResponse.json({ pending: null });
  }

  return NextResponse.json({
    pending: {
      message: pending.message,
      timestamp: pending.createdAt,
      source: pending.source,
      windowId: pending.windowId,
      closeSession: pending.closeSession,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const pending = findPendingCommitForRepo(project.path);
  if (pending) {
    deletePendingCommit(pending.id);
  }

  // The session that parked the message holds the repo's commit lock until the commit
  // lands, so dropping the message has to hand the lock back too.
  releaseCommitLock(project.path);

  return NextResponse.json({ success: true });
}
