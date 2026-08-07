import { NextResponse } from 'next/server';
import { getProjectsWithWorktrees } from '@/lib/projects';
import { hasChanges } from '@/lib/git';
import { getAllRunning } from '@/lib/run';
import { getDownSites } from '@/lib/upmon';
import { getEnvCheckFailures } from '@/lib/env-check';
import { getSudoEnabledProjects } from '@/lib/sudo';
import { getClaudeSessionCounts } from '@/lib/desktop';
import { getRemoteCounts } from '@/lib/remote';
import { getGithubRepoUrl } from '@/lib/github';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PENDING_MESSAGES_DIR = join(
  homedir(),
  '.local/share/gitmob/pending-messages'
);

function encodeRepoPath(repoPath: string): string {
  return Buffer.from(repoPath).toString('base64url');
}

function hasPendingMessage(repoPath: string): boolean {
  const filename = encodeRepoPath(repoPath) + '.json';
  const filepath = join(PENDING_MESSAGES_DIR, filename);
  return existsSync(filepath);
}

const WORKERS = 4;

async function processWithWorkers<T, R>(
  items: T[],
  workers: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) {
        const result = await processor(item);
        results.push(result);
      }
    }
  }

  const workerPromises: Promise<void>[] = [];
  for (let i = 0; i < Math.min(workers, items.length); i++) {
    workerPromises.push(worker());
  }

  await Promise.all(workerPromises);
  return results;
}

export async function GET() {
  // The sweeps below each survive their CLI being down, but the list itself cannot: a project
  // missing from it is indistinguishable from one that does not exist, so say so instead.
  let projects;
  try {
    projects = await getProjectsWithWorktrees();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not list projects' },
      { status: 500 }
    );
  }

  const [
    allRunningProcesses,
    downSites,
    envCheckFailures,
    sudoEnabled,
    desktopSessions,
    remoteSessions,
    projectResults,
  ] = await Promise.all([
    getAllRunning(),
    getDownSites(),
    getEnvCheckFailures(),
    getSudoEnabledProjects(),
    getClaudeSessionCounts(),
    getRemoteCounts(),
    processWithWorkers(projects, WORKERS, async (project) => {
      const githubUrl = await getGithubRepoUrl(project.path);
      try {
        const editing = await hasChanges(project.path);
        const pendingMessage = hasPendingMessage(project.path);
        return {
          id: project.id,
          editing,
          hasPendingMessage: pendingMessage,
          githubUrl,
        };
      } catch {
        return {
          id: project.id,
          editing: false,
          hasPendingMessage: false,
          githubUrl,
        };
      }
    }),
  ]);

  const resultMap: Record<
    string,
    {
      editing: boolean;
      hasPendingMessage: boolean;
      githubUrl: string | null;
    }
  > = {};
  for (const r of projectResults) {
    resultMap[r.id] = {
      editing: r.editing,
      hasPendingMessage: r.hasPendingMessage,
      githubUrl: r.githubUrl,
    };
  }

  const result = projects.map((p) => ({
    ...p,
    editing: resultMap[p.id]?.editing ?? false,
    hasPendingMessage: resultMap[p.id]?.hasPendingMessage ?? false,
    hasRunningProcess: !!allRunningProcesses[p.id],
    // Deploy targets, env files and monitored sites belong to the repo and its servers, not
    // to one checkout of it, so a worktree reads these under the project it came from.
    downSites: downSites[p.canonicalId] ?? [],
    envCheckFailed: envCheckFailures[p.canonicalId] ?? false,
    sudoEnabled: sudoEnabled[p.canonicalId] ?? false,
    claudeSessions: (desktopSessions[p.id] ?? 0) + (remoteSessions[p.id] ?? 0),
    githubUrl: resultMap[p.id]?.githubUrl ?? null,
  }));

  return NextResponse.json(result);
}
