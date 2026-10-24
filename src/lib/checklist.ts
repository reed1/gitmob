import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { CHECKLIST_NAME, type Checklist } from './checklist-name';

/**
 * Every list is `checklists/<name>.json` in this repository, holding `{ "items": [...] }`, and
 * saving commits that directory alone.
 */
const REPO_DIR = process.cwd();
const CHECKLISTS_DIR = join(REPO_DIR, 'checklists');

function listNames(): string[] {
  return readdirSync(CHECKLISTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

export function readChecklists(): Checklist[] {
  return listNames().map((name) => ({
    name,
    items: JSON.parse(
      readFileSync(join(CHECKLISTS_DIR, `${name}.json`), 'utf-8')
    ).items,
  }));
}

export function isChecklists(value: unknown): value is Checklist[] {
  if (!Array.isArray(value)) return false;
  const names = value.map((list) => list?.name);
  return (
    new Set(names).size === names.length &&
    value.every(
      (list) =>
        typeof list.name === 'string' &&
        CHECKLIST_NAME.test(list.name) &&
        Array.isArray(list.items) &&
        list.items.every((item: unknown) => typeof item === 'string')
    )
  );
}

/**
 * Writes every list, removes the file of each one gone — deleted or renamed — and commits. The
 * pathspec keeps the commit to `checklists/`, whatever else is staged in the repository. Nothing is
 * committed when nothing changed.
 */
export async function saveChecklists(checklists: Checklist[]): Promise<void> {
  const kept = new Set(checklists.map((list) => list.name));
  for (const name of listNames()) {
    if (!kept.has(name)) unlinkSync(join(CHECKLISTS_DIR, `${name}.json`));
  }
  for (const { name, items } of checklists) {
    writeFileSync(
      join(CHECKLISTS_DIR, `${name}.json`),
      JSON.stringify({ items }, null, 2) + '\n'
    );
  }

  const git = simpleGit(REPO_DIR);
  await git.add(['-A', '--', 'checklists']);
  const changed = (
    await git.diff(['--cached', '--name-only', '--', 'checklists'])
  ).trim();
  if (changed === '') return;

  const names = changed
    .split('\n')
    .map((path) => path.replace(/^checklists\//, '').replace(/\.json$/, ''));
  await git.commit(`Update checklists: ${names.join(', ')}`, [
    '--',
    'checklists',
  ]);
}
