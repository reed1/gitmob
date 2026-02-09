'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const DOOIT_DOMAIN = process.env.NEXT_PUBLIC_DOOIT_DOMAIN;

interface Project {
  id: string;
  path: string;
  tags?: string[];
  urls?: Record<string, string>;
  editing: boolean;
  hasPendingMessage: boolean;
  hasRunningProcess: boolean;
  downSites: string[];
}

async function fetchHealthWithTimeout(
  timeoutMs: number
): Promise<{ startedAt: number } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function waitForNewServer(previousStartedAt: number): Promise<void> {
  while (true) {
    const health = await fetchHealthWithTimeout(3000);
    if (health && health.startedAt !== previousStartedAt) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function refreshProjects() {
    setRefreshing(true);
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    refreshProjects();
  }, []);


  const filtered = projects.filter(
    (p) =>
      search === '' ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.path.toLowerCase().includes(search.toLowerCase())
  );

  const isActive = (p: Project) =>
    p.editing ||
    p.hasRunningProcess ||
    p.hasPendingMessage ||
    p.downSites.length > 0;
  const active = filtered.filter(isActive);
  const others = filtered.filter((p) => !isActive(p));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground/50">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {restarting && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-foreground/70 text-lg">Restarting...</div>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">GitMob</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refreshProjects()}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-foreground/10 active:opacity-80"
            >
              <svg
                className={`w-5 h-5 text-foreground/60 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-lg hover:bg-foreground/10 active:opacity-80"
              >
                <svg
                  className="w-5 h-5 text-foreground/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[180px]">
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        const health = await fetchHealthWithTimeout(3000);
                        if (!health) return;
                        const previousStartedAt = health.startedAt;
                        setRestarting(true);
                        await fetch('/api/restart', { method: 'POST' });
                        await waitForNewServer(previousStartedAt);
                        window.location.reload();
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 flex items-center gap-2"
                    >
                      <span className="w-4" />
                      Restart GitMob
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            className="w-full pl-10 pr-4 py-2 bg-foreground/5 border border-foreground/10 rounded-lg text-sm placeholder:text-foreground/40 focus:outline-none focus:border-foreground/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40"
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
          )}
        </div>
      </header>

      <main className="p-4 space-y-6">
        {active.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground/60 mb-2">
              Active
            </h2>
            <div className="space-y-2">
              {active.map((project) => (
                <ProjectCard key={project.id} project={project} isActive />
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground/60 mb-2">
              {active.length > 0 ? 'All Projects' : 'Projects'}
            </h2>
            <div className="space-y-2">
              {others.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="text-center text-foreground/50 py-8">
            No projects found
          </div>
        )}
      </main>
    </div>
  );
}

function getDefaultTab(project: Project): string {
  if (project.downSites.length > 0) return 'process';
  if (project.editing) return 'changes';
  return 'dooit';
}

function ProjectCard({
  project,
  isActive,
}: {
  project: Project;
  isActive?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);

  const urls = project.urls ?? {};
  const urlEntries = Object.entries(urls);
  const hasUrls = urlEntries.length > 0;

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
        onClick={() => router.push(`/${project.id}?tab=${getDefaultTab(project)}`)}
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
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg bg-foreground/10 active:bg-foreground/20 transition-colors"
        >
          <svg
            className="w-5 h-5 text-foreground/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01"
            />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[120px]">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (hasUrls) {
                    setUrlModalOpen(true);
                  }
                }}
                disabled={!hasUrls}
                className={`block w-full px-4 py-2 text-sm text-left ${
                  hasUrls
                    ? 'hover:bg-foreground/10'
                    : 'text-foreground/30 cursor-not-allowed'
                }`}
              >
                Open URL
              </button>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  if (project.hasRunningProcess) {
                    await fetch(`/api/projects/${project.id}/process`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'stopAll' }),
                    });
                    window.location.reload();
                  }
                }}
                disabled={!project.hasRunningProcess}
                className={`block w-full px-4 py-2 text-sm text-left ${
                  project.hasRunningProcess
                    ? 'hover:bg-foreground/10'
                    : 'text-foreground/30 cursor-not-allowed'
                }`}
              >
                Stop proc
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (DOOIT_DOMAIN) {
                    window.open(
                      `${DOOIT_DOMAIN}/frontend/dooit/${project.id}`,
                      '_blank'
                    );
                  }
                }}
                disabled={!DOOIT_DOMAIN}
                className={`block w-full px-4 py-2 text-sm text-left ${
                  DOOIT_DOMAIN
                    ? 'hover:bg-foreground/10'
                    : 'text-foreground/30 cursor-not-allowed'
                }`}
              >
                Dooit
              </button>
            </div>
          </>
        )}
      </div>

      {urlModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setUrlModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full">
              <div className="px-4 py-3 border-b border-foreground/10">
                <h3 className="font-medium">Select URL</h3>
              </div>
              <div className="py-2">
                {urlEntries.map(([key, url]) => (
                  <button
                    key={key}
                    onClick={() => {
                      window.open(url, '_blank');
                      setUrlModalOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10"
                  >
                    <span>{key}</span>
                    <span className="text-foreground/40"> :: </span>
                    <span className="text-blue-500">{url}</span>
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-foreground/10 flex justify-end">
                <button
                  onClick={() => setUrlModalOpen(false)}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
