'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KebabMenu, KebabMenuItem } from '@/app/app/KebabMenu';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { relativeTime } from '@/lib/relative-time';
import { addToast } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { projectApiPath, projectPagePath } from '@/lib/project-paths';

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

async function copySha(hash: string) {
  if (await copyText(hash)) addToast('Copied the SHA', 'success');
  else addToast('Could not copy to the clipboard');
}

function CommitCard({
  projectId,
  commit,
}: {
  projectId: string;
  commit: CommitEntry;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const insertions = commit.files.reduce((sum, f) => sum + f.insertions, 0);
  const deletions = commit.files.reduce((sum, f) => sum + f.deletions, 0);

  return (
    <div className="bg-foreground/5 border border-foreground/10 rounded-lg">
      <div className="flex items-start gap-2 pr-2 pt-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 pl-3 pt-1 pb-2.5 text-left active:opacity-80"
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
        <KebabMenu label={`Actions for ${commit.hash.slice(0, 7)}`}>
          <KebabMenuItem
            onSelect={() =>
              router.push(
                `${projectPagePath(projectId)}/review?commit=${commit.hash}`
              )
            }
          >
            Review
          </KebabMenuItem>
          <KebabMenuItem onSelect={() => copySha(commit.hash)}>
            Copy SHA
          </KebabMenuItem>
        </KebabMenu>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {commit.body && (
            <pre className="text-xs text-foreground/70 whitespace-pre-wrap break-words font-sans">
              {commit.body}
            </pre>
          )}
          <div className="space-y-1">
            {/* The diff opens over this tab rather than in place of it, so back finds the
                cards still expanded and scrolled where they were. */}
            {commit.files.map((file) => (
              <Link
                key={file.path}
                href={`${projectPagePath(projectId)}?tab=commit&commit=${commit.hash}&file=${encodeURIComponent(file.path)}`}
                scroll={false}
                className="flex items-center gap-2 text-xs font-mono active:opacity-80"
              >
                <span className="break-all text-foreground/70 underline decoration-foreground/30 underline-offset-2">
                  {file.path}
                </span>
                <span className="ml-auto shrink-0 flex items-center gap-1.5">
                  <span className="text-green-400">+{file.insertions}</span>
                  <span className="text-red-400">-{file.deletions}</span>
                </span>
              </Link>
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

const PAGE_SIZE = 5;

export function RecentCommits({ projectId }: { projectId: string }) {
  // Every refresh refetches all the commits shown, so polling never drops what Load more added.
  const [count, setCount] = useState(PAGE_SIZE);
  const [loaded, setLoaded] = useState<{
    count: number;
    commits: CommitEntry[];
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `${projectApiPath(projectId)}/git?action=commits&count=${count}`
    );
    const data = await res.json();
    setLoaded({ count, commits: data.commits ?? [] });
  }, [projectId, count]);

  useAutoRefresh(load, 60000);

  if (loaded === null) return null;

  const { commits } = loaded;
  const loadingMore = loaded.count < count;
  // Fewer than asked for means the history has run out.
  const hasMore = commits.length === loaded.count;

  return (
    <section>
      <h3 className="text-sm font-medium text-foreground/60 mb-3">Recent</h3>
      <div className="space-y-2">
        {commits.map((commit) => (
          <CommitCard key={commit.hash} projectId={projectId} commit={commit} />
        ))}
        {commits.length === 0 && (
          <div className="text-sm text-foreground/40">No commits yet</div>
        )}
      </div>
      {(hasMore || loadingMore) && (
        <button
          onClick={() => setCount(count + PAGE_SIZE)}
          disabled={loadingMore}
          className="mt-2 w-full py-2 text-sm text-foreground/60 border border-foreground/10 rounded-lg active:bg-foreground/10 disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </section>
  );
}
