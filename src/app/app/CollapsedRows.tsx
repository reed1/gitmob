'use client';

import { ReactNode, useState } from 'react';

const COLLAPSED_COUNT = 2;

/**
 * Parked work sits above the project list, so a pile of it would push every project off the
 * screen. The oldest two stay in view — the ones waiting longest are the ones to answer — and
 * the rest wait behind one tap.
 */
export function CollapsedRows<T>({
  items,
  renderItem,
  toggleClassName,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  toggleClassName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = items.length - COLLAPSED_COUNT;
  const shown = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <div className="space-y-2">
      {shown.map(renderItem)}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium active:opacity-80 ${toggleClassName}`}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          <svg
            className={`w-3 h-3 ${expanded ? 'rotate-180' : ''}`}
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
      )}
    </div>
  );
}
