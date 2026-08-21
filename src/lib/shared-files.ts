import { mkdirSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, sep } from 'path';

export const SHARED_FILES_DIR =
  process.env.GITMOB_FILES_DIR ?? join(homedir(), 'gitmob');

export interface SharedFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

/** Absolute path for a path relative to the shared folder, or null if it escapes it. */
export function resolveSharedPath(relativePath: string): string | null {
  const full = resolve(SHARED_FILES_DIR, relativePath);
  if (full !== SHARED_FILES_DIR && !full.startsWith(SHARED_FILES_DIR + sep)) {
    return null;
  }
  return full;
}

export function listSharedFiles(relativePath: string): SharedFile[] {
  const dir = resolveSharedPath(relativePath);
  if (dir === null) throw new Error(`Path escapes the shared folder`);

  mkdirSync(dir, { recursive: true });

  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      const stat = statSync(join(dir, entry.name), { throwIfNoEntry: false });
      return {
        name: entry.name,
        path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
        isDirectory: entry.isDirectory(),
        size: stat?.size ?? 0,
        modified: stat?.mtimeMs ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
