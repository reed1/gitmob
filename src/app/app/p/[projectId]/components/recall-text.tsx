import type { ReactNode } from 'react';

/** Characters of the message kept either side of the first match, so a row stays one glance. */
const LEADING = 80;
const TRAILING = 180;

function terms(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}

function escapeForRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstMatch(content: string, query: string): number {
  const haystack = content.toLowerCase();
  const found = terms(query)
    .map((term) => haystack.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0);
  return found.length ? Math.min(...found) : -1;
}

/**
 * The part of a message worth showing in a result row: the window around the first term that
 * matched. A clamp on the whole message would hide the match under everything above it.
 */
export function snippetAround(content: string, query: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  const match = firstMatch(collapsed, query);
  const start = match < 0 ? 0 : Math.max(0, match - LEADING);
  const end = match < 0 ? LEADING + TRAILING : match + TRAILING;

  return (
    (start > 0 ? '…' : '') +
    collapsed.slice(start, end) +
    (end < collapsed.length ? '…' : '')
  );
}

/** Marks the search terms in a snippet, so the eye lands where the match is. */
export function highlight(text: string, query: string): ReactNode {
  const words = terms(query).map(escapeForRegex);
  if (words.length === 0) return text;

  // Split keeps the captured terms as their own parts; a separate anchored test says which
  // parts those are, since a /g/ regex carries its lastIndex between calls.
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'));
  const isTerm = new RegExp(`^(?:${words.join('|')})$`, 'i');

  return parts.map((part, index) =>
    isTerm.test(part) ? (
      <mark key={index} className="bg-amber-500/30 text-foreground rounded">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}
