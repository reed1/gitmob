import Database from 'better-sqlite3';
import { mkdirSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';

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

const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000;

interface SdkSession {
  pid: number;
  ppid: number | null;
  sessionId: string;
  cwd: string;
}

function readProcPpid(pid: number): number | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
    const afterComm = stat.slice(stat.lastIndexOf(')') + 2);
    const ppid = parseInt(afterComm.split(' ')[1], 10);
    return Number.isNaN(ppid) ? null : ppid;
  } catch {
    return null;
  }
}

function readSdkSessions(): SdkSession[] {
  const dir = `${homedir()}/.claude/sessions`;
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const out: SdkSession[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8'));
      if (
        typeof data.pid === 'number' &&
        typeof data.sessionId === 'string' &&
        typeof data.cwd === 'string' &&
        isProcessAlive(data.pid)
      ) {
        out.push({
          pid: data.pid,
          ppid: readProcPpid(data.pid),
          sessionId: data.sessionId,
          cwd: data.cwd,
        });
      }
    } catch {}
  }
  return out;
}

function transcriptMtime(sessionId: string, cwd: string): number | null {
  const encoded = cwd.replace(/[/.]/g, '-');
  const path = `${homedir()}/.claude/projects/${encoded}/${sessionId}.jsonl`;
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

export interface ReapedSession {
  pid: number;
  projectId: string;
  idleMs: number;
}

// Terminates remote sessions whose child code sessions have all been idle
// (no transcript writes) for longer than idleMs. A `claude remote-control`
// host spawns one or more sdk-cli children; we treat the host as idle only
// when the most recent activity across all its children exceeds the timeout.
export function reapIdleSessions(idleMs = IDLE_TIMEOUT_MS): ReapedSession[] {
  clearDeadSessions();
  const now = Date.now();
  const hosts = getSessionStatuses().filter(
    (s) => s.type === 'remote' && s.alive
  );
  const sdkSessions = readSdkSessions();
  const reaped: ReapedSession[] = [];

  for (const host of hosts) {
    const children = sdkSessions.filter((c) => c.ppid === host.pid);
    let lastActive: number;
    if (children.length === 0) {
      lastActive = host.startedAt;
    } else {
      const mtimes = children
        .map((c) => transcriptMtime(c.sessionId, c.cwd))
        .filter((m): m is number => m !== null);
      lastActive = mtimes.length > 0 ? Math.max(...mtimes) : host.startedAt;
    }

    if (now - lastActive > idleMs) {
      for (const child of children) killSilently(child.pid);
      removeSession(host.pid, { killProcesses: true });
      reaped.push({
        pid: host.pid,
        projectId: host.projectId,
        idleMs: now - lastActive,
      });
    }
  }

  return reaped;
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
