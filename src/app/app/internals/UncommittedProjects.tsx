'use client';

import { useRouter } from 'next/navigation';
import { addToast, apiFetch } from '@/lib/api';
import { projectApiPath, projectPagePath } from '@/lib/project-paths';

export interface UncommittedProject {
  id: string;
  canonicalId: string;
  branch: string;
}

/**
 * What the scan found: closed projects with work still in the tree. A project is closed once
 * its work is committed, so each of these wants opening and committing.
 */
export function UncommittedProjects({
  projects,
}: {
  projects: UncommittedProject[];
}) {
  const router = useRouter();

  const openOnDesktop = async (project: UncommittedProject) => {
    const res = await apiFetch(`${projectApiPath(project.id)}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open' }),
    });
    if (!res.ok) return;
    addToast(`Opened ${project.id} on the desktop`, 'success');
  };

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() =>
            router.push(`${projectPagePath(project.id)}?tab=changes`)
          }
          className="flex items-center gap-3 p-3 rounded-lg border border-green-500/40 bg-green-500/10 cursor-pointer active:opacity-80"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{project.canonicalId}</div>
            <div className="text-xs text-foreground/50 truncate">
              {project.branch}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openOnDesktop(project);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-300 active:opacity-80"
          >
            Open
          </button>
        </div>
      ))}
    </div>
  );
}
