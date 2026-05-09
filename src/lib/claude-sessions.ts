import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';

const DB_DIR = '/tmp/gitmob';
const DB_PATH = `${DB_DIR}/claude-sessions.db`;

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
      started_at INTEGER NOT NULL,
      type TEXT NOT NULL,
      aux_pid INTEGER
    )
  `);
  const columns = db.prepare('PRAGMA table_info(sessions)').all() as {
    name: string;
  }[];
  const required = ['type', 'aux_pid'];
  const hasAll = required.every((n) => columns.some((c) => c.name === n));
  if (!hasAll) {
    db.exec('DROP TABLE sessions');
    db.exec(`
      CREATE TABLE sessions (
        pid INTEGER PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        url TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        type TEXT NOT NULL,
        aux_pid INTEGER
      )
    `);
  }
  return db;
}

export type SessionType = 'remote' | 'ttyd';

export interface ClaudeSession {
  projectId: string;
  projectPath: string;
  url: string;
  pid: number;
  startedAt: number;
  type: SessionType;
  auxPid?: number;
}

export function registerSession(session: ClaudeSession) {
  const db = getDb();
  try {
    db.prepare(
      'INSERT OR REPLACE INTO sessions (pid, project_id, project_path, url, started_at, type, aux_pid) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      session.pid,
      session.projectId,
      session.projectPath,
      session.url,
      session.startedAt,
      session.type,
      session.auxPid ?? null
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
      .prepare(
        'SELECT pid, project_id, project_path, url, started_at, type, aux_pid FROM sessions ORDER BY started_at DESC'
      )
      .all() as {
      pid: number;
      project_id: string;
      project_path: string;
      url: string;
      started_at: number;
      type: SessionType;
      aux_pid: number | null;
    }[];

    return rows.map((row) => ({
      pid: row.pid,
      projectId: row.project_id,
      projectPath: row.project_path,
      url: row.url,
      startedAt: row.started_at,
      type: row.type,
      auxPid: row.aux_pid ?? undefined,
      alive: isProcessAlive(row.pid),
    }));
  } finally {
    db.close();
  }
}

function killSilently(pid: number) {
  try {
    process.kill(pid);
  } catch {}
}

export function removeSession(pid: number, opts?: { killProcesses?: boolean }) {
  const db = getDb();
  try {
    if (opts?.killProcesses) {
      const row = db
        .prepare('SELECT aux_pid FROM sessions WHERE pid = ?')
        .get(pid) as { aux_pid: number | null } | undefined;
      killSilently(pid);
      if (row?.aux_pid) {
        killSilently(row.aux_pid);
      }
    }
    db.prepare('DELETE FROM sessions WHERE pid = ?').run(pid);
  } finally {
    db.close();
  }
}

export function clearDeadSessions() {
  const statuses = getSessionStatuses();
  const dead = statuses.filter((s) => !s.alive);
  if (dead.length === 0) return;

  for (const s of dead) {
    if (s.auxPid) killSilently(s.auxPid);
  }

  const db = getDb();
  try {
    const placeholders = dead.map(() => '?').join(',');
    db.prepare(`DELETE FROM sessions WHERE pid IN (${placeholders})`).run(
      ...dead.map((s) => s.pid)
    );
  } finally {
    db.close();
  }
}
