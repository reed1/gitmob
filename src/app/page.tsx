'use client';

import { useState, useEffect } from 'react';
import ProjectCard from './ProjectCard';
import { Project } from './types';

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
    // webview-apk: called when app resumes after being backgrounded
    (window as any).__webviewRefresh = () => refreshProjects();
    return () => {
      delete (window as any).__webviewRefresh;
    };
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
