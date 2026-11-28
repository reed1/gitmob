'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useLoad } from '@/lib/use-load';
import { postcardImageUrl, type Postcard } from '@/lib/postcards';
import { postcardsUrl } from './PostcardStamp';

const THUMBNAIL_COUNT = 3;

export function postcardLabel(postcard: Postcard): string {
  return (
    postcard.projectId ??
    (postcard.cwd.split('/').filter(Boolean).pop() || postcard.cwd)
  );
}

/**
 * One line for the postcards the user has not opened yet, however many: they wait for a look,
 * not an answer, so they take less room than the parked work below. It leads to the Postcards
 * page, which marks them seen.
 */
export function NewPostcards({ hidden }: { hidden: boolean }) {
  const [unseen, setUnseen] = useState<Postcard[]>([]);

  const fetchPostcards = useCallback(async () => {
    const res = await fetch('/api/postcards');
    if (!res.ok) return;
    const data: { postcards: Postcard[] } = await res.json();
    setUnseen(data.postcards.filter((postcard) => !postcard.seen));
  }, []);

  useLoad(fetchPostcards);

  if (unseen.length === 0 || hidden) return null;

  const labels = [...new Set(unseen.map(postcardLabel))];

  return (
    <Link
      href={postcardsUrl()}
      className="flex items-center gap-3 p-2 pr-3 rounded-lg border border-rose-500/40 bg-rose-500/10 active:opacity-80"
    >
      <div className="flex -space-x-3 shrink-0">
        {unseen.slice(0, THUMBNAIL_COUNT).map((postcard) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={postcard.id}
            src={postcardImageUrl(postcard.id, postcard.images[0])}
            alt=""
            className="w-10 h-10 rounded object-cover border-2 border-background bg-foreground/10"
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-rose-400">
          {unseen.length === 1
            ? 'New postcard'
            : `${unseen.length} new postcards`}
        </div>
        <div className="text-xs text-foreground/50 truncate">
          {labels.join(', ')}
        </div>
      </div>
      <svg
        className="w-4 h-4 shrink-0 text-rose-400/60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </Link>
  );
}
