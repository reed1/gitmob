'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addToast } from '@/lib/api';
import { useOfflineFirst } from '@/lib/use-offline-first';
import { OfflineFirstPage } from '@/components/OfflineFirstPage';
import {
  PinboardDeleteConfirm,
  PinboardNoteCard,
  PinboardNoteModal,
  copyNote,
  toastNoteWritten,
  type PinboardNote,
} from '@/components/PinboardNote';
import { NewSessionModal } from '@/app/app/NewSessionModal';
import { projectApiPath, projectPagePath } from '@/lib/project-paths';

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

function matchesQuery(note: RecentNote, query: string): boolean {
  const haystack = `${note.projectId} ${note.text}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

async function parseSnapshot(res: Response): Promise<Snapshot> {
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
    const res = await fetch(`${projectApiPath(projectId)}/pinboard`, {
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
 * Edits and deletes wait for the server's snapshot and then act on a copy of this page's own.
 * They are optimistic and never reconciled with the server: the success toast comes with the
 * change on screen, the server only speaks up when it fails, and a failed write leaves its text
 * on screen to be copied — only a reload shows the boards as they are. Successful writes refresh
 * the cache in the background, never the screen.
 */
export default function PinboardOverviewPage() {
  const source = useOfflineFirst(SNAPSHOT_KEY, '/api/pinboard', parseSnapshot);
  const { data: snapshot, edit } = source;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecentNote | null>(null);
  const [deleting, setDeleting] = useState<RecentNote | null>(null);
  const [claudeNote, setClaudeNote] = useState<RecentNote | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const cacheRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allNotes = useMemo(() => snapshot?.notes ?? [], [snapshot]);
  const notes = useMemo(
    () =>
      appliedQuery.trim() === ''
        ? allNotes
        : allNotes.filter((note) => matchesQuery(note, appliedQuery.trim())),
    [allNotes, appliedQuery]
  );
  const failures = snapshot?.failures ?? [];
  const highlighted = Math.min(
    Math.max(
      notes.findIndex((n) => noteKey(n) === highlightedKey),
      0
    ),
    notes.length - 1
  );
  const router = useRouter();

  const scheduleCacheRefresh = () => {
    if (cacheRefreshTimer.current !== null) {
      clearTimeout(cacheRefreshTimer.current);
    }
    cacheRefreshTimer.current = setTimeout(async () => {
      cacheRefreshTimer.current = null;
      await source.refreshCache();
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

  const modalOpen =
    editing !== null || deleting !== null || claudeNote !== null;
  const actionsReady = source.fresh;

  useEffect(() => {
    if (modalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea')
      )
        return;

      if (e.key === '/') {
        e.preventDefault();
        setSearchText('');
        searchInput.current?.focus();
        return;
      }

      if (highlighted < 0) return;

      if (e.key === 'j') {
        const next = notes[Math.min(highlighted + 1, notes.length - 1)];
        setHighlightedKey(noteKey(next));
      } else if (e.key === 'k') {
        setHighlightedKey(noteKey(notes[Math.max(highlighted - 1, 0)]));
      } else if (e.key === ' ') {
        e.preventDefault();
        const key = noteKey(notes[highlighted]);
        setExpandedKey((expanded) => (expanded === key ? null : key));
      } else if (e.key === 'y') {
        copyNote(notes[highlighted]);
      } else if (e.key === 'o') {
        router.push(
          `${projectPagePath(notes[highlighted].projectId)}?tab=pinboard`
        );
      } else if (e.key === 'e') {
        if (actionsReady) {
          e.preventDefault();
          setEditing(notes[highlighted]);
        }
      } else if (e.key === 'x') {
        if (actionsReady) setDeleting(notes[highlighted]);
      } else if (e.key === 'q') {
        window.close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, actionsReady, highlighted, notes, router]);

  const applySearch = () => {
    setAppliedQuery(searchText);
    setHighlightedKey(null);
    setExpandedKey(null);
    searchInput.current?.blur();
    window.scrollTo({ top: 0 });
  };

  const editNote = async (note: RecentNote, text: string) => {
    setEditing(null);
    edit((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        noteKey(n) === noteKey(note)
          ? { ...n, text, editedAt: new Date().toISOString() }
          : n
      ),
    }));
    toastNoteWritten('Note edited');

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
    if (noteKey(note) === highlightedKey) {
      const index = notes.findIndex((n) => noteKey(n) === highlightedKey);
      const successor = notes[index + 1] ?? notes[index - 1];
      setHighlightedKey(successor ? noteKey(successor) : null);
    }
    edit((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => noteKey(n) !== noteKey(note)),
    }));
    toastNoteWritten('Note deleted');

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
    <>
      <OfflineFirstPage
        source={source}
        title="Pinboard"
        subtitle={
          <div className="text-xs text-foreground/50 truncate">
            {snapshot === null
              ? 'Reading every board...'
              : appliedQuery.trim() === ''
                ? `${notes.length} most recent notes, all projects`
                : `${notes.length} of ${allNotes.length} notes match`}
          </div>
        }
        middle={
          <input
            ref={searchInput}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applySearch();
              } else if (e.key === 'Escape') {
                setSearchText(appliedQuery);
                e.currentTarget.blur();
              }
            }}
            enterKeyHint="search"
            placeholder="Search  /"
            aria-label="Search notes"
            className="flex-1 min-w-0 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-sm placeholder:text-foreground/40 focus:outline-none focus:border-blue-400/70"
          />
        }
      >
        {() => (
          <div className="space-y-2">
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

            {notes.length === 0 && failures.length === 0 && (
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
                      href={`${projectPagePath(note.projectId)}?tab=pinboard`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-blue-400/80 active:text-blue-300"
                    >
                      {note.projectId}
                    </Link>
                  }
                  expanded={expandedKey === key}
                  highlighted={index === highlighted}
                  onToggle={() => {
                    setHighlightedKey(key);
                    setExpandedKey(expandedKey === key ? null : key);
                  }}
                  actionsDisabled={!actionsReady}
                  onClaude={() => setClaudeNote(note)}
                  onEdit={() => setEditing(note)}
                  onDelete={() => setDeleting(note)}
                />
              );
            })}
          </div>
        )}
      </OfflineFirstPage>

      {editing !== null && (
        <PinboardNoteModal
          projectId={editing.projectId}
          initialText={editing.text}
          onSave={(text) => editNote(editing, text)}
          onClose={() => setEditing(null)}
        />
      )}

      {claudeNote !== null && (
        <NewSessionModal
          projectId={claudeNote.projectId}
          canonicalId={claudeNote.projectId}
          initialPrompt={claudeNote.text}
          onClose={() => setClaudeNote(null)}
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
    </>
  );
}
