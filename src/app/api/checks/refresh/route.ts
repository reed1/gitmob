import { NextResponse } from 'next/server';
import { getProjectsWithWorktrees, openRepos } from '@/lib/projects';
import { refreshSudoEnabledProjects } from '@/lib/sudo';
import { refreshDownSites } from '@/lib/upmon';
import { refreshEnvChecks } from '@/lib/env-check';

/**
 * The project list answers sudo, monitored sites and env checks from memory and refreshes
 * them behind itself; this asks all three again now, and answers once they are in.
 */
export async function POST() {
  const projectList = await getProjectsWithWorktrees();
  const sweeps = {
    sudo: refreshSudoEnabledProjects(),
    'monitored sites': refreshDownSites(),
    'env checks': refreshEnvChecks(openRepos(projectList)),
  };
  const settled = await Promise.allSettled(Object.values(sweeps));

  // Each sweep keeps its last answer when it fails, so the others still land; say which did not.
  const failed = Object.keys(sweeps).filter(
    (_, i) => settled[i].status === 'rejected'
  );
  if (failed.length > 0) {
    return NextResponse.json(
      { error: `Could not refresh ${failed.join(', ')}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
