'use client';

import { useRouter } from 'next/navigation';
import { Project } from './types';
import ProjectContextMenu from './ProjectContextMenu';

function getDefaultTab(project: Project): string {
  if (project.downSites.length > 0) return 'process';
  if (project.editing) return 'changes';
  return 'dooit';
}

export default function ProjectCard({
  project,
  isActive,
}: {
  project: Project;
  isActive?: boolean;
}) {
  const router = useRouter();

  return (
    <div
      className={`p-4 rounded-lg border flex items-center gap-3 ${
        project.editing
          ? 'border-green-500/50 bg-green-500/10'
          : isActive
            ? 'border-foreground/30 bg-foreground/5'
            : 'border-foreground/10 bg-foreground/5'
      }`}
    >
      <div
        onClick={() =>
          router.push(`/${project.id}?tab=${getDefaultTab(project)}`)
        }
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{project.id}</span>
          {project.hasRunningProcess && (
            <svg
              className="w-3.5 h-3.5 text-green-500"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-label="Running process"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {project.hasPendingMessage && (
            <svg
              className="w-3.5 h-3.5 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Pending commit message"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
          )}
          {project.downSites.length > 0 && (
            <svg
              className="w-3.5 h-3.5 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Sites down"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path
                strokeWidth={2}
                d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"
              />
            </svg>
          )}
        </div>
        {project.tags && project.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-foreground/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <ProjectContextMenu
        project={project}
        hasRunningProcess={project.hasRunningProcess}
      />
    </div>
  );
}
