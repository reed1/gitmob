/**
 * The keys `claudex desktop keys` accepts, in the order the Send Keys modal shows them.
 * Its own module because the modal is a client component and `desktop.ts` reaches for
 * child_process.
 */
export const SPECIAL_KEYS = [
  { key: 'enter', label: 'Enter' },
  { key: 'esc', label: 'Esc' },
  { key: 'double-esc', label: 'Double Esc' },
  { key: 'tab', label: 'Tab' },
  { key: 'shift-tab', label: 'Shift+Tab' },
  { key: 'up', label: 'Up' },
  { key: 'down', label: 'Down' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'ctrl-c', label: 'Ctrl+C' },
  { key: 'ctrl-d', label: 'Ctrl+D' },
] as const;

export type SpecialKey = (typeof SPECIAL_KEYS)[number]['key'];

export function isSpecialKey(value: unknown): value is SpecialKey {
  return SPECIAL_KEYS.some((entry) => entry.key === value);
}
