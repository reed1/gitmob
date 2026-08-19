'use client';

import { useCallback, useState } from 'react';
import { useAutoRefresh } from '../../../lib/use-auto-refresh';

interface CommitFileStat {
  path: string;
  insertions: number;
  deletions: number;
}

interface CommitEntry {
  hash: string;
  date: string;
  author: string;
  title: string;
  body: string;
  files: CommitFileStat[];
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function CommitCard({ commit }: { commit: CommitEntry }) {
  const [expanded, setExpanded] = useState(false);
  const insertions = commit.files.reduce((sum, f) => sum + f.insertions, 0);
  const deletions = commit.files.reduce((sum, f) => sum + f.deletions, 0);

  return (
    <div className="bg-foreground/5 border border-foreground/10 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 text-left active:opacity-80"
      >
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          <span>{relativeTime(commit.date)}</span>
          <span className="font-mono">{commit.hash.slice(0, 7)}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-green-400">+{insertions}</span>
            <span className="text-red-400">-{deletions}</span>
          </span>
        </div>
        <div className="mt-1 text-sm break-words">{commit.title}</div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {commit.body && (
            <pre className="text-xs text-foreground/70 whitespace-pre-wrap break-words font-sans">
              {commit.body}
            </pre>
          )}
          <div className="space-y-1">
            {commit.files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2 text-xs font-mono"
              >
                <span className="break-all text-foreground/70">
                  {file.path}
                </span>
                <span className="ml-auto shrink-0 flex items-center gap-1.5">
                  <span className="text-green-400">+{file.insertions}</span>
                  <span className="text-red-400">-{file.deletions}</span>
                </span>
              </div>
            ))}
            {commit.files.length === 0 && (
              <div className="text-xs text-foreground/40">No file changes</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RecentCommits({ projectId }: { projectId: string }) {
  const [commits, setCommits] = useState<CommitEntry[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/git?action=commits&count=5`
    );
    const data = await res.json();
    setCommits(data.commits ?? []);
  }, [projectId]);

  useAutoRefresh(load, 60000);

  if (commits === null) return null;

  return (
    <section>
      <h3 className="text-sm font-medium text-foreground/60 mb-3">Recent</h3>
      <div className="space-y-2">
        {commits.map((commit) => (
          <CommitCard key={commit.hash} commit={commit} />
        ))}
        {commits.length === 0 && (
          <div className="text-sm text-foreground/40">No commits yet</div>
        )}
      </div>
    </section>
  );
}
