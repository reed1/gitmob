'use client';

import { useState } from 'react';
import { addToast, apiFetch } from '../../../../../lib/api';
import {
  ARROW_KEY_ROWS,
  COMMAND_KEYS,
  type SpecialKey,
} from '../../../../../lib/desktop-keys';
import { Modal } from '../../../Modal';
import { SpeakButton, appendSpoken } from '../../../SpeakButton';

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
        <div className="flex items-center justify-between gap-2">
          <SpeakButton
            projectId={canonicalId}
            onText={(spoken) => setText((prev) => appendSpoken(prev, spoken))}
          />
          <div className="flex gap-2">
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
    await apiFetch(`/api/projects/${projectId}/desktop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windowId, action: 'key', key }),
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
