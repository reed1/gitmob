'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Project, GitStatus, Tab } from './types';
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
import ProjectContextMenu from '../../ProjectContextMenu';
import { useAutoRefresh } from '../../../../lib/use-auto-refresh';

const tabs = [
  { id: 'pinboard', label: 'Pinboard' },
  { id: 'dooit', label: 'Dooit' },
  { id: 'files', label: 'Files' },
  { id: 'changes', label: 'Changes' },
  { id: 'commit', label: 'Commit' },
  { id: 'cli', label: 'CLI' },
  { id: 'run', label: 'Run' },
  { id: 'claude', label: 'Claude' },
  { id: 'push', label: 'Push' },
  { id: 'sudo', label: 'Sudo' },
] as const;

const validTabs = new Set<string>(tabs.map((t) => t.id));

function getInitialTab(searchParams: URLSearchParams): Tab {
  const param = searchParams.get('tab');
  if (param && validTabs.has(param)) return param as Tab;
  return 'pinboard';
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const tab = getInitialTab(searchParams);
  const fileParam = searchParams.get('file');
  const showingDiff = tab === 'changes' && fileParam !== null;
  const showingFile = tab === 'files' && fileParam !== null;
  const [branch, setBranch] = useState<string>('');
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [commitTitle, setCommitTitle] = useState('');
  const [commitBody, setCommitBody] = useState('');
  const [pending, setPending] = useState<PendingMessage>(NO_PENDING_MESSAGE);

  const goToTab = (id: Tab) => {
    router.replace(`/app/p/${projectId}?tab=${id}`);
  };

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
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/git?action=branch`),
        fetch(`/api/projects/${projectId}/git?action=status`),
      ]);

      setProject(await projRes.json());
      setBranch((await branchRes.json()).branch);
      setStatus(await statusRes.json());
      setLoading(false);
    }
    load();
  }, [projectId]);

  const refreshStatus = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/git?action=status`);
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

  const hasPushTargets = Object.keys(project?.push ?? {}).length > 0;
  const pushTabs = new Set<string>(['push', 'sudo']);
  const visibleTabs = tabs.filter((t) => !pushTabs.has(t.id) || hasPushTargets);

  return (
    <div className="h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/app')}
            className="text-foreground/50 hover:text-foreground transition-colors"
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
              <span className="px-1.5 py-0.5 bg-foreground/10 rounded text-xs">
                {branch}
              </span>
            </div>
          </div>
          {(tab === 'changes' && showingDiff) ||
          (tab === 'files' && showingFile) ? (
            <label className="flex items-center gap-2 text-sm text-foreground/60 cursor-pointer">
              <input
                type="checkbox"
                checked={wordWrap}
                onChange={(e) => setWordWrap(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-foreground/30 peer-checked:bg-foreground peer-checked:border-foreground flex items-center justify-center">
                {wordWrap && (
                  <svg
                    className="w-3 h-3 text-background"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              Wrap
            </label>
          ) : (
            project && <ProjectContextMenu project={project} />
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
                  <span className="ml-1 text-xs">
                    (
                    {status.staged.length +
                      status.unstaged.length +
                      status.untracked.length}
                    )
                  </span>
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
            files by the canonical id. */}
        {tab === 'pinboard' && project && (
          <PinboardView projectId={project.canonicalId} />
        )}
        {tab === 'files' && (
          <FileBrowser projectId={projectId} wordWrap={wordWrap} />
        )}
        {tab === 'changes' && (
          <ChangesView
            projectId={projectId}
            status={status}
            onRefresh={refreshStatus}
            wordWrap={wordWrap}
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
        {tab === 'cli' && project && <CLIView projectPath={project.path} />}
        {tab === 'claude' && project && (
          <ClaudeView projectId={projectId} canonicalId={project.canonicalId} />
        )}
        {/* Todos belong to the repo, not to one checkout of it: rdooit keys its tables by
            the canonical id, and a worktree id makes no legal table name. */}
        {tab === 'dooit' && project && (
          <DooitView projectId={project.canonicalId} />
        )}
        {tab === 'push' && <PushView projectId={projectId} />}
        {tab === 'sudo' && <SudoView projectId={projectId} />}
      </main>
    </div>
  );
}
