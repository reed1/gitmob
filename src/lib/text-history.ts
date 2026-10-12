'use client';

import { addToast } from './api';

const STORAGE_KEY = 'gitmob:text-history';
const HISTORY_LIMIT = 30;

export interface TextHistoryEntry {
  id: string;
  createdAt: string;
  text: string;
  source: string;
  projectId?: string;
}

function isEntry(value: unknown): value is TextHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.createdAt === 'string' &&
    Number.isFinite(Date.parse(entry.createdAt)) &&
    typeof entry.text === 'string' &&
    typeof entry.source === 'string' &&
    (entry.projectId === undefined || typeof entry.projectId === 'string')
  );
}

export function readTextHistory(): TextHistoryEntry[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || !entries.every(isEntry)) {
    throw new Error('Invalid text history');
  }
  return entries.slice(0, HISTORY_LIMIT);
}

export function saveTextHistory(
  entry: Pick<TextHistoryEntry, 'text' | 'source' | 'projectId'>
): void {
  if (!entry.text.trim()) return;
  try {
    const history = readTextHistory();
    const saved: TextHistoryEntry = {
      ...entry,
      id: Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) =>
        part.toString(16).padStart(8, '0')
      ).join(''),
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([saved, ...history].slice(0, HISTORY_LIMIT))
    );
  } catch {
    addToast('Could not save text history on this device', 'warning', 5000);
  }
}
