'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { addToast, apiFetch } from '../../../lib/api';
import {
  ARROW_KEY_ROWS,
  COMMAND_KEYS,
  type SpecialKey,
} from '../../../lib/desktop-keys';

function Modal({
  heading,
  subtitle,
  onClose,
  children,
}: {
  heading: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full max-h-full overflow-y-auto">
          <div className="px-4 py-3 border-b border-foreground/10">
            <h3 className="font-medium">{heading}</h3>
            <div className="text-xs text-foreground/50 truncate">
              {subtitle}
            </div>
          </div>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

export function SendTextModal({
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
  const [text, setText] = useState('');
  const [pressEnter, setPressEnter] = useState(true);

  const send = async () => {
    if (!text) return;
    onClose();

    const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId, action: 'type', text, pressEnter }),
    });
    if (res.ok) addToast('Sent text', 'success');
  };

  return (
    <Modal heading="Send text" subtitle={title} onClose={onClose}>
      <div className="px-4 py-3 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Text to type into the session"
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-y"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pressEnter}
            onChange={(e) => setPressEnter(e.target.checked)}
            className="w-4 h-4"
          />
          Press Enter afterwards
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!text}
            className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
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
  const pressKey = async (key: SpecialKey, label: string) => {
    const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId, action: 'key', key }),
    });
    if (res.ok) addToast(`Pressed ${label}`, 'success');
  };

  const keyButton = (key: SpecialKey, label: string) => (
    <button
      key={key}
      onClick={() => pressKey(key, label)}
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
          {ARROW_KEY_ROWS.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              {row.length === 1 && <div />}
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
