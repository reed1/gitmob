'use client';

import { saveTextHistory } from '@/lib/text-history';

import { useRef, useState } from 'react';
import { addToast, apiFetch } from '@/lib/api';
import {
  NAVIGATION_KEY_ROWS,
  COMMAND_KEYS,
  type SpecialKey,
} from '@/lib/desktop-keys';
import { Modal } from '@/app/app/Modal';
import { SpeakButton } from '@/app/app/SpeakButton';
import { KebabMenu } from '@/app/app/KebabMenu';
import {
  ImageUploadMenuItem,
  ImageUploads,
  useImageUploads,
  withImagePaths,
} from '@/app/app/ImageUploads';
import { projectApiPath } from '@/lib/project-paths';

export function SendTextModal({
  projectId,
  canonicalId,
  windowId,
  title,
  onClose,
}: {
  projectId: string;
  canonicalId: string;
  windowId: string;
  title: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pressEnter, setPressEnter] = useState(true);
  const uploads = useImageUploads();
  const canSend = Boolean(text || uploads.images.length) && !uploads.pending;

  const send = async () => {
    if (!canSend) return;
    if (text) saveTextHistory({ text, source: 'Send text', projectId });
    onClose();

    const res = await apiFetch(`${projectApiPath(projectId)}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        windowId,
        action: 'type',
        text: withImagePaths(uploads.images, text),
        pressEnter,
      }),
    });
    if (res.ok) addToast('Sent', 'success');
  };

  return (
    <Modal
      heading="Send text"
      subtitle={title}
      onClose={onClose}
      guardDismiss={uploads.images.length > 0}
      menu={
        <KebabMenu label="Send options">
          <ImageUploadMenuItem uploads={uploads} />
        </KebabMenu>
      }
    >
      <div className="px-4 py-3 space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Text to type into the session"
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-none"
        />
        <ImageUploads uploads={uploads} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pressEnter}
            onChange={(e) => setPressEnter(e.target.checked)}
            className="w-4 h-4"
          />
          Press Enter afterwards
        </label>
        <div className="flex items-center justify-between gap-2">
          <SpeakButton
            projectId={canonicalId}
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
            <button
              onClick={send}
              disabled={!canSend}
              className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function SendKeysModal({
  projectId,
  windowId,
  title,
  onClose,
}: {
  projectId: string;
  windowId: string;
  title: string;
  onClose: () => void;
}) {
  // The modal stays open on a key press: answering a dialog is usually Down, Down, Enter.
  // Only failures are worth a toast; apiFetch raises those on its own.
  const pressKey = async (key: SpecialKey) => {
    await apiFetch(`${projectApiPath(projectId)}/desktop/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId, key }),
    });
  };

  const keyButton = (key: SpecialKey, label: string) => (
    <button
      key={key}
      onClick={() => pressKey(key)}
      className="px-2 py-2 text-xs font-mono rounded-lg bg-foreground/10 border border-foreground/15 active:bg-foreground/20"
    >
      {label}
    </button>
  );

  return (
    <Modal heading="Send keys" subtitle={title} onClose={onClose}>
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {COMMAND_KEYS.map(({ key, label }) => keyButton(key, label))}
        </div>
        <div className="space-y-2">
          {NAVIGATION_KEY_ROWS.map((row, i) => (
            <div
              key={i}
              className={`grid gap-2 ${row.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
            >
              {row.map(({ key, label }) => keyButton(key, label))}
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
