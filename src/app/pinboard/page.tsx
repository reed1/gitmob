'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { useAutoRefresh } from '../../lib/use-auto-refresh';

interface RecentNote {
  projectId: string;
  id: number;
  text: string;
  createdAt: string | null;
  editedAt: string | null;
}

interface Failure {
  projectId: string;
  error: string;
}

function noteKey(note: RecentNote): string {
  return `${note.projectId}#${note.id}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function formatAge(note: RecentNote): string {
  const stamp = note.editedAt ?? note.createdAt;
  if (!stamp) return '';

  const age = Date.now() - Date.parse(stamp);
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h ago`;
  if (age < MONTH) return `${Math.floor(age / DAY)}d ago`;
  if (age < YEAR) return `${Math.floor(age / MONTH)}mo ago`;
  return `${Math.floor(age / YEAR)}y ago`;
}

const COLLAPSED_LINES = 'line-clamp-3';

/**
 * Three lines, then an accordion. Only a note that actually overflows gets the chevron and the
 * tap target, and the measurement can only be taken while it is still clamped — so the answer
 * is kept once expanded rather than re-read from an element that no longer clips.
 */
function NoteBody({
  text,
  expanded,
  onToggle,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;

    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div
      className={`flex items-start gap-2 px-3 pb-2.5 pt-1 text-sm ${
        clipped ? 'cursor-pointer' : ''
      }`}
      onClick={clipped ? onToggle : undefined}
    >
      <div
        ref={textRef}
        className={`flex-1 min-w-0 whitespace-pre-wrap break-words ${
          expanded ? '' : COLLAPSED_LINES
        }`}
      >
        {text}
      </div>
      {clipped && (
        <svg
          className={`w-4 h-4 mt-0.5 shrink-0 text-foreground/30 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      )}
    </div>
  );
}

export default function PinboardOverviewPage() {
  const [notes, setNotes] = useState<RecentNote[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RecentNote | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/pinboard');
    const data = await res.json();
    setNotes(data.notes);
    setFailures(data.failures);
    setLoading(false);
  }, []);

  useAutoRefresh(load);

  const deleteNote = async (note: RecentNote) => {
    const res = await apiFetch(`/api/projects/${note.projectId}/pinboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', noteId: note.id }),
    });
    if (!res.ok) return;

    setDeleting(null);
    setExpandedKey(null);
    // Dropping the row keeps the list honest without re-reading all 39 boards; the next
    // refresh backfills whatever fell into the 50 this one vacated.
    setNotes((current) => current.filter((n) => noteKey(n) !== noteKey(note)));
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-background border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Pinboard</h1>
            <div className="text-xs text-foreground/50 truncate">
              {loading
                ? 'Reading every board...'
                : `${notes.length} most recent notes, all projects`}
            </div>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-foreground/10 active:opacity-80"
            aria-label="Refresh"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="p-3 space-y-2">
        {failures.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
            {failures.map((failure) => (
              <div key={failure.projectId} className="break-words">
                <span className="font-mono">{failure.projectId}</span>:{' '}
                {failure.error}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center text-foreground/50 py-8">Loading...</div>
        )}

        {!loading && notes.length === 0 && failures.length === 0 && (
          <div className="text-center text-foreground/50 py-8">
            No notes pinned anywhere
          </div>
        )}

        {notes.map((note) => {
          const key = noteKey(note);
          return (
            <div
              key={key}
              className="bg-foreground/5 border border-foreground/10 rounded-lg overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 pt-2 text-xs">
                <Link
                  href={`/p/${note.projectId}?tab=pinboard`}
                  className="font-mono text-blue-400/80 active:text-blue-300 truncate"
                >
                  {note.projectId}
                </Link>
                <span className="flex-1 text-right text-stone-400/55 whitespace-nowrap">
                  {formatAge(note)}
                </span>
                <button
                  onClick={() => setDeleting(note)}
                  className="shrink-0 -mr-1 -my-1 p-2 text-foreground/40 active:text-red-500"
                  aria-label={`Remove note ${note.id} from ${note.projectId}`}
                >
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
              <NoteBody
                text={note.text}
                expanded={expandedKey === key}
                onToggle={() =>
                  setExpandedKey(expandedKey === key ? null : key)
                }
              />
            </div>
          );
        })}
      </main>

      {deleting !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-foreground/20 rounded-lg p-4 w-80 max-w-full">
            <p className="text-sm mb-1">
              Remove this note from{' '}
              <span className="font-mono text-blue-400">
                {deleting.projectId}
              </span>
              ?
            </p>
            <p className="text-xs text-foreground/50 mb-4 line-clamp-3 break-words">
              {deleting.text}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleting(null)}
                className="px-3 py-1.5 text-sm text-foreground/70 active:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteNote(deleting)}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded active:opacity-80"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
