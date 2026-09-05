'use client';

import { useState, type ReactNode } from 'react';
import { addToast, apiFetch } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { SpeakButton, appendSpoken } from '../app/app/SpeakButton';

/** One note as both PWAs read it back: `rv` sends null, not an absent key, for a missing stamp. */
export interface PinboardNote {
  id: number;
  text: string;
  createdAt: string | null;
  editedAt: string | null;
}

/** Every write goes to the project's board and answers with the board it left behind. */
export async function mutatePinboard(
  projectId: string,
  body: Record<string, unknown>
): Promise<PinboardNote[] | null> {
  const res = await apiFetch(`/api/projects/${projectId}/pinboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.notes;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function formatAge(note: PinboardNote): string {
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

const ACTION_CLASS =
  'px-3 py-1 text-xs bg-foreground/10 hover:bg-foreground/20 active:bg-foreground/20 rounded';

/**
 * Three lines and a tap target. Expanding is what un-clamps the text *and* uncovers the
 * actions, so every note has a chevron whether or not it overflows — a one-line note is
 * still one that gets copied, edited or thrown away.
 *
 * `label` is what the card is filed under: the project on the overview, the note id on a
 * project's own board. It sits inside the toggle, so a link in it stops its own click.
 */
export function PinboardNoteCard({
  note,
  label,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  note: PinboardNote;
  label: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const copy = async () => {
    if (await copyText(note.text)) addToast('Copied the note', 'success');
    else addToast('Could not copy to the clipboard');
  };

  return (
    <div className="bg-foreground/5 border border-foreground/10 rounded-lg overflow-hidden">
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2 px-3 pt-2 text-xs">
          <div className="min-w-0 truncate">{label}</div>
          <span className="flex-1 text-right text-stone-400/55 whitespace-nowrap">
            {formatAge(note)}
          </span>
          <svg
            className={`w-4 h-4 shrink-0 text-foreground/30 transition-transform ${
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
        </div>
        <div
          className={`px-3 pb-2.5 pt-1 text-sm whitespace-pre-wrap break-words ${
            expanded ? '' : COLLAPSED_LINES
          }`}
        >
          {note.text}
        </div>
      </div>

      {expanded && (
        <div className="flex justify-end gap-2 px-3 py-2 border-t border-foreground/10">
          <button onClick={copy} className={ACTION_CLASS}>
            Copy
          </button>
          <button onClick={onEdit} className={ACTION_CLASS}>
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 active:bg-red-500/20 rounded"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-foreground/20 rounded-lg p-4 w-80 max-w-full">
        {children}
      </div>
    </div>
  );
}

/** Writing a note, new or already pinned — the same box either way, dictation included. */
export function PinboardNoteModal({
  projectId,
  initialText,
  onSave,
  onClose,
}: {
  projectId: string;
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);

  return (
    <Overlay>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Note text..."
        rows={5}
        autoCapitalize="off"
        autoCorrect="off"
        className="w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded mb-3 resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <SpeakButton
          projectId={projectId}
          onText={(spoken) => setText((prev) => appendSpoken(prev, spoken))}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-foreground/70 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(text.trim())}
            disabled={!text.trim()}
            className="px-3 py-1.5 text-sm bg-foreground text-background rounded disabled:opacity-30"
          >
            Save
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function PinboardDeleteConfirm({
  projectId,
  text,
  onCancel,
  onConfirm,
}: {
  projectId: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay>
      <p className="text-sm mb-1">
        Delete this note from{' '}
        <span className="font-mono text-blue-400">{projectId}</span>?
      </p>
      <p className="text-xs text-foreground/50 mb-4 line-clamp-3 break-words">
        {text}
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-foreground/70 hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-sm bg-red-500 text-white rounded active:opacity-80"
        >
          Delete
        </button>
      </div>
    </Overlay>
  );
}
