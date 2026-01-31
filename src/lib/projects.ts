import { readdirSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS_DIR =
  process.env.PROJECTS_DIR ||
  join(homedir(), '.dotfiles/rlocal/app/rofi-vscode/projects');

export interface Project {
  id: string;
  path: string;
  tags?: string[];
  repo?: string;
  urls?: Record<string, string>;
}

export function getProjects(): Project[] {
  const files = readdirSync(PROJECTS_DIR).filter(
    (f) => f.endsWith('.yaml') || f.endsWith('.yml')
  );

  return files.map((file) => {
    const content = readFileSync(join(PROJECTS_DIR, file), 'utf-8');
    const data = parse(content) || {};
    const id = file.replace(/\.ya?ml$/, '');
    const path = data.path?.replace(/^~/, homedir()) || '';

    return {
      id,
      path,
      tags: data.tags,
      repo: data.repo,
      urls: data.urls,
    };
  });
}

export function getProject(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}

export function expandPath(path: string): string {
  return path.replace(/^~/, homedir());
}
