'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addToast, apiFetch } from '@/lib/api';
import { relativeTime } from '@/lib/relative-time';
import { saveTextHistory } from '@/lib/text-history';
import { useLoad } from '@/lib/use-load';
import { useOutsideClick } from '@/lib/use-outside-click';
import { CollapsedRows } from './CollapsedRows';
import { Modal } from './Modal';
import { SpeakButton } from './SpeakButton';
import type { PendingEdit } from '@/lib/remote-edits';

function editLabel(edit: PendingEdit): string {
  return (
    edit.projectId ?? (edit.cwd.split('/').filter(Boolean).pop() || edit.cwd)
  );
}

/**
 * The input boxes `claudex edit-remote` handed here from the desk. Each session's external
 * editor stays open until its text goes back from here; one whose window was closed meanwhile
 * drops off this list the next time the front page loads.
 */
export function PendingEdits({ hidden }: { hidden: boolean }) {
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchEdits = useCallback(async () => {
    const res = await fetch('/api/remote-edits');
    if (!res.ok) return;
    const data: { edits: PendingEdit[] } = await res.json();
    setEdits(data.edits);
  }, []);

  useLoad(fetchEdits);

  const open = edits.find((edit) => edit.id === openId) ?? null;

  if (edits.length === 0 || hidden) return null;

  return (
    <>
      <section>
        <h2 className="text-sm font-medium text-sky-400 mb-2">
          Input to Edit
          <span className="ml-1.5 text-sky-400/60">{edits.length}</span>
        </h2>
        <CollapsedRows
          items={edits}
          toggleClassName="text-sky-400/80"
          renderItem={(edit) => (
            <button
              key={edit.id}
              onClick={() => setOpenId(edit.id)}
              className="w-full text-left p-3 rounded-lg border border-sky-500/40 bg-sky-500/10 active:opacity-80"
            >
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <span className="font-medium text-sky-400">
                  {editLabel(edit)}
                </span>
                <span>{relativeTime(edit.createdAt)}</span>
              </div>
              <div
                className={`mt-1 text-sm line-clamp-2 whitespace-pre-wrap ${
                  edit.text ? '' : 'italic text-foreground/40'
                }`}
              >
                {edit.text || 'Empty input'}
              </div>
            </button>
          )}
        />
      </section>

      {open && (
        <RemoteEditModal
          key={open.id}
          pending={open}
          onClose={() => setOpenId(null)}
          onReplied={() => {
            setOpenId(null);
            setEdits((current) =>
              current.filter((edit) => edit.id !== open.id)
            );
          }}
        />
      )}
    </>
  );
}

/** Submit is the usual way out; Save, behind the chevron, leaves the text in the box unsent. */
export function RemoteEditModal({
  pending,
  onClose,
  onReplied,
}: {
  pending: PendingEdit;
  onClose: () => void;
  onReplied: () => void;
}) {
  const [text, setText] = useState(pending.text);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  useOutsideClick(menuOpen, splitRef, () => setMenuOpen(false));

  // A prefilled textarea keeps its caret at the start, and Speak inserts at the caret: dictation
  // carries on from the end of what was already typed instead.
  useEffect(() => {
    const textarea = textareaRef.current!;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  const send = async (submit: boolean) => {
    setMenuOpen(false);
    saveTextHistory({
      text,
      source: 'Edit input',
      projectId: pending.projectId ?? undefined,
    });
    setSending(true);
    try {
      const res = await apiFetch('/api/remote-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pending.id, text, submit }),
      });
      if (!res.ok) return;
      addToast(submit ? 'Submitted' : 'Saved', 'success');
      onReplied();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      heading="Edit input"
      subtitle={editLabel(pending)}
      onClose={onClose}
      guardDismiss={text !== pending.text}
    >
      <div className="px-4 py-3 space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="The session's input box"
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <SpeakButton
            projectId={pending.canonicalProjectId ?? 'global'}
            textareaRef={textareaRef}
            onChange={setText}
          />
          <div className="flex gap-2">
            <button
              data-modal-cancel
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Cancel
            </button>
            <div ref={splitRef} className="relative flex">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                disabled={sending}
                aria-label="More ways to send"
                className="pl-2 pr-1.5 py-1.5 rounded-l-lg bg-foreground text-background border-r border-background/25 hover:opacity-90 disabled:opacity-40"
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
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <button
                onClick={() => send(true)}
                disabled={sending || !text.trim()}
                className="px-3 py-1.5 text-sm rounded-r-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
              >
                {sending ? 'Sending...' : 'Submit'}
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-full mb-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={() => send(false)}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 whitespace-nowrap"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
