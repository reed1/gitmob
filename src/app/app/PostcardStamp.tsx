'use client';

import Link from 'next/link';
import type { SessionPostcards } from '@/lib/postcards';

export function postcardsUrl(sessionId?: string): string {
  return sessionId
    ? `/app/postcards?session=${encodeURIComponent(sessionId)}`
    : '/app/postcards';
}

/**
 * A postage stamp: a dashed white perforation inside a rose ring. It stands beside the "?" block
 * in a session's header while the session has sent postcards, carrying how many are unseen.
 */
export function PostcardStamp({
  sessionId,
  postcards,
}: {
  sessionId: string;
  postcards: SessionPostcards;
}) {
  return (
    <Link
      href={postcardsUrl(sessionId)}
      aria-label={`The session's postcards, ${postcards.unseen} new`}
      className="relative shrink-0 w-9 h-9 flex items-center justify-center rounded-[3px] bg-rose-500 border-2 border-dashed border-white/80 ring-2 ring-rose-500 text-white shadow-sm active:translate-y-0.5 transition-transform"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <circle cx="14" cy="6" r="2.25" />
        <path d="M1.5 17.5l5.5-8 3.75 5 2.5-3 5.25 6z" />
      </svg>
      {postcards.unseen > 0 && (
        <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">
          {postcards.unseen}
        </span>
      )}
    </Link>
  );
}
