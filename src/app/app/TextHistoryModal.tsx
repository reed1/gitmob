'use client';

import { useState } from 'react';
import { addToast } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { readTextHistory, type TextHistoryEntry } from '@/lib/text-history';
import { Modal } from './Modal';

export function TextHistoryModal({ onClose }: { onClose: () => void }) {
  const [{ entries, error }] = useState(() => {
    try {
      return { entries: readTextHistory(), error: null };
    } catch {
      return {
        entries: [] as TextHistoryEntry[],
        error: 'Could not read text history on this device.',
      };
    }
  });

  const copy = async (text: string) => {
    if (await copyText(text)) addToast('Copied text', 'success');
    else addToast('Could not copy to the clipboard');
  };

  return (
    <Modal
      heading="Text history"
      subtitle="Last 30 entries on this device"
      onClose={onClose}
    >
      <div className="p-4 space-y-3">
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        {!error && entries.length === 0 && (
          <p className="text-sm text-foreground/50">No submitted text yet.</p>
        )}
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="border border-foreground/15 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-xs text-foreground/60 break-words">
                <div className="font-medium text-foreground">
                  {entry.source}
                </div>
                {entry.projectId && <div>{entry.projectId}</div>}
                <time dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
              <button
                onClick={() => copy(entry.text)}
                className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-foreground/10 hover:bg-foreground/20"
              >
                Copy
              </button>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer">
                <span className="whitespace-pre-wrap break-words">
                  {entry.text.length > 160
                    ? `${entry.text.slice(0, 160)}…`
                    : entry.text}
                </span>
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans">
                {entry.text}
              </pre>
            </details>
          </article>
        ))}
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
