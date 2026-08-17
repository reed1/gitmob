import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse } from 'yaml';

const PINBOARD_DIR =
  process.env.PINBOARD_DIR ||
  join(homedir(), '.dotfiles/rlocal/app/rofi-vscode/pinboard-data');

export interface PinboardNote {
  id: number;
  text: string;
  createdAt?: string;
  editedAt?: string;
}

interface RawNote {
  id: number;
  text?: string;
  created_at?: string;
  edited_at?: string;
}

export function getPinboardNotes(projectId: string): PinboardNote[] {
  const file = join(PINBOARD_DIR, `${projectId}.yaml`);
  // A project that has never been pinned has no file, which is an empty board rather
  // than a failure.
  if (!existsSync(file)) return [];

  const data: { notes?: RawNote[] } = parse(readFileSync(file, 'utf-8')) ?? {};

  return (data.notes ?? [])
    .map((note) => ({
      id: note.id,
      text: note.text ?? '',
      createdAt: note.created_at,
      editedAt: note.edited_at,
    }))
    .sort((a, b) => a.id - b.id);
}
