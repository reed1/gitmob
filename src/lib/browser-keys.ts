/**
 * The keys `claude-in-chrome cdp key` accepts, grouped the way the Browser page shows them.
 * Its own module because that page is a client component and `browser.ts` reaches for
 * child_process — the same split `desktop-keys.ts` makes for the same reason.
 *
 * Everything a phone's own keyboard already produces is typed as text instead, so only the
 * keys it has no way to send are here.
 */
export const COMMAND_KEYS = [
  { key: 'enter', label: 'Enter' },
  { key: 'tab', label: 'Tab' },
  { key: 'escape', label: 'Esc' },
  { key: 'backspace', label: '⌫' },
  { key: 'pageup', label: 'PgUp' },
  { key: 'pagedown', label: 'PgDn' },
] as const;

/** Arrows sit where they do on a keyboard: Up alone, then Left/Down/Right beneath it. */
export const ARROW_KEY_ROWS = [
  [{ key: 'up', label: '↑' }],
  [
    { key: 'left', label: '←' },
    { key: 'down', label: '↓' },
    { key: 'right', label: '→' },
  ],
] as const;

export const BROWSER_KEYS = [...COMMAND_KEYS, ...ARROW_KEY_ROWS.flat()];

export type BrowserKey = (typeof BROWSER_KEYS)[number]['key'];

export function isBrowserKey(value: unknown): value is BrowserKey {
  return BROWSER_KEYS.some((entry) => entry.key === value);
}
