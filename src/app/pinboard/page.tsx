'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useAutoRefresh } from '../../lib/use-auto-refresh';
import { useCachedState } from '../../lib/use-cached-state';
import {
  PinboardDeleteConfirm,
  PinboardNoteCard,
  PinboardNoteModal,
  mutatePinboard,
  type PinboardNote,
} from '../../components/PinboardNote';

interface RecentNote extends PinboardNote {
  projectId: string;
}

interface Failure {
  projectId: string;
  error: string;
}

interface Snapshot {
  notes: RecentNote[];
  failures: Failure[];
}

const SNAPSHOT_KEY = 'pinboard:snapshot';

function noteKey(note: RecentNote): string {
  return `${note.projectId}#${note.id}`;
}

export default function PinboardOverviewPage() {
  const [snapshot, setSnapshot, restored] =
    useCachedState<Snapshot>(SNAPSHOT_KEY);
  const [refreshing, setRefreshing] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecentNote | null>(null);
  const [deleting, setDeleting] = useState<RecentNote | null>(null);

  const notes = snapshot?.notes ?? [];
  const failures = snapshot?.failures ?? [];

  const load = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch('/api/pinboard');
    const data = await res.json();
    setSnapshot({ notes: data.notes, failures: data.failures });
    setRefreshing(false);
  }, [setSnapshot]);

  useAutoRefresh(load);

  const editNote = async (note: RecentNote, text: string) => {
    const board = await mutatePinboard(note.projectId, {
      action: 'edit',
      noteId: note.id,
      text,
    });
    if (board === null) return;

    // The board comes back whole, but only this one row of the overview is about that
    // project — take the note's new text and stamp from it and leave the rest alone.
    const saved = board.find((n) => n.id === note.id);
    setEditing(null);
    setSnapshot({
      notes: notes.map((n) =>
        noteKey(n) === noteKey(note) && saved
          ? { ...saved, projectId: note.projectId }
          : n
      ),
      failures,
    });
  };

  const deleteNote = async (note: RecentNote) => {
    if (
      (await mutatePinboard(note.projectId, {
        action: 'delete',
        noteId: note.id,
      })) === null
    ) {
      return;
    }

    setDeleting(null);
    setExpandedKey(null);
    // Dropping the row keeps the list honest without re-reading all 39 boards; the next
    // refresh backfills whatever fell into the 50 this one vacated.
    setSnapshot({
      notes: notes.filter((n) => noteKey(n) !== noteKey(note)),
      failures,
    });
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-background border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Pinboard</h1>
            <div className="text-xs text-foreground/50 truncate">
              {snapshot === null
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
              className={`w-5 h-5 text-foreground/60 ${
                refreshing ? 'animate-spin' : ''
              }`}
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

        {restored && snapshot === null && (
          <div className="text-center text-foreground/50 py-8">Loading...</div>
        )}

        {snapshot !== null && notes.length === 0 && failures.length === 0 && (
          <div className="text-center text-foreground/50 py-8">
            No notes pinned anywhere
          </div>
        )}

        {notes.map((note) => {
          const key = noteKey(note);
          return (
            <PinboardNoteCard
              key={key}
              note={note}
              label={
                <Link
                  href={`/app/p/${note.projectId}?tab=pinboard`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-blue-400/80 active:text-blue-300"
                >
                  {note.projectId}
                </Link>
              }
              expanded={expandedKey === key}
              onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
              onEdit={() => setEditing(note)}
              onDelete={() => setDeleting(note)}
            />
          );
        })}
      </main>

      {editing !== null && (
        <PinboardNoteModal
          projectId={editing.projectId}
          initialText={editing.text}
          onSave={(text) => editNote(editing, text)}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting !== null && (
        <PinboardDeleteConfirm
          projectId={deleting.projectId}
          text={deleting.text}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteNote(deleting)}
        />
      )}
    </div>
  );
}
