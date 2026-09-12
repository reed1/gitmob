import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { Project, getProjectsWithWorktrees } from '@/lib/projects';
import {
  PendingCommit,
  deletePendingCommit,
  isPendingCommitId,
  listPendingCommits,
  readPendingCommit,
  releaseCommitLock,
} from '@/lib/pending-commits';
import { StagedSummary, commit, getStagedSummary } from '@/lib/git';
import { sendSessionToPurgatory } from '@/lib/desktop';

interface UnlistedCommit extends PendingCommit {
  /** Null when the repository is no longer on disk; the commit can then only be rejected. */
  staged: StagedSummary | null;
  /** The project this repository sits inside, when it sits inside one. Context, not a claim. */
  insideProject: string | null;
}

/** The innermost project holding this repository, for a row that would otherwise be a path. */
function enclosingProject(
  projects: Project[],
  repoPath: string
): string | null {
  const holders = projects
    .filter((project) => repoPath.startsWith(`${project.path}/`))
    .sort((a, b) => b.path.length - a.path.length);
  return holders[0]?.id ?? null;
}

/**
 * The parked commits no project answers for — a dataset repository, a submodule, anything
 * `gg c` ran in that rworkspaces holds no entry for. A commit whose repository *is* a project
 * is announced on that project's card instead, and stays on its Commit tab.
 */
export async function GET() {
  const { projects } = await getProjectsWithWorktrees();
  const known = new Set(projects.map((project) => project.path));
  const unlisted = listPendingCommits().filter(
    (pending) => !known.has(pending.repo)
  );

  const commits: UnlistedCommit[] = await Promise.all(
    unlisted.map(async (entry) => ({
      ...entry,
      staged: existsSync(entry.repo)
        ? await getStagedSummary(entry.repo)
        : null,
      insideProject: enclosingProject(projects, entry.repo),
    }))
  );

  return NextResponse.json({ commits });
}

export async function POST(request: NextRequest) {
  const { id, message } = await request.json();
  if (!isPendingCommitId(id)) {
    return NextResponse.json({ error: 'Missing commit' }, { status: 400 });
  }

  const pending = readPendingCommit(id);
  if (!pending) {
    return NextResponse.json({ error: 'Commit not found' }, { status: 404 });
  }

  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  if (!existsSync(pending.repo)) {
    return NextResponse.json(
      { error: `No such repository: ${pending.repo}` },
      { status: 400 }
    );
  }

  // A parked commit outlives its work: the message stays here whether or not the changes it
  // describes were committed some other way. Nothing staged means they were, and committing
  // anyway would write a message about history that is already written.
  const staged = await getStagedSummary(pending.repo);
  if (staged.files.length === 0) {
    return NextResponse.json(
      { error: 'Nothing staged in that repository' },
      { status: 400 }
    );
  }

  const result = await commit(pending.repo, text);

  // The lock goes back before the session is parked, which would otherwise take it along.
  deletePendingCommit(id);
  releaseCommitLock(pending.repo);

  if (pending.windowId && pending.closeSession) {
    await sendSessionToPurgatory(pending.windowId);
  }

  return NextResponse.json({ success: true, result });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('pending');
  if (!isPendingCommitId(id)) {
    return NextResponse.json({ error: 'Missing commit' }, { status: 400 });
  }

  const pending = readPendingCommit(id);
  if (!pending) {
    return NextResponse.json({ error: 'Commit not found' }, { status: 404 });
  }

  // Rejecting means the work is not done, so the session stays; only the lock goes back.
  deletePendingCommit(id);
  releaseCommitLock(pending.repo);

  return NextResponse.json({ success: true });
}
