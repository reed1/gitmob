/**
 * The `claudex kitty --mode` values a session can be launched under. Its own module because
 * the launch buttons are client components and `desktop.ts` reaches for child_process.
 */
export const CLAUDE_MODES = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'edit', label: 'Edit' },
  { mode: 'yolo', label: 'Yolo' },
] as const;

export type ClaudeMode = (typeof CLAUDE_MODES)[number]['mode'];

export const DEFAULT_CLAUDE_MODE: ClaudeMode = 'yolo';

export function isClaudeMode(value: unknown): value is ClaudeMode {
  return CLAUDE_MODES.some((entry) => entry.mode === value);
}
