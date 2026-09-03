'use client';

import { useCallback, useEffect, useState } from 'react';
import { addToast, apiFetch } from '../../../../../lib/api';
import { relativeTime } from '../../../../../lib/relative-time';
import type { RecallMessage } from './RecallSearch';

interface RecallSession {
  sessionId: string;
  cwd: string;
  timestamp: string;
  messages: RecallMessage[];
}

/** Past this, a message is folded: one long answer otherwise buries the exchange around it. */
const FOLD_AT = 900;

function Message({ message }: { message: RecallMessage }) {
  const [expanded, setExpanded] = useState(false);
  const folded = !expanded && message.content.length > FOLD_AT;

  return (
    <div className="p-3 bg-foreground/5 border border-foreground/10 rounded-lg">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-foreground/40">
          {message.role}
        </span>
        <span className="text-xs text-foreground/30 tabular-nums">
          {relativeTime(message.timestamp)}
        </span>
      </div>
      <div className="mt-1.5 text-sm whitespace-pre-wrap break-words">
        {folded ? `${message.content.slice(0, FOLD_AT)}…` : message.content}
      </div>
      {message.content.length > FOLD_AT && (
        <button
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 text-xs text-blue-500 active:opacity-80"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export function RecallTranscript({
  projectId,
  sessionId,
  onBack,
  onResumed,
  onOpenWindow,
}: {
  projectId: string;
  sessionId: string;
  onBack: () => void;
  onResumed: () => void;
  onOpenWindow: (windowId: string) => void;
}) {
  const [session, setSession] = useState<RecallSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/recall?session=${encodeURIComponent(sessionId)}`
    );
    const data = await res.json();
    if (res.ok) {
      setSession(data.session);
      setError(null);
    } else {
      setError(data.error || 'Could not read the session');
    }
  }, [projectId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const resume = async () => {
    setResuming(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      // Already open: the toast has said so, and the window holding it is where to go.
      if (res.status === 409 && data.windowId) {
        onOpenWindow(data.windowId);
        return;
      }
      if (!res.ok) return;

      addToast(`Resumed ${data.name}`, 'success');
      onResumed();
    } finally {
      setResuming(false);
    }
  };

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
          <div className="font-medium truncate">Past session</div>
          <div className="text-xs text-foreground/40 truncate tabular-nums">
            {session ? relativeTime(session.timestamp) : sessionId}
          </div>
        </div>
        <button
          onClick={resume}
          disabled={resuming || !session}
          className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/15 text-blue-500 border border-blue-500/20 active:opacity-80 disabled:opacity-40"
        >
          {resuming ? 'Resuming...' : 'Resume'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
        {error && (
          <pre className="p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap text-red-500">
            {error}
          </pre>
        )}

        {!error && session === null && (
          <div className="text-sm text-foreground/40">Loading...</div>
        )}

        {session?.messages.length === 0 && (
          <div className="text-sm text-foreground/40">
            This session has no messages.
          </div>
        )}

        {session?.messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}
      </div>
    </div>
  );
}
