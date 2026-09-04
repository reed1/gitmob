'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Project } from './types';
import ProjectContextMenu from './ProjectContextMenu';

// 'reed' is the trunk on forks of other people's repositories.
const DEFAULT_BRANCHES = new Set(['main', 'master', 'reed']);

function getDefaultTab(project: Project): string {
  if (project.downSites.length > 0) return 'run';
  if (project.editing) return 'changes';
  return 'pinboard';
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
      onClick={() =>
        router.push(`/app/p/${project.id}?tab=${getDefaultTab(project)}`)
      }
      className={`p-4 rounded-lg border flex items-center gap-3 cursor-pointer ${
        project.warnings.length > 0
          ? 'border-red-500/60 bg-red-500/15'
          : project.hasPendingMessage
            ? 'border-blue-500/50 bg-blue-500/10'
            : project.editing
              ? 'border-green-500/50 bg-green-500/10'
              : isActive
                ? 'border-foreground/30 bg-foreground/5'
                : 'border-foreground/10 bg-foreground/5'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{project.canonicalId}</span>
          {project.claudeSessions > 0 && (
            <span
              className="flex items-center gap-0.5 text-[11px] leading-none tabular-nums px-1.5 py-0.5 rounded-full border border-[#d97757]/40 bg-[#d97757]/15 text-[#d97757]"
              aria-label={`${project.claudeSessions} Claude Code session(s)`}
            >
              <Image
                src="/claude-logo.svg"
                alt=""
                width={12}
                height={12}
                unoptimized
                className="w-3 h-3"
              />
              {project.claudeSessions}
            </span>
          )}
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
          {project.envCheckFailed && (
            <svg
              className="w-3.5 h-3.5 text-orange-500/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Env check failed"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          )}
          {project.sudoEnabled && (
            <svg
              className="w-3.5 h-3.5 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Passwordless sudo enabled"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-.34-.014-.675-.042-1.007z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01"
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
        {project.warnings.map((warning) => (
          <div
            key={warning}
            className="mt-2 flex items-start gap-1.5 text-xs text-red-500"
          >
            <span aria-hidden>🚨</span>
            <span>{warning}</span>
          </div>
        ))}
        {(project.worktreeName || project.branch) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {project.worktreeName && (
              <svg
                className="w-3.5 h-3.5 text-amber-400/70"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Worktree checkout"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 2h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z"
                />
              </svg>
            )}
            {project.branch && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  DEFAULT_BRANCHES.has(project.branch)
                    ? 'bg-foreground/10 text-foreground/60'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {project.branch}
              </span>
            )}
          </div>
        )}
      </div>
      <ProjectContextMenu project={project} />
    </div>
  );
}
