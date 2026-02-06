import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS_FILE =
  process.env.PROJECTS_FILE ||
  join(homedir(), '.cache/rlocal/rofi-vscode/projects.generated.json');

export interface Project {
  id: string;
  path: string;
  tags?: string[];
  repo?: string;
  urls?: Record<string, string>;
  cmd?: Record<
    string,
    | string
    | string[]
    | {
        run: string | string[];
        infrastructure?: boolean;
        run_in_terminal?: boolean;
      }
  >;
}

export function getProjects(): Project[] {
  const data = JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));

  return Object.entries(data).map(([id, raw]: [string, any]) => ({
    id,
    path: raw.path?.replace(/^~/, homedir()) || '',
    tags: raw.tags,
    repo: raw.repo,
    urls: raw.urls,
    cmd: raw.cmd,
  }));
}

export function getProject(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}

export function expandPath(path: string): string {
  return path.replace(/^~/, homedir());
}
