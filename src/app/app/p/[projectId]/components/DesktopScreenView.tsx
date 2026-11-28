'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SendKeysModal, SendTextModal } from './DesktopSendModals';
import { addToast, apiFetch } from '@/lib/api';
import { COMMON_COMMANDS, type CommonCommand } from '@/lib/desktop-keys';
import { projectApiPath } from '@/lib/project-paths';
import { QuestionWizard } from '@/app/app/PendingQuestions';
import { RemoteEditModal } from '@/app/app/PendingEdits';
import { PostcardStamp } from '@/app/app/PostcardStamp';
import {
  KebabMenu,
  KebabMenuItem,
  KebabMenuSeparator,
  KebabMenuToggle,
} from '@/app/app/KebabMenu';
import type { PendingQuestion } from '@/lib/claude-questions';
import type { PendingEdit } from '@/lib/remote-edits';
import type { SessionPostcards } from '@/lib/postcards';
import type { WindowView } from './ClaudeView';

/** A physical keycap: a raised grey box, its thick bottom border reading as the key's side. */
const keycapClass =
  'inline-flex items-center justify-center w-7 h-7 rounded-md bg-foreground/10 ' +
  'border border-b-[3px] border-foreground/25 text-foreground/70 shadow-sm';

/** A Mario "?" block: a bevelled yellow box with a rivet in each corner. */
const questionBlockClass =
  'relative shrink-0 w-9 h-9 flex items-center justify-center rounded-sm bg-amber-400 ' +
  'border-2 border-amber-800 text-xl font-black text-white [text-shadow:2px_2px_0_#78350f] ' +
  'shadow-[inset_2px_2px_0_#fde68a,inset_-2px_-2px_0_#b45309] ' +
  'active:translate-y-0.5 transition-transform';

export function DesktopScreenView({
  projectId,
  canonicalId,
  windowId,
  sessionId,
  title,
  hasAgenda,
  onBack,
  onOpenView,
}: {
  projectId: string;
  canonicalId: string;
  windowId: string;
  /** The window's Claude session, which postcards are filed under. */
  sessionId: string | null;
  title: string;
  hasAgenda: boolean;
  onBack: () => void;
  /** Absent for a window without a Claude session, which has neither transcript nor agenda. */
  onOpenView?: (view: WindowView) => void;
}) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [paused, setPaused] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [question, setQuestion] = useState<PendingQuestion | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [edit, setEdit] = useState<PendingEdit | null>(null);
  const [openEditId, setOpenEditId] = useState<string | null>(null);
  const [postcards, setPostcards] = useState<SessionPostcards | null>(null);
  // An edit is handed over from the desk to be worked on here, so it opens the moment it shows
  // up — once: closed, it stays behind its button.
  const seenEditIds = useRef(new Set<string>());
  const preRef = useRef<HTMLPreElement>(null);
  const scrolledToBottom = useRef(false);

  const fetchScreen = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch(
        `${projectApiPath(projectId)}/desktop?window=${encodeURIComponent(windowId)}`
      );
      const data = await res.json();
      if (signal.aborted) return;
      if (res.ok) {
        setContent(data.content ?? '');
        setQuestion(data.question);
        setEdit(data.edit);
        setPostcards(data.postcards);
        if (data.edit && !seenEditIds.current.has(data.edit.id)) {
          seenEditIds.current.add(data.edit.id);
          setOpenEditId(data.edit.id);
        }
        setError(null);
      } else {
        setError(data.error || 'Could not read the session');
      }
      setLoading(false);
    },
    [projectId, windowId]
  );

  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    const initialRefresh = setTimeout(
      () => void fetchScreen(controller.signal),
      0
    );
    const interval = setInterval(
      () => void fetchScreen(controller.signal),
      3000
    );
    return () => {
      controller.abort();
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, [fetchScreen, paused]);

  const acceptPrompt = async () => {
    const res = await apiFetch(`${projectApiPath(projectId)}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId, action: 'accept-prompt' }),
    });
    if (res.ok) addToast('Accepted the offered prompt', 'success');
  };

  const sendCommand = async (command: CommonCommand) => {
    const res = await apiFetch(`${projectApiPath(projectId)}/desktop`, {
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
        {question && (
          <button
            onClick={() => setOpenQuestionId(question.id)}
            aria-label="Answer Claude's question"
            className={questionBlockClass}
          >
            {[
              'top-0.5 left-0.5',
              'top-0.5 right-0.5',
              'bottom-0.5 left-0.5',
              'bottom-0.5 right-0.5',
            ].map((corner) => (
              <span
                key={corner}
                className={`absolute ${corner} w-1 h-1 bg-amber-900/70`}
              />
            ))}
            ?
          </button>
        )}
        {sessionId && postcards && postcards.count > 0 && (
          <PostcardStamp sessionId={sessionId} postcards={postcards} />
        )}
        {edit && (
          <button
            onClick={() => setOpenEditId(edit.id)}
            aria-label="Edit the session's input"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-sky-500/50 bg-sky-500/15 text-sky-400 active:opacity-80"
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
                d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 8 18l1-4.464z"
              />
            </svg>
          </button>
        )}
        <KebabMenu label="Window actions">
          {onOpenView && (
            <>
              <KebabMenuItem onSelect={() => onOpenView('transcript')}>
                Transcript
              </KebabMenuItem>
              <KebabMenuItem
                onSelect={() => onOpenView('agenda')}
                disabled={!hasAgenda}
              >
                Agenda
              </KebabMenuItem>
              <KebabMenuSeparator />
            </>
          )}
          <KebabMenuToggle label="Wrap" checked={wrap} onChange={setWrap} />
          <KebabMenuToggle
            label="Pause"
            checked={paused}
            onChange={setPaused}
          />
          <KebabMenuItem
            onSelect={() => setTextOpen(true)}
            ariaLabel="Send text"
          >
            <span className="flex items-center gap-1.5">
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
            </span>
          </KebabMenuItem>
          <KebabMenuItem
            onSelect={() => setKeysOpen(true)}
            ariaLabel="Send keys"
          >
            <span className="flex items-center gap-1.5">
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
                  d="M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M10 14h4"
                />
              </svg>
            </span>
          </KebabMenuItem>
          <KebabMenuSeparator />
          {COMMON_COMMANDS.map((command) => (
            <KebabMenuItem key={command} onSelect={() => sendCommand(command)}>
              {command}
            </KebabMenuItem>
          ))}
          <KebabMenuSeparator />
          <KebabMenuItem
            onSelect={acceptPrompt}
            ariaLabel="Accept the offered prompt"
          >
            <span className="flex items-center gap-2">
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
            </span>
          </KebabMenuItem>
        </KebabMenu>
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

      {/* The hook withdraws a question when the user is back at the desk; an open form goes with it. */}
      {question && question.id === openQuestionId && (
        <QuestionWizard
          key={question.id}
          pending={question}
          onClose={() => setOpenQuestionId(null)}
          onAnswered={() => {
            setOpenQuestionId(null);
            setQuestion(null);
          }}
        />
      )}

      {/* Its window closed, the edit drops out of the next poll and its form goes with it. */}
      {edit && edit.id === openEditId && (
        <RemoteEditModal
          key={edit.id}
          pending={edit}
          onClose={() => setOpenEditId(null)}
          onReplied={() => {
            setOpenEditId(null);
            setEdit(null);
          }}
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
