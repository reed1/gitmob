"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface Project {
  id: string;
  path: string;
  tags?: string[];
  pinned?: boolean;
}

function isArchived(project: Project): boolean {
  return project.tags?.includes("archived") ?? false;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  const filtered = showArchived
    ? projects
    : projects.filter((p) => !isArchived(p));

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
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">GitMob</h1>
          <label className="flex items-center gap-2 text-sm text-foreground/60">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 rounded border-foreground/20 bg-foreground/5 accent-foreground"
            />
            Archived
          </label>
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

        <section>
          <h2 className="text-sm font-medium text-foreground/60 mb-2">
            All Projects
          </h2>
          <div className="space-y-2">
            {others.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/${project.id}`}
      className="block p-4 rounded-lg border border-foreground/10 bg-foreground/5 active:bg-foreground/10 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{project.id}</span>
        {isArchived(project) && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-foreground/20 text-foreground/60">
            archived
          </span>
        )}
      </div>
      <div className="text-sm text-foreground/50 truncate">{project.path}</div>
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
    </Link>
  );
}
