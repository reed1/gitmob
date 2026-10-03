import { NextResponse } from 'next/server';
import { getProjectsWithWorktrees, openRepos } from '@/lib/projects';
import { getRepoSummary } from '@/lib/git';
import { getAllRunning } from '@/lib/run';
import { getDownSites } from '@/lib/upmon';
import { getEnvCheckFailures } from '@/lib/env-check';
import { getSudoEnabledProjects } from '@/lib/sudo';
import { getClaudeSessionCounts } from '@/lib/desktop';
import { readCheckout } from '@/lib/checkout';
import { getClaudeUsage } from '@/lib/claude-usage';
import { isAway } from '@/lib/afk';
import { getStaleBuild } from '@/lib/build-version';
import { listPendingCommits } from '@/lib/pending-commits';
import { processWithWorkers } from '@/lib/workers';
import { existsSync } from 'fs';

const WORKERS = 4;

export async function GET() {
  // The sweeps below each survive their CLI being down, but the list itself cannot: a project
  // missing from it is indistinguishable from one that does not exist, so say so instead.
  let projectList;
  try {
    projectList = await getProjectsWithWorktrees();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not list projects' },
      { status: 500 }
    );
  }
  const { projects, warnings } = projectList;
  const openIds = new Set(projectList.openIds);

  // One scan of the parked commits, rather than a stat per project: the files are keyed by
  // the repository they belong to, not by a name any one project could look itself up under.
  const pendingRepos = new Set(
    listPendingCommits().map((pending) => pending.repo)
  );

  const checkouts = new Map(projects.map((p) => [p.id, readCheckout(p.path)]));

  // A spawn per project is what makes this list slow, so only the projects open on the desktop
  // pay for one: a project is closed once its work is committed, and the scan on the front page
  // is how a closed one that was not gets found.
  const openCheckouts = projects.filter(
    (p) => openIds.has(p.id) && checkouts.get(p.id)
  );
  const envCheckFailures = getEnvCheckFailures(openRepos(projectList));

  const [
    allRunningProcesses,
    downSites,
    sudoEnabled,
    desktopSessions,
    claudeUsage,
    away,
    staleBuild,
    dirtyResults,
  ] = await Promise.all([
    getAllRunning(),
    getDownSites(),
    getSudoEnabledProjects(),
    getClaudeSessionCounts(),
    getClaudeUsage(),
    isAway(),
    getStaleBuild(),
    processWithWorkers(openCheckouts, WORKERS, async (project) => ({
      id: project.id,
      editing: await getRepoSummary(project.path)
        .then((summary) => summary.hasChanges)
        .catch(() => false),
    })),
  ]);

  const editing = new Set(
    dirtyResults.filter((r) => r.editing).map((r) => r.id)
  );

  const list = projects.map((p) => {
    const checkout = checkouts.get(p.id) ?? null;
    return {
      ...p,
      // Configured, but never cloned. Everything git-shaped below is null for one of these.
      missing: !existsSync(p.path),
      openOnDesktop: openIds.has(p.id),
      branch: checkout?.branch ?? null,
      editing: editing.has(p.id),
      hasPendingMessage: pendingRepos.has(p.path),
      hasRunningProcess: !!allRunningProcesses[p.id],
      // Deploy targets, env files and monitored sites belong to the repo and its servers, not
      // to one checkout of it, so a worktree reads these under the project it came from.
      downSites: downSites[p.canonicalId] ?? [],
      envCheckFailed: envCheckFailures[p.canonicalId] ?? false,
      sudoEnabled: sudoEnabled[p.canonicalId] ?? false,
      claudeSessions: desktopSessions[p.id] ?? 0,
      // A warning is raised against the checkout it came from, so a worktree has its own.
      warnings: Object.values(warnings[p.id] ?? {}),
      githubUrl: checkout?.githubUrl ?? null,
    };
  });

  return NextResponse.json({ projects: list, claudeUsage, away, staleBuild });
}
