'use client';

import { useRouter } from 'next/navigation';
import { addToast, apiFetch } from '../../lib/api';
import { CollapsedRows } from './CollapsedRows';
import { Project } from './types';

/**
 * What the scan found: closed projects with work still in the tree. A project is closed once
 * its work is committed, so each of these wants opening and committing.
 */
export function UncommittedProjects({
  projects,
  scanning,
  hidden,
  onDismiss,
  onOpened,
}: {
  projects: Project[];
  scanning: boolean;
  hidden: boolean;
  onDismiss: () => void;
  onOpened: () => void;
}) {
  const router = useRouter();

  const openOnDesktop = async (project: Project) => {
    const res = await apiFetch(`/api/projects/${project.id}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open' }),
    });
    if (!res.ok) return;
    addToast(`Opened ${project.id} on the desktop`, 'success');
    onOpened();
  };

  if (hidden) return null;

  if (scanning) {
    return (
      <div className="text-sm text-foreground/50">
        Scanning every repository for uncommitted changes...
      </div>
    );
  }

  if (projects.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-green-400">
          Closed with uncommitted changes
          <span className="ml-1.5 text-green-400/60">{projects.length}</span>
        </h2>
        <button
          onClick={onDismiss}
          aria-label="Dismiss scan result"
          className="p-1 text-foreground/40 active:opacity-80"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <CollapsedRows
        items={projects}
        toggleClassName="text-green-400/80"
        renderItem={(project) => (
          <div
            key={project.id}
            onClick={() => router.push(`/app/p/${project.id}?tab=changes`)}
            className="flex items-center gap-3 p-3 rounded-lg border border-green-500/40 bg-green-500/10 cursor-pointer active:opacity-80"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{project.canonicalId}</div>
              {project.branch && (
                <div className="text-xs text-foreground/50 truncate">
                  {project.branch}
                </div>
              )}
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
        )}
      />
    </section>
  );
}
