'use client';

import { useCallback, useEffect, useState } from 'react';
import { relativeTime } from '../../../../../lib/relative-time';
import { highlight, snippetAround } from './recall-text';

export interface RecallMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface RecallHit {
  sessionId: string;
  cwd: string;
  timestamp: string;
  messages: RecallMessage[];
}

/** Long enough that a thumbed-in phrase goes out as one search rather than as every keystroke. */
const DEBOUNCE_MS = 500;

/** A hit carries the match and a message either side; the row shows the match and one neighbour. */
const ROW_MESSAGES = 2;

export function RecallSearch({
  projectId,
  onBack,
  onOpenSession,
}: {
  projectId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecallHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = useCallback(
    async (text: string) => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/recall?q=${encodeURIComponent(text)}`
        );
        const data = await res.json();
        if (res.ok) {
          setResults(data.results);
          setError(null);
        } else {
          setError(data.error || 'Could not search the sessions');
        }
      } finally {
        setSearching(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, search]);

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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          type="search"
          placeholder="Search past sessions"
          className="flex-1 min-w-0 text-sm bg-foreground/5 border border-foreground/15 rounded-lg px-3 py-2"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
        {error && (
          <pre className="p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap text-red-500">
            {error}
          </pre>
        )}

        {!error && results === null && (
          <div className="text-sm text-foreground/40">Loading...</div>
        )}

        {!error && results?.length === 0 && (
          <div className="text-sm text-foreground/40">
            {query.trim()
              ? 'No sessions matched.'
              : 'No sessions recorded for this project yet.'}
          </div>
        )}

        {results?.map((hit) => (
          <button
            key={hit.sessionId}
            onClick={() => onOpenSession(hit.sessionId)}
            className="w-full p-3 text-left bg-foreground/5 border border-foreground/10 rounded-lg active:opacity-80"
          >
            <div className="text-xs text-foreground/40 tabular-nums">
              {relativeTime(hit.timestamp)}
            </div>
            {hit.messages.slice(0, ROW_MESSAGES).map((message, index) => (
              <div key={index} className="mt-1.5 text-sm">
                <span className="text-xs uppercase tracking-wide text-foreground/40">
                  {message.role}
                </span>{' '}
                <span className="text-foreground/80">
                  {highlight(snippetAround(message.content, query), query)}
                </span>
              </div>
            ))}
          </button>
        ))}

        {searching && results !== null && (
          <div className="text-xs text-foreground/30">Searching...</div>
        )}
      </div>
    </div>
  );
}
