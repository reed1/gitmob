'use client';

import { useState, useCallback } from 'react';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';
import {
  PinboardDeleteConfirm,
  PinboardNoteCard,
  PinboardNoteModal,
  mutatePinboard,
  type PinboardNote,
} from '../../../../../components/PinboardNote';

export function PinboardView({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<PinboardNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingNote, setEditingNote] = useState<PinboardNote | null>(null);
  const [deleting, setDeleting] = useState<PinboardNote | null>(null);

  const fetchNotes = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/pinboard`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load the pinboard');
    } else {
      setError(null);
      setNotes(data.notes);
    }
    setLoading(false);
  }, [projectId]);

  useAutoRefresh(fetchNotes);

  const closeModal = () => {
    setModalMode(null);
    setEditingNote(null);
  };

  const handleModalSave = async (text: string) => {
    if (!text) return;

    let board: PinboardNote[] | null;
    if (modalMode === 'add') {
      board = await mutatePinboard(projectId, { action: 'add', text });
    } else if (modalMode === 'edit' && editingNote !== null) {
      board = await mutatePinboard(projectId, {
        action: 'edit',
        noteId: editingNote.id,
        text,
      });
    } else {
      throw new Error(`Unexpected modalMode: ${modalMode}`);
    }

    if (board === null) return;
    setNotes(board);
    closeModal();
  };

  const deleteNote = async (note: PinboardNote) => {
    const board = await mutatePinboard(projectId, {
      action: 'delete',
      noteId: note.id,
    });
    if (board === null) return;

    setNotes(board);
    setDeleting(null);
    setExpandedId(null);
  };

  if (loading) {
    return <div className="p-4 text-center text-foreground/50">Loading...</div>;
  }

  if (error !== null) {
    return (
      <div className="p-4 text-sm text-red-500 whitespace-pre-wrap break-words">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-2">
        <div className="flex justify-end">
          <button
            onClick={() => setModalMode('add')}
            className="p-1 text-foreground/50 hover:text-foreground"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {notes.map((note) => (
          <PinboardNoteCard
            key={note.id}
            note={note}
            label={
              <span className="font-mono text-foreground/30">{note.id}</span>
            }
            expanded={expandedId === note.id}
            onToggle={() =>
              setExpandedId(expandedId === note.id ? null : note.id)
            }
            onEdit={() => {
              setModalMode('edit');
              setEditingNote(note);
              setExpandedId(null);
            }}
            onDelete={() => setDeleting(note)}
          />
        ))}

        {notes.length === 0 && (
          <div className="text-center text-foreground/50 py-8">No notes</div>
        )}
      </div>

      {modalMode !== null && (
        <PinboardNoteModal
          projectId={projectId}
          initialText={editingNote?.text ?? ''}
          onSave={handleModalSave}
          onClose={closeModal}
        />
      )}

      {deleting !== null && (
        <PinboardDeleteConfirm
          projectId={projectId}
          text={deleting.text}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteNote(deleting)}
        />
      )}
    </div>
  );
}
