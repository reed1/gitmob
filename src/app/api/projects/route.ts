import { NextResponse } from 'next/server';
import { getProjects } from '@/lib/projects';
import { hasChanges } from '@/lib/git';

const WORKERS = 4;

function isArchived(tags?: string[]): boolean {
  return tags?.includes('archived') ?? false;
}

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

  const projectsToCheck = projects.filter((p) => !isArchived(p.tags));

  const editingResults = await processWithWorkers(
    projectsToCheck,
    WORKERS,
    async (project) => {
      try {
        const editing = await hasChanges(project.path);
        return { id: project.id, editing };
      } catch {
        return { id: project.id, editing: false };
      }
    }
  );

  const editingMap: Record<string, boolean> = {};
  for (const result of editingResults) {
    editingMap[result.id] = result.editing;
  }

  const result = projects.map((p) => ({
    ...p,
    editing: isArchived(p.tags) ? false : (editingMap[p.id] ?? false),
  }));

  return NextResponse.json(result);
}
