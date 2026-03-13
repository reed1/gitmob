import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DB_DIR = join(homedir(), '.cache/gitmob');
const DB_PATH = join(DB_DIR, 'claude-sessions.db');

function getDb(): Database.Database {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      pid INTEGER PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_path TEXT NOT NULL,
      url TEXT NOT NULL,
      started_at INTEGER NOT NULL
    )
  `);
  return db;
}

export interface ClaudeSession {
  projectId: string;
  projectPath: string;
  url: string;
  pid: number;
  startedAt: number;
}

export function registerSession(session: ClaudeSession) {
  const db = getDb();
  try {
    db.prepare(
      'INSERT OR REPLACE INTO sessions (pid, project_id, project_path, url, started_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      session.pid,
      session.projectId,
      session.projectPath,
      session.url,
      session.startedAt
    );
  } finally {
    db.close();
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface ClaudeSessionStatus extends ClaudeSession {
  alive: boolean;
}

export function getSessionStatuses(): ClaudeSessionStatus[] {
  const db = getDb();
  try {
    const rows = db
      .prepare('SELECT pid, project_id, project_path, url, started_at FROM sessions ORDER BY started_at DESC')
      .all() as {
      pid: number;
      project_id: string;
      project_path: string;
      url: string;
      started_at: number;
    }[];

    return rows.map((row) => ({
      pid: row.pid,
      projectId: row.project_id,
      projectPath: row.project_path,
      url: row.url,
      startedAt: row.started_at,
      alive: isProcessAlive(row.pid),
    }));
  } finally {
    db.close();
  }
}

export function removeSession(pid: number) {
  const db = getDb();
  try {
    db.prepare('DELETE FROM sessions WHERE pid = ?').run(pid);
  } finally {
    db.close();
  }
}

export function clearDeadSessions() {
  const statuses = getSessionStatuses();
  const deadPids = statuses.filter((s) => !s.alive).map((s) => s.pid);
  if (deadPids.length === 0) return;

  const db = getDb();
  try {
    const placeholders = deadPids.map(() => '?').join(',');
    db.prepare(`DELETE FROM sessions WHERE pid IN (${placeholders})`).run(
      ...deadPids
    );
  } finally {
    db.close();
  }
}
