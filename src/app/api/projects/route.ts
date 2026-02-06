import { NextResponse } from 'next/server';
import { getProjects } from '@/lib/projects';
import { hasChanges } from '@/lib/git';
import { getAllRunningProcesses } from '@/lib/process';
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
  const projects = getProjects();

  const [allRunningProcesses, projectResults] = await Promise.all([
    getAllRunningProcesses(),
    processWithWorkers(
      projects,
      WORKERS,
      async (project) => {
        try {
          const editing = await hasChanges(project.path);
          const pendingMessage = hasPendingMessage(project.path);
          return { id: project.id, editing, hasPendingMessage: pendingMessage };
        } catch {
          return { id: project.id, editing: false, hasPendingMessage: false };
        }
      }
    ),
  ]);

  const resultMap: Record<string, { editing: boolean; hasPendingMessage: boolean }> = {};
  for (const r of projectResults) {
    resultMap[r.id] = { editing: r.editing, hasPendingMessage: r.hasPendingMessage };
  }

  const result = projects.map((p) => ({
    ...p,
    editing: resultMap[p.id]?.editing ?? false,
    hasPendingMessage: resultMap[p.id]?.hasPendingMessage ?? false,
    hasRunningProcess: !!allRunningProcesses[p.id],
  }));

  return NextResponse.json(result);
}
