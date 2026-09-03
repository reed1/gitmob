'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import ProjectCard from './ProjectCard';
import { PendingHandoffs } from './PendingHandoffs';
import UsagePanel from './UsagePanel';
import { ClaudeUsage, Project, StaleBuild } from './types';
import { addToast, apiFetch } from '../../lib/api';
import { useOutsideClick } from '../../lib/use-outside-click';
import { useAutoRefresh } from '../../lib/use-auto-refresh';
import { useBackToDismiss } from '../../lib/use-back-to-dismiss';
import { needsNotificationSetup } from '../../lib/notifications-client';

const RESUME_REFRESH_THRESHOLD_MS = 10000;

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

async function waitForNewServer(
  previousStartedAt: number,
  timeoutMs = 20000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await fetchHealthWithTimeout(3000);
    if (health && health.startedAt !== previousStartedAt) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [claudeUsage, setClaudeUsage] = useState<ClaudeUsage | null>(null);
  // Null while am-i-afk cannot be asked, which is neither here nor away and shows no badge.
  const [away, setAway] = useState<boolean | null>(null);
  const [staleBuild, setStaleBuild] = useState<StaleBuild | null>(null);
  const [forcingAfk, setForcingAfk] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuOpen, menuRef, () => setMenuOpen(false));
  useBackToDismiss(search !== '', () => setSearch(''));

  const restart = useCallback(async () => {
    const health = await fetchHealthWithTimeout(3000);
    if (!health) return;
    const previousStartedAt = health.startedAt;
    setRestarting(true);
    // Raw fetch to avoid error toasts — the server will die mid-request
    fetch('/api/restart', { method: 'POST' }).catch(() => {});
    if (await waitForNewServer(previousStartedAt)) {
      window.location.reload();
    } else {
      setRestarting(false);
      addToast('Service did not come back up after 20 seconds');
    }
  }, []);

  const refreshProjects = useCallback(() => {
    setRefreshing(true);
    fetch('/api/projects')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        setProjects(data.projects);
        setClaudeUsage(data.claudeUsage);
        setAway(data.away);
        setStaleBuild(data.staleBuild);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load projects')
      )
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useAutoRefresh(refreshProjects);

  // The desktop's own idle timer has not run out — I am simply not at it. Saying so is what
  // sends the next handoff and commit review here instead of to a screen nobody is watching.
  // A touched flag is away by definition, so nothing needs asking again to know it took.
  const forceAfk = async () => {
    setForcingAfk(true);
    try {
      const res = await apiFetch('/api/afk', { method: 'POST' });
      if (!res.ok) return;
      setAway(true);
      addToast('Counted away from the desktop', 'success');
    } finally {
      setForcingAfk(false);
    }
  };

  // Starts hidden so a phone that is already subscribed never flashes the prompt.
  const [notificationsOff, setNotificationsOff] = useState(false);
  const checkNotifications = useCallback(async () => {
    setNotificationsOff(await needsNotificationSetup());
  }, []);
  useAutoRefresh(checkNotifications);

  useEffect(() => {
    let hiddenAt = 0;
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (hiddenAt && Date.now() - hiddenAt > RESUME_REFRESH_THRESHOLD_MS) {
          refreshProjects();
        }
        hiddenAt = 0;
      } else {
        throw new Error(
          `Unexpected visibility state: ${document.visibilityState}`
        );
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshProjects]);

  const filtered = projects
    .filter(
      (p) =>
        search === '' ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.path.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.hasPendingMessage !== b.hasPendingMessage) {
        return a.hasPendingMessage ? -1 : 1;
      }
      if (a.editing !== b.editing) {
        return a.editing ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });

  const isActive = (p: Project) =>
    p.editing ||
    p.hasRunningProcess ||
    p.hasPendingMessage ||
    p.downSites.length > 0 ||
    p.envCheckFailed ||
    p.sudoEnabled ||
    p.claudeSessions > 0;
  const active = filtered.filter(isActive);
  const pinned = filtered.filter((p) => !isActive(p) && p.pinned);
  const others = filtered.filter((p) => !isActive(p) && !p.pinned);

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">GitMob</h1>
            {claudeUsage && (
              <button
                onClick={() => setUsageOpen(!usageOpen)}
                title="Claude Code API spend today"
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-amber-400 text-xs font-medium tabular-nums active:opacity-80 ${
                  usageOpen ? 'bg-amber-400/30' : 'bg-amber-400/15'
                }`}
              >
                ${claudeUsage.todayCost.toFixed(2)}
                <svg
                  className={`w-3 h-3 ${usageOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {away === false && (
              <button
                onClick={forceAfk}
                disabled={forcingAfk}
                title="At the desktop: handoffs and commit reviews land there, not here. Tap to count yourself away."
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium active:opacity-80 disabled:opacity-50"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                At desk
              </button>
            )}
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
            <div className="relative" ref={menuRef}>
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
                <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[180px]">
                  <Link
                    href="/pinboard"
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-foreground/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    Pinboard
                  </Link>
                  <Link
                    href="/app/files"
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-foreground/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    Files
                  </Link>
                  <Link
                    href="/app/notifications"
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-foreground/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1h6z"
                      />
                    </svg>
                    Notifications
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      restart();
                    }}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-foreground/60"
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
                    Restart GitMob
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {usageOpen && claudeUsage && <UsagePanel usage={claudeUsage} />}
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
        {staleBuild && (
          <button
            onClick={restart}
            disabled={restarting}
            className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-sky-500/40 bg-sky-500/10 active:opacity-80"
          >
            <svg
              className="w-5 h-5 shrink-0 text-sky-400"
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
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sky-300">
                GitMob is out of date
              </div>
              <div className="text-xs text-foreground/60">
                Running {staleBuild.builtSha.slice(0, 7)},{' '}
                {staleBuild.behind === null
                  ? `${staleBuild.headSha.slice(0, 7)} is checked out`
                  : `${staleBuild.behind} commit${staleBuild.behind === 1 ? '' : 's'} behind`}
                . Tap to restart and rebuild.
              </div>
            </div>
          </button>
        )}

        {notificationsOff && (
          <Link
            href="/app/notifications"
            className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 active:opacity-80"
          >
            <svg
              className="w-5 h-5 shrink-0 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1h6z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-amber-300">
                Set up notifications
              </div>
              <div className="text-xs text-foreground/60">
                Job results will not reach this device until you do
              </div>
            </div>
            <svg
              className="w-4 h-4 shrink-0 text-amber-400/60"
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
          </Link>
        )}

        <PendingHandoffs onLaunched={() => refreshProjects()} />

        {error && (
          <div className="p-4 rounded-lg border border-red-500/50 bg-red-500/10">
            <div className="text-sm font-medium text-red-500 mb-1">
              Could not load projects
            </div>
            <pre className="text-xs text-foreground/70 whitespace-pre-wrap break-words">
              {error}
            </pre>
          </div>
        )}

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

        {pinned.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground/60 mb-2">
              Pinned
            </h2>
            <div className="space-y-2">
              {pinned.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground/60 mb-2">
              {active.length > 0 || pinned.length > 0
                ? 'All Projects'
                : 'Projects'}
            </h2>
            <div className="space-y-2">
              {others.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && !error && (
          <div className="text-center text-foreground/50 py-8">
            No projects found
          </div>
        )}
      </main>
    </div>
  );
}
