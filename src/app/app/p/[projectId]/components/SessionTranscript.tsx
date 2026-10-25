'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { RecallMessage } from './RecallSearch';
import { TranscriptMessage } from './TranscriptMessage';
import { SendTextModal } from './DesktopSendModals';
import { projectApiPath } from '@/lib/project-paths';

/** How close to the end still counts as reading the end, so a refresh keeps following it. */
const FOLLOW_SLACK_PX = 80;

/** An open window's conversation, read back through `recall`, which indexes it on the way. */
export function SessionTranscript({
  projectId,
  canonicalId,
  windowId,
  sessionId,
  lookingUp,
  title,
  onBack,
  onOpenTerminal,
}: {
  projectId: string;
  canonicalId: string;
  windowId: string;
  sessionId: string | null;
  /** The window's session is not known yet, so neither is whether it has one. */
  lookingUp: boolean;
  title: string;
  onBack: () => void;
  onOpenTerminal: () => void;
}) {
  const [messages, setMessages] = useState<RecallMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followEnd = useRef(true);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${projectApiPath(projectId)}/recall?session=${encodeURIComponent(sessionId)}`
      );
      const data = await res.json();
      if (res.ok) {
        setMessages(data.session.messages);
        setError(null);
      } else {
        setError(data.error || 'Could not read the session');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && followEnd.current)
      scroller.scrollTop = scroller.scrollHeight;
  }, [messages]);

  const trackFollow = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    followEnd.current =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
      FOLLOW_SLACK_PX;
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
          <div className="font-medium truncate">{title}</div>
          <div className="text-xs text-foreground/40 truncate tabular-nums">
            {loading
              ? 'Loading...'
              : messages
                ? `${messages.length} messages`
                : sessionId}
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((open) => !open)}
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
                d="M12 5v.01M12 12v.01M12 19v.01"
              />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={onOpenTerminal}
                  className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 whitespace-nowrap"
                >
                  Terminal
                </button>
                <div className="my-1 border-t border-foreground/10" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    load();
                  }}
                  disabled={loading || !sessionId}
                  className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 whitespace-nowrap disabled:opacity-40"
                >
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setTextOpen(true);
                  }}
                  aria-label="Send text"
                  className="flex w-full items-center gap-1.5 px-4 py-2 text-sm hover:bg-foreground/10 whitespace-nowrap"
                >
                  Send
                  <svg
                    className="w-5 h-5 text-foreground/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 7V5h14v2M12 5v14M9 19h6"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={trackFollow}
        className="flex-1 min-h-0 overflow-auto p-3 space-y-2"
      >
        {error && (
          <pre className="p-2 text-xs bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap text-red-500">
            {error}
          </pre>
        )}

        {!lookingUp && !sessionId && (
          <div className="text-sm text-foreground/40">
            This window holds no Claude session to read.
          </div>
        )}

        {!error && messages === null && (lookingUp || sessionId) && (
          <div className="text-sm text-foreground/40">Loading...</div>
        )}

        {messages?.length === 0 && (
          <div className="text-sm text-foreground/40">
            This session has no messages yet.
          </div>
        )}

        {messages?.map((message, index) => (
          <TranscriptMessage key={index} message={message} />
        ))}
      </div>

      {textOpen && (
        <SendTextModal
          projectId={projectId}
          canonicalId={canonicalId}
          windowId={windowId}
          title={title}
          onClose={() => setTextOpen(false)}
        />
      )}
    </div>
  );
}
