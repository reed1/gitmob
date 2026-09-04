/**
 * What a session can be sent from the client: the keys `claudex desktop keys` accepts, grouped
 * the way the Send Keys modal shows them, and the slash commands both session menus list. Its
 * own module because those are client components and `desktop.ts` reaches for child_process.
 */
export const COMMON_COMMANDS = ['/commit', '/exit'] as const;

export type CommonCommand = (typeof COMMON_COMMANDS)[number];

export function isCommonCommand(value: unknown): value is CommonCommand {
  return COMMON_COMMANDS.some((command) => command === value);
}

export const COMMAND_KEYS = [
  { key: 'enter', label: 'Enter' },
  { key: 'esc', label: 'Esc' },
  { key: 'double-esc', label: 'Double Esc' },
  { key: 'tab', label: 'Tab' },
  { key: 'shift-tab', label: 'Shift+Tab' },
  { key: 'ctrl-c', label: 'Ctrl+C' },
  { key: 'ctrl-d', label: 'Ctrl+D' },
  { key: 'ctrl-l', label: 'Ctrl+L' },
  { key: 'ctrl-u', label: 'Ctrl+U' },
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

export const SPECIAL_KEYS = [...COMMAND_KEYS, ...ARROW_KEY_ROWS.flat()];

export type SpecialKey = (typeof SPECIAL_KEYS)[number]['key'];

export function isSpecialKey(value: unknown): value is SpecialKey {
  return SPECIAL_KEYS.some((entry) => entry.key === value);
}
