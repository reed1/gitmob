'use client';

import { KebabMenuItem } from './KebabMenu';

/** Whether a session starts with the project's agent Chrome as its `browser` MCP server. */
export function BrowserMenuItem({
  browser,
  onChange,
}: {
  browser: boolean;
  onChange: (browser: boolean) => void;
}) {
  return (
    <KebabMenuItem onSelect={() => onChange(!browser)}>
      <span
        className={`flex items-center gap-2 ${browser ? 'text-blue-500' : ''}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        Browser{browser ? ' ✓' : ''}
      </span>
    </KebabMenuItem>
  );
}
