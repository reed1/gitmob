'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Project {
  id: string;
  path: string;
  tags?: string[];
  pinned?: boolean;
}

function isArchived(project: Project): boolean {
  return project.tags?.includes('archived') ?? false;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  const filtered = projects
    .filter((p) => showArchived || !isArchived(p))
    .filter(
      (p) =>
        search === '' ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.path.toLowerCase().includes(search.toLowerCase())
    );

  const pinned = filtered.filter((p) => p.pinned);
  const others = filtered.filter((p) => !p.pinned);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground/50">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">GitMob</h1>
          <label className="flex items-center gap-2 text-sm text-foreground/60 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded border-2 border-foreground/30 peer-checked:bg-foreground peer-checked:border-foreground flex items-center justify-center">
              {showArchived && (
                <svg className="w-3 h-3 text-background" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            Show Archived
          </label>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className="p-4 space-y-6">
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
              {pinned.length > 0 ? 'All Projects' : 'Projects'}
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

function getRelativePath(fullPath: string): string {
  const match = fullPath.match(/^\/home\/[^/]+\/(.*)$/);
  if (match) {
    return match[1];
  }
  return fullPath.replace(/^\//, '');
}

function ProjectCard({ project }: { project: Project }) {
  const relativePath = getRelativePath(project.path);

  return (
    <div className="p-4 rounded-lg border border-foreground/10 bg-foreground/5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{project.id}</span>
          {isArchived(project) && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-foreground/20 text-foreground/60">
              archived
            </span>
          )}
        </div>
        <input
          type="text"
          readOnly
          value={`cd ${relativePath}`}
          className="w-full text-sm text-foreground/50 bg-transparent border-none outline-none p-0"
          onFocus={(e) => e.target.select()}
        />
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
      <Link
        href={`/${project.id}`}
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
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>
    </div>
  );
}
