'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { addToast } from '../../lib/api';
import { useAutoRefresh } from '../../lib/use-auto-refresh';
import { useCachedState } from '../../lib/use-cached-state';
import {
  PinboardDeleteConfirm,
  PinboardNoteCard,
  PinboardNoteModal,
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
const CACHE_REFRESH_DELAY_MS = 10_000;

function noteKey(note: RecentNote): string {
  return `${note.projectId}#${note.id}`;
}

async function fetchSnapshot(): Promise<Snapshot> {
  const res = await fetch('/api/pinboard');
  const data = await res.json();
  return { notes: data.notes, failures: data.failures };
}

/**
 * A plain fetch rather than `apiFetch`: writes to one board may overlap, and an offline phone
 * is just another failed write.
 */
async function postPinboard(
  projectId: string,
  body: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/pinboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The cached snapshot paints on open; edits and deletes wait for the first load and then act
 * on a list of this page's own. They are optimistic and never reconciled with the server: a
 * failed one leaves its text on screen to be copied, and only a reload shows the boards as
 * they are. Successful writes refresh the cache in the background, never the screen.
 */
export default function PinboardOverviewPage() {
  const [cached, setCached, restored] = useCachedState<Snapshot>(SNAPSHOT_KEY);
  const [loaded, setLoaded] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecentNote | null>(null);
  const [deleting, setDeleting] = useState<RecentNote | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const cacheRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshot = loaded ?? cached;
  const notes = useMemo(() => snapshot?.notes ?? [], [snapshot]);
  const failures = snapshot?.failures ?? [];
  const highlighted = Math.min(highlightedIndex, notes.length - 1);

  const load = useCallback(async () => {
    setRefreshing(true);
    const fresh = await fetchSnapshot();
    setCached(fresh);
    setLoaded(fresh);
    setRefreshing(false);
  }, [setCached]);

  useAutoRefresh(load);

  const scheduleCacheRefresh = () => {
    if (cacheRefreshTimer.current !== null) {
      clearTimeout(cacheRefreshTimer.current);
    }
    cacheRefreshTimer.current = setTimeout(async () => {
      cacheRefreshTimer.current = null;
      setCached(await fetchSnapshot());
    }, CACHE_REFRESH_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (cacheRefreshTimer.current !== null) {
        clearTimeout(cacheRefreshTimer.current);
      }
    },
    []
  );

  const modalOpen = editing !== null || deleting !== null;
  const actionsReady = loaded !== null;

  useEffect(() => {
    if (modalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea')
      )
        return;

      if (e.key === 'j') {
        setHighlightedIndex((i) => Math.min(i + 1, notes.length - 1));
      } else if (e.key === 'k') {
        setHighlightedIndex((i) =>
          Math.max(Math.min(i, notes.length - 1) - 1, 0)
        );
      } else if (e.key === ' ') {
        e.preventDefault();
        if (highlighted >= 0) {
          const key = noteKey(notes[highlighted]);
          setExpandedKey((expanded) => (expanded === key ? null : key));
        }
      } else if (e.key === 'e') {
        if (actionsReady && highlighted >= 0) {
          e.preventDefault();
          setEditing(notes[highlighted]);
        }
      } else if (e.key === 'x') {
        if (actionsReady && highlighted >= 0) setDeleting(notes[highlighted]);
      } else if (e.key === 'q') {
        window.close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, actionsReady, highlighted, notes]);

  const editNote = async (note: RecentNote, text: string) => {
    setEditing(null);
    setLoaded((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            notes: prev.notes.map((n) =>
              noteKey(n) === noteKey(note)
                ? { ...n, text, editedAt: new Date().toISOString() }
                : n
            ),
          }
    );

    if (
      await postPinboard(note.projectId, {
        action: 'edit',
        noteId: note.id,
        text,
      })
    ) {
      scheduleCacheRefresh();
    } else {
      addToast('Editing failed');
    }
  };

  const deleteNote = async (note: RecentNote) => {
    setDeleting(null);
    setExpandedKey(null);
    setLoaded((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            notes: prev.notes.filter((n) => noteKey(n) !== noteKey(note)),
          }
    );

    if (
      await postPinboard(note.projectId, {
        action: 'delete',
        noteId: note.id,
      })
    ) {
      scheduleCacheRefresh();
    } else {
      addToast('Delete failed, please refresh');
    }
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

        {notes.map((note, index) => {
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
              highlighted={index === highlighted}
              onToggle={() => {
                setHighlightedIndex(index);
                setExpandedKey(expandedKey === key ? null : key);
              }}
              actionsDisabled={!actionsReady}
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
