'use client';

import { useState } from 'react';
import { relativeTime } from '@/lib/relative-time';
import type { RecallMessage } from './RecallSearch';
import { TranscriptMarkdown } from './TranscriptMarkdown';

/** Without `foldAt` the message is shown whole. */
export function TranscriptMessage({
  message,
  foldAt,
}: {
  message: RecallMessage;
  foldAt?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const foldable = foldAt !== undefined && message.content.length > foldAt;
  const folded = foldable && !expanded;
  const fromUser = message.role === 'user';
  const text = folded
    ? `${message.content.slice(0, foldAt)}…`
    : message.content;

  return (
    <div
      className={`p-3 border rounded-lg ${
        fromUser
          ? 'bg-blue-500/10 border-blue-500/20'
          : 'bg-foreground/5 border-foreground/10'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-foreground/40">
          {message.role}
        </span>
        <span className="text-xs text-foreground/30 tabular-nums">
          {relativeTime(message.timestamp)}
        </span>
      </div>
      {/* Prompts are typed or dictated, where a stray asterisk is not meant as formatting. */}
      <div className="mt-1.5 text-sm break-words">
        {fromUser ? (
          <div className="whitespace-pre-wrap">{text}</div>
        ) : (
          <TranscriptMarkdown content={text} />
        )}
      </div>
      {foldable && (
        <button
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 text-xs text-blue-500 active:opacity-80"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
