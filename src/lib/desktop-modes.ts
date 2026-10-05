/** Mode IDs and labels accepted by the desktop launcher. */
export const DESKTOP_MODES = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'edit', label: 'Edit' },
  { mode: 'yolo', label: 'Yolo' },
  { mode: 'codex', label: 'Codex' },
] as const;

export type DesktopMode = (typeof DESKTOP_MODES)[number]['mode'];

export const DEFAULT_DESKTOP_MODE: DesktopMode = 'yolo';

export function isDesktopMode(value: unknown): value is DesktopMode {
  return DESKTOP_MODES.some((entry) => entry.mode === value);
}
