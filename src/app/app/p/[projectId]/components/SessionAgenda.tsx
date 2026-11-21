'use client';

import { useCallback, useEffect, useState } from 'react';
import { TranscriptMarkdown } from './TranscriptMarkdown';
import type { WindowView } from './ClaudeView';
import {
  KebabMenu,
  KebabMenuItem,
  KebabMenuSeparator,
} from '@/app/app/KebabMenu';
import { projectApiPath } from '@/lib/project-paths';

/** The points an open window's session keeps to revisit, read through `claudex agenda`. */
export function SessionAgenda({
  projectId,
  sessionId,
  lookingUp,
  title,
  onBack,
  onOpenView,
}: {
  projectId: string;
  sessionId: string | null;
  /** The window's session is not known yet, so neither is whether it has one. */
  lookingUp: boolean;
  title: string;
  onBack: () => void;
  onOpenView: (view: WindowView) => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${projectApiPath(projectId)}/agenda?session=${encodeURIComponent(sessionId)}`
      );
      const data = await res.json();
      if (res.ok) {
        setContent(data.content);
        setError(null);
      } else {
        setError(data.error || 'Could not read the agenda');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-foreground/10 bg-background">
        <button
          onClick={onBack}
          className="p-1 text-foreground/50 active:opacity-80"
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
          <div className="font-medium truncate">{title}</div>
          <div className="text-xs text-foreground/40 truncate">
            {loading ? 'Loading...' : 'Agenda'}
          </div>
        </div>
        <KebabMenu label="Agenda actions">
          <KebabMenuItem onSelect={() => onOpenView('terminal')}>
            Terminal
          </KebabMenuItem>
          <KebabMenuItem onSelect={() => onOpenView('transcript')}>
            Transcript
          </KebabMenuItem>
          <KebabMenuSeparator />
          <KebabMenuItem onSelect={load} disabled={loading || !sessionId}>
            Refresh
          </KebabMenuItem>
        </KebabMenu>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 text-sm">
        {error && (
          <pre className="p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap text-red-500">
            {error}
          </pre>
        )}

        {!lookingUp && !sessionId && (
          <div className="text-foreground/40">
            This window holds no Claude session to read.
          </div>
        )}

        {!error && content === null && (lookingUp || sessionId) && (
          <div className="text-foreground/40">Loading...</div>
        )}

        {content?.trim() === '' && (
          <div className="text-foreground/40">
            This session has no agenda yet.
          </div>
        )}

        {content?.trim() && <TranscriptMarkdown content={content} />}
      </div>
    </div>
  );
}
