'use client';

import { addToast } from './api';

// IndexedDB rather than localStorage: it keeps Blobs as they are, and minutes of audio would
// soon outgrow localStorage's few megabytes once base64'd.
const DB_NAME = 'gitmob:audio-history';
const STORE = 'recordings';
const HISTORY_LIMIT = 5;

export interface Recording {
  id: string;
  createdAt: string;
  durationMs: number;
  projectId: string;
  audio: Blob;
  /** Null until a transcription comes back for it. */
  text: string | null;
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function inStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () =>
    open.result.createObjectStore(STORE, { keyPath: 'id' });
  const db = await settle(open);
  try {
    const transaction = db.transaction(STORE, mode);
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    const result = await work(transaction.objectStore(STORE));
    await committed;
    return result;
  } finally {
    db.close();
  }
}

async function allNewestFirst(store: IDBObjectStore): Promise<Recording[]> {
  const recordings: Recording[] = await settle(store.getAll());
  return recordings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function readRecordings(): Promise<Recording[]> {
  return inStore('readonly', allNewestFirst);
}

/** Keeps the recording before it is sent anywhere; null when this device would not store it. */
export async function saveRecording(
  entry: Pick<Recording, 'audio' | 'durationMs' | 'projectId'>
): Promise<string | null> {
  const saved: Recording = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    text: null,
  };
  try {
    await inStore('readwrite', async (store) => {
      store.put(saved);
      const recordings = await allNewestFirst(store);
      for (const old of recordings.slice(HISTORY_LIMIT)) store.delete(old.id);
    });
    return saved.id;
  } catch {
    addToast('Could not keep the recording on this device', 'warning', 5000);
    return null;
  }
}

/** A recording already pushed out by newer ones is left gone. */
export function setRecordingText(id: string, text: string): Promise<void> {
  return inStore('readwrite', async (store) => {
    const recording: Recording | undefined = await settle(store.get(id));
    if (recording) store.put({ ...recording, text });
  });
}
