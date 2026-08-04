'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function DesktopScreenView({
  projectId,
  windowId,
  title,
  onBack,
}: {
  projectId: string;
  windowId: string;
  title: string;
  onBack: () => void;
}) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wrap, setWrap] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const scrolledToBottom = useRef(false);

  const fetchScreen = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/desktop?window=${encodeURIComponent(windowId)}`
    );
    const data = await res.json();
    if (res.ok) {
      setContent(data.content ?? '');
      setError(null);
    } else {
      setError(data.error || 'Could not read the session');
    }
    setLoading(false);
  }, [projectId, windowId]);

  useEffect(() => {
    fetchScreen();
    const interval = setInterval(fetchScreen, 3000);
    return () => clearInterval(interval);
  }, [fetchScreen]);

  // Only on the way in: the prompt sits at the bottom, but a poll must not yank the view
  // back down while the screen is being read.
  useEffect(() => {
    const el = preRef.current;
    if (!el || scrolledToBottom.current || !content) return;
    el.scrollTop = el.scrollHeight;
    scrolledToBottom.current = true;
  }, [content]);

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
        <div className="flex-1 min-w-0 font-medium truncate">{title}</div>
        <button
          onClick={() => setWrap((w) => !w)}
          className={`px-2 py-1 text-xs rounded border ${
            wrap
              ? 'bg-foreground/10 border-foreground/20'
              : 'border-foreground/10 text-foreground/50'
          }`}
        >
          Wrap
        </button>
        <button
          onClick={fetchScreen}
          className="px-2 py-1 text-xs rounded border border-foreground/10 text-foreground/50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-foreground/50">
          Loading session...
        </div>
      ) : error ? (
        <div className="p-4 space-y-2 text-center">
          <div className="text-red-500">Could not read the session</div>
          <pre className="p-2 text-xs text-left bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap">
            {error}
          </pre>
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80"
          >
            Back
          </button>
        </div>
      ) : (
        <pre
          ref={preRef}
          className={`flex-1 min-h-0 overflow-auto p-3 text-xs font-mono leading-relaxed ${
            wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
          }`}
        >
          {content || '(empty)'}
        </pre>
      )}
    </div>
  );
}
