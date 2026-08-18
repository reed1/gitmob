'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '../../../lib/api';
import { useAutoRefresh } from '../../../lib/use-auto-refresh';

interface Note {
  id: number;
  text: string;
  createdAt?: string;
  editedAt?: string;
}

export function PinboardView({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [modalText, setModalText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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

  const openAddModal = () => {
    setModalMode('add');
    setModalText('');
    setEditingNoteId(null);
  };

  const openEditModal = (note: Note) => {
    setModalMode('edit');
    setModalText(note.text);
    setEditingNoteId(note.id);
    setExpandedId(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setModalText('');
    setEditingNoteId(null);
  };

  const mutate = async (body: Record<string, unknown>) => {
    const res = await apiFetch(`/api/projects/${projectId}/pinboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setNotes(data.notes);
    return true;
  };

  const handleModalSave = async () => {
    if (!modalText.trim()) return;

    if (modalMode === 'add') {
      if (await mutate({ action: 'add', text: modalText.trim() })) closeModal();
    } else if (modalMode === 'edit' && editingNoteId !== null) {
      const saved = await mutate({
        action: 'edit',
        noteId: editingNoteId,
        text: modalText.trim(),
      });
      if (saved) closeModal();
    } else {
      throw new Error(`Unexpected modalMode: ${modalMode}`);
    }
  };

  const deleteNote = async (noteId: number) => {
    if (await mutate({ action: 'delete', noteId })) {
      setDeleteConfirmId(null);
      setExpandedId(null);
    }
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
            onClick={openAddModal}
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
          <div
            key={note.id}
            className="text-sm bg-foreground/5 border border-foreground/10 rounded overflow-hidden"
          >
            <div
              className="flex gap-2 px-3 py-1.5 cursor-pointer"
              onClick={() =>
                setExpandedId(expandedId === note.id ? null : note.id)
              }
            >
              <span className="shrink-0 font-mono text-xs text-foreground/30 pt-0.5">
                {note.id}
              </span>
              <span
                className={
                  expandedId === note.id
                    ? 'flex-1 min-w-0 whitespace-pre-wrap break-words'
                    : 'flex-1 min-w-0 truncate'
                }
              >
                {note.text}
              </span>
            </div>
            {expandedId === note.id && (
              <div className="flex justify-end gap-2 px-3 py-2 border-t border-foreground/10">
                <button
                  onClick={() => openEditModal(note)}
                  className="px-3 py-1 text-xs bg-foreground/10 hover:bg-foreground/20 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirmId(note.id)}
                  className="px-3 py-1 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}

        {notes.length === 0 && (
          <div className="text-center text-foreground/50 py-8">No notes</div>
        )}
      </div>

      {modalMode !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground/20 rounded-lg p-4 w-80 max-w-[90vw]">
            <textarea
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeModal();
              }}
              placeholder="Note text..."
              rows={5}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded mb-3 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 text-sm text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSave}
                disabled={!modalText.trim()}
                className="px-3 py-1.5 text-sm bg-foreground text-background rounded disabled:opacity-30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground/20 rounded-lg p-4 w-80 max-w-[90vw]">
            <p className="text-sm mb-4">
              Are you sure you want to delete this note?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-sm text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteNote(deleteConfirmId)}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
