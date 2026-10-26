'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Project, GitStatus } from './types';
import { FileBrowser } from './components/FileBrowser';
import { ChangesView } from './components/ChangesView';
import {
  CommitView,
  NO_PENDING_MESSAGE,
  type PendingMessage,
} from './components/CommitView';
import { RunView } from './components/RunView';
import { CLIView } from './components/CLIView';
import { DooitView } from './components/DooitView';
import { PinboardView } from './components/PinboardView';
import { ClaudeView } from './components/ClaudeView';
import { PushView } from './components/PushView';
import { SudoView } from './components/SudoView';
import { WtmanView } from './components/WtmanView';
import { WrapToggle } from './components/WrapToggle';
import { ReviewScreen } from './components/ReviewScreen';
import ProjectKebabMenu from '@/app/app/ProjectKebabMenu';
import { HoldBadge } from '@/app/app/GgHold';
import { WorktreeSyncNotice } from '@/app/app/WorktreeActions';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { goHome } from '@/lib/app-depth';
import { projectApiPath, projectPagePath } from '@/lib/project-paths';

const tabs = [
  { id: 'pinboard', label: 'Pinboard' },
  { id: 'claude', label: 'Claude' },
  { id: 'files', label: 'Files' },
  { id: 'changes', label: 'Changes' },
  { id: 'commit', label: 'Commit' },
  { id: 'cli', label: 'CLI' },
  { id: 'run', label: 'Run' },
  { id: 'dooit', label: 'Dooit' },
  { id: 'push', label: 'Push' },
  { id: 'sudo', label: 'Sudo' },
  { id: 'wtman', label: 'Wtman' },
] as const;

type Tab = (typeof tabs)[number]['id'];

function tabFromUrl(searchParams: URLSearchParams): Tab {
  const param = searchParams.get('tab');
  return tabs.find((t) => t.id === param)?.id ?? 'claude';
}

// A tab stacks history entries on top of its own: one per folder drilled into on Files, one for
// an open file or diff. Switching tabs unwinds them, so back from the new tab leaves the project
// instead of retracing the tree it was never in.
function depthInTab(searchParams: URLSearchParams): number {
  const folders = (searchParams.get('path') ?? '').split('/').filter(Boolean);
  return folders.length + (searchParams.get('file') === null ? 0 : 1);
}

export default function ProjectPage() {
  const projectId = decodeURIComponent(
    useParams<{ projectId: string }>().projectId
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const tab = tabFromUrl(searchParams);
  const fileParam = searchParams.get('file');
  const showingFile = tab === 'files' && fileParam !== null;
  const commitParam = searchParams.get('commit');
  const [branch, setBranch] = useState<string>('');
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [commitTitle, setCommitTitle] = useState('');
  const [commitBody, setCommitBody] = useState('');
  const [pending, setPending] = useState<PendingMessage>(NO_PENDING_MESSAGE);

  // Deep-linking straight into a folder or a file leaves nothing under it to go back to, so
  // entries are only ever unwound down to the depth the page was loaded at.
  const loadedDepth = useRef(depthInTab(searchParams));

  const goToTab = (id: Tab) => {
    const url = `${projectPagePath(projectId)}?tab=${id}`;
    const unwind = depthInTab(searchParams) - loadedDepth.current;
    loadedDepth.current = 0;
    if (unwind <= 0) {
      router.replace(url);
      return;
    }
    const onPopState = () => {
      window.removeEventListener('popstate', onPopState);
      setTimeout(() => router.replace(url), 0);
    };
    window.addEventListener('popstate', onPopState);
    window.history.go(-unwind);
  };

  // Closing a file or stepping up a folder retraces the entry that opened it, unless the page was
  // loaded there and that entry belongs to whatever came before the app.
  const goBack = useCallback(
    (fallback: string) => {
      if (depthInTab(searchParams) > loadedDepth.current) {
        router.back();
        return;
      }
      const url = new URL(fallback, window.location.href);
      loadedDepth.current = depthInTab(url.searchParams);
      router.replace(fallback);
    },
    [router, searchParams]
  );

  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const { scrollLeft, scrollWidth, clientWidth } = nav;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    updateScrollIndicators();
    nav.addEventListener('scroll', updateScrollIndicators);
    window.addEventListener('resize', updateScrollIndicators);
    return () => {
      nav.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [updateScrollIndicators, loading]);

  useEffect(() => {
    async function load() {
      const [projRes, branchRes, statusRes] = await Promise.all([
        fetch(projectApiPath(projectId)),
        fetch(`${projectApiPath(projectId)}/git?action=branch`),
        fetch(`${projectApiPath(projectId)}/git?action=status`),
      ]);

      setProject(await projRes.json());
      setBranch((await branchRes.json()).branch);
      setStatus(await statusRes.json());
      setLoading(false);
    }
    load();
  }, [projectId]);

  const refreshStatus = useCallback(async () => {
    const res = await fetch(`${projectApiPath(projectId)}/git?action=status`);
    setStatus(await res.json());
  }, [projectId]);

  const reloadChanges = useCallback(async () => {
    if (tab !== 'changes') return;
    setStatus(null);
    await refreshStatus();
  }, [tab, refreshStatus]);

  useAutoRefresh(reloadChanges);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground/50">Loading...</div>
      </div>
    );
  }

  const changeCount =
    status === null
      ? 0
      : status.staged.length + status.unstaged.length + status.untracked.length;
  const hasPushTargets = Object.keys(project?.push ?? {}).length > 0;
  const pushTabs = new Set<string>(['push', 'sudo']);
  const visibleTabs = tabs.filter((t) => !pushTabs.has(t.id) || hasPushTargets);

  return (
    <div className="h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => goHome(router)}
            className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{project?.id}</h1>
            <div className="text-sm text-foreground/50 flex items-center gap-2">
              {project?.missing ? (
                <span className="px-1.5 py-0.5 rounded text-xs bg-foreground/10 text-foreground/40">
                  not cloned
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-foreground/10 rounded text-xs">
                  {branch}
                </span>
              )}
              {project?.hold && <HoldBadge />}
            </div>
          </div>
          {showingFile ? (
            <WrapToggle wordWrap={wordWrap} setWordWrap={setWordWrap} />
          ) : (
            project && (
              <ProjectKebabMenu
                project={project}
                hasChanges={changeCount > 0}
                onChanged={() => window.location.reload()}
                onClosed={() => goHome(router)}
              />
            )
          )}
        </div>

        <div className="relative border-t border-foreground/10">
          <nav ref={navRef} className="flex overflow-x-auto scrollbar-hide">
            {visibleTabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => goToTab(id)}
                className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'text-foreground border-b-2 border-foreground'
                    : 'text-foreground/50'
                }`}
              >
                {label}
                {id === 'changes' && status && (
                  <span className="ml-1 text-xs">({changeCount})</span>
                )}
              </button>
            ))}
          </nav>
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-14 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none flex items-center justify-start pl-2">
              <svg
                className="w-4 h-4 text-foreground/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </div>
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none flex items-center justify-end pr-2">
              <svg
                className="w-4 h-4 text-foreground/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto">
        {/* Notes are pinned to the repo, not to one checkout of it: pinboard keys its
            files by the canonical id. A session started from a note still opens in this
            checkout. */}
        {tab === 'pinboard' && project && (
          <PinboardView
            projectId={projectId}
            canonicalId={project.canonicalId}
          />
        )}
        {tab === 'files' && (
          <FileBrowser
            projectId={projectId}
            wordWrap={wordWrap}
            goBack={goBack}
          />
        )}
        {tab === 'changes' && (
          <ChangesView
            projectId={projectId}
            status={status}
            onRefresh={refreshStatus}
            goBack={goBack}
          />
        )}
        {tab === 'commit' && (
          <CommitView
            projectId={projectId}
            onRefresh={refreshStatus}
            commitTitle={commitTitle}
            setCommitTitle={setCommitTitle}
            commitBody={commitBody}
            setCommitBody={setCommitBody}
            pending={pending}
            setPending={setPending}
          />
        )}
        {tab === 'run' && (
          <RunView projectId={projectId} urls={project?.urls} />
        )}
        {tab === 'cli' && project && <CLIView projectId={projectId} />}
        {tab === 'claude' && project && (
          <ClaudeView projectId={projectId} canonicalId={project.canonicalId} />
        )}
        {/* Todos belong to the repo, not to one checkout of it: rdooit keys its tables by
            the canonical id, and a worktree id makes no legal table name. */}
        {tab === 'dooit' && project && (
          <DooitView projectId={project.canonicalId} />
        )}
        {/* A worktree's push deploys from its own branch, not from the main checkout's. */}
        {tab === 'push' && project?.worktreeName && (
          <div className="px-4 pt-4">
            <WorktreeSyncNotice
              repoId={project.canonicalId}
              projectId={project.id}
            />
          </div>
        )}
        {tab === 'push' && <PushView projectId={projectId} />}
        {tab === 'sudo' && <SudoView projectId={projectId} />}
        {/* Worktrees belong to the repo, so a worktree page lists its own siblings
            alongside itself rather than an empty board of its own. */}
        {tab === 'wtman' && project && (
          <WtmanView
            projectId={project.canonicalId}
            currentProjectId={project.id}
          />
        )}
      </main>

      {/* Laid over the Commit tab instead of replacing it: the tab stays mounted underneath,
          its cards expanded and scrolled as they were, for back to uncover. */}
      {tab === 'commit' && commitParam !== null && fileParam !== null && (
        <div className="fixed inset-0 z-20">
          <ReviewScreen
            projectId={projectId}
            commit={commitParam}
            path={fileParam}
            onBack={() => goBack(`${projectPagePath(projectId)}?tab=commit`)}
          />
        </div>
      )}
    </div>
  );
}
