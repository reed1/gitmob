import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { getProjectsWithWorktrees } from '@/lib/projects';
import { getRepoSummary } from '@/lib/git';
import { processWithWorkers } from '@/lib/workers';

const WORKERS = 8;

/**
 * The closed projects with uncommitted changes. The project list only asks git about the
 * projects open on the desktop, because a project is closed once its work is committed — this
 * is the look for the ones that were closed with work still in the tree.
 */
export async function GET() {
  const { projects, openIds } = await getProjectsWithWorktrees();
  const closed = projects.filter(
    (p) => !openIds.includes(p.id) && existsSync(p.path)
  );

  const results = await processWithWorkers(closed, WORKERS, async (p) => ({
    id: p.id,
    canonicalId: p.canonicalId,
    summary: await getRepoSummary(p.path).catch(() => null),
  }));

  return NextResponse.json({
    projects: results
      .flatMap(({ id, canonicalId, summary }) =>
        summary?.hasChanges ? [{ id, canonicalId, branch: summary.branch }] : []
      )
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
