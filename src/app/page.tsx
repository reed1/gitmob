'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Project {
  id: string;
  path: string;
  tags?: string[];
  editing: boolean;
}

function isArchived(project: Project): boolean {
  return project.tags?.includes('archived') ?? false;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

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

  const editing = filtered.filter((p) => p.editing);
  const others = filtered.filter((p) => !p.editing);

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
                    onClick={() => {
                      setShowArchived(!showArchived);
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 flex items-center gap-2"
                  >
                    <span className="w-4">
                      {showArchived && (
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    Show Archived
                  </button>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await fetch('/api/restart', { method: 'POST' });
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
        {editing.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground/60 mb-2">
              Editing
            </h2>
            <div className="space-y-2">
              {editing.map((project) => (
                <ProjectCard key={project.id} project={project} isEditing />
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground/60 mb-2">
              {editing.length > 0 ? 'All Projects' : 'Projects'}
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

function ProjectCard({
  project,
  isEditing,
}: {
  project: Project;
  isEditing?: boolean;
}) {
  const relativePath = getRelativePath(project.path);

  return (
    <div
      className={`p-4 rounded-lg border flex items-center gap-3 ${
        isEditing
          ? 'border-green-500/50 bg-green-500/10'
          : 'border-foreground/10 bg-foreground/5'
      }`}
    >
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
