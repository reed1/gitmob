'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SendKeysModal, SendTextModal } from './DesktopSendModals';
import { addToast, apiFetch } from '../../../../../lib/api';
import {
  COMMON_COMMANDS,
  type CommonCommand,
} from '../../../../../lib/desktop-keys';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';

/** A physical keycap: a raised grey box, its thick bottom border reading as the key's side. */
const keycapClass =
  'inline-flex items-center justify-center w-7 h-7 rounded-md bg-foreground/10 ' +
  'border border-b-[3px] border-foreground/25 text-foreground/70 shadow-sm';

export function DesktopScreenView({
  projectId,
  canonicalId,
  windowId,
  title,
  onBack,
}: {
  projectId: string;
  canonicalId: string;
  windowId: string;
  title: string;
  onBack: () => void;
}) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
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

  useAutoRefresh(fetchScreen, 3000);

  const acceptPrompt = async () => {
    setMenuOpen(false);

    const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId, action: 'accept-prompt' }),
    });
    if (res.ok) addToast('Accepted the offered prompt', 'success');
  };

  const sendCommand = async (command: CommonCommand) => {
    setMenuOpen(false);

    const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId, action: 'command', command }),
    });
    if (res.ok) addToast(`Sent ${command}`, 'success');
  };

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
                  onClick={() => {
                    setWrap((w) => !w);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 whitespace-nowrap"
                >
                  {wrap ? 'No Wrap' : 'Wrap'}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setTextOpen(true);
                  }}
                  className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 whitespace-nowrap"
                >
                  Send Text
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setKeysOpen(true);
                  }}
                  className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 whitespace-nowrap"
                >
                  Send Keys
                </button>
                <div className="my-1 border-t border-foreground/10" />
                {COMMON_COMMANDS.map((command) => (
                  <button
                    key={command}
                    onClick={() => sendCommand(command)}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 whitespace-nowrap"
                  >
                    {command}
                  </button>
                ))}
                <div className="my-1 border-t border-foreground/10" />
                <button
                  onClick={acceptPrompt}
                  aria-label="Accept the offered prompt"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-foreground/10"
                >
                  <span className={keycapClass}>
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
                        d="M5 12h14M13 6l6 6-6 6"
                      />
                    </svg>
                  </span>
                  <span className={keycapClass}>
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
                        d="M19 7v4a2 2 0 01-2 2H6m0 0l4-4m-4 4l4 4"
                      />
                    </svg>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
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

      {textOpen && (
        <SendTextModal
          projectId={projectId}
          canonicalId={canonicalId}
          windowId={windowId}
          title={title}
          onClose={() => setTextOpen(false)}
        />
      )}

      {keysOpen && (
        <SendKeysModal
          projectId={projectId}
          windowId={windowId}
          title={title}
          onClose={() => setKeysOpen(false)}
        />
      )}
    </div>
  );
}
