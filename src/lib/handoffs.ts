import { readdirSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Handoffs `claudex handoff` parked instead of launching, because the user was away from the
 * desktop when the session tried to hand its task over. One file per handoff — a project can
 * be handed several — written by claudex and consumed here, the way gg parks a commit message
 * it could not put a review overlay in front of.
 */
const PENDING_HANDOFFS_DIR = join(
  homedir(),
  '.local/share/gitmob/pending-handoffs'
);

export interface PendingHandoff {
  id: string;
  projectId: string;
  directory: string;
  prompt: string;
  createdAt: string;
}

interface HandoffFile {
  project_id: string;
  directory: string;
  prompt: string;
  timestamp: string;
}

/** The id is a filename, and it arrives from the browser. */
export function isHandoffId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]+$/.test(value);
}

function handoffPath(id: string): string {
  if (!isHandoffId(id)) {
    throw new Error(`Unexpected handoff id: ${id}`);
  }
  return join(PENDING_HANDOFFS_DIR, `${id}.json`);
}

function readHandoffFile(id: string): PendingHandoff {
  const data: HandoffFile = JSON.parse(readFileSync(handoffPath(id), 'utf-8'));
  return {
    id,
    projectId: data.project_id,
    directory: data.directory,
    prompt: data.prompt,
    createdAt: data.timestamp,
  };
}

function handoffIds(): string[] {
  if (!existsSync(PENDING_HANDOFFS_DIR)) return [];
  return readdirSync(PENDING_HANDOFFS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length));
}

/**
 * Every parked handoff, oldest first: the front page announces them all together, and the one
 * waiting longest is the one to pick up.
 */
export function listPendingHandoffs(): PendingHandoff[] {
  return handoffIds()
    .map(readHandoffFile)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function readPendingHandoff(id: string): PendingHandoff | null {
  if (!existsSync(handoffPath(id))) return null;
  return readHandoffFile(id);
}

export function deletePendingHandoff(id: string): void {
  const path = handoffPath(id);
  if (existsSync(path)) unlinkSync(path);
}
