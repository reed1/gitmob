'use client';

import { useState, useEffect } from 'react';

interface Note {
  id: number;
  text: string;
  createdAt?: string;
  editedAt?: string;
}

export function PinboardView({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/pinboard`);
      const data = await res.json();
      setNotes(data.notes || []);
      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) {
    return <div className="p-4 text-center text-foreground/50">Loading...</div>;
  }

  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-foreground/50 py-8">No notes</div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
          className="flex gap-2 px-3 py-1.5 text-sm bg-foreground/5 border border-foreground/10 rounded cursor-pointer"
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
      ))}
    </div>
  );
}
