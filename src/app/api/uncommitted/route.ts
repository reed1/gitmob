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
    dirty: await getRepoSummary(p.path)
      .then((summary) => summary.hasChanges)
      .catch(() => false),
  }));

  return NextResponse.json({
    ids: results.filter((r) => r.dirty).map((r) => r.id),
  });
}
