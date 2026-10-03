import { execFile, spawn } from 'child_process';
import { Project } from './projects';
import { backgroundCache } from './background-cache';

export type SudoAction = 'on' | 'off' | 'status';

export interface SudoTarget {
  name: string;
  ssh: string;
  enabled: boolean;
  enabledAt: number | null;
}

interface PtSudoRow {
  project: string;
  target: string;
  server: string;
  path: string | null;
  enabled: boolean;
  enabled_at: number | null;
}

/**
 * `pt sudo list` is the only way this app learns sudo state — pt owns the
 * target-to-server mapping, and reads the flags themselves from abubot. It contacts no
 * server, and one call covers every project, so the project-list sweep stays cheap.
 */
function listSudo(args: string[], cwd?: string): Promise<PtSudoRow[]> {
  return new Promise((resolve, reject) => {
    execFile(
      'pt',
      ['sudo', 'list', ...args, '--json'],
      { cwd, timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(JSON.parse(stdout));
      }
    );
  });
}

export async function getSudoTargets(project: Project): Promise<SudoTarget[]> {
  const rows = await listSudo([], project.path);

  return rows.map((row) => ({
    name: row.target,
    ssh: row.server,
    enabled: row.enabled,
    enabledAt: row.enabled_at === null ? null : row.enabled_at * 1000,
  }));
}

// abubot is a network round trip on top of pt's own start-up, and the project list is
// reopened all day; the Sudo tab still asks pt live.
const sudoEnabled = backgroundCache(
  'sudo.enabled',
  60 * 60 * 1000,
  async () => {
    const enabled: Record<string, boolean> = {};
    for (const row of await listSudo(['--all-projects'])) {
      if (row.enabled) enabled[row.project] = true;
    }
    return enabled;
  }
);

/** Projects with passwordless sudo on — from memory, refreshed hourly and on every toggle. */
export function getSudoEnabledProjects(): Promise<Record<string, boolean>> {
  // The project list still has to render without pt; the Sudo tab reports the failure.
  return sudoEnabled.get().catch(() => ({}));
}

export function refreshSudoEnabledProjects(): Promise<Record<string, boolean>> {
  return sudoEnabled.refresh();
}

const ANSI_COLOR = new RegExp('\\u001b\\[[0-9;]*m', 'g');

function cleanOutput(raw: string): string {
  return raw.replace(ANSI_COLOR, '').replace(/\r\n/g, '\n').trimEnd();
}

export function runPtSudo(
  project: Project,
  target: string,
  action: SudoAction
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    // pt resolves its project from the cwd's git root and the alias from that project's push
    // config. stdin is /dev/null so rpass and `ssh -tt` fail instead of prompting.
    const proc = spawn('pt', ['sudo', target, action], {
      cwd: project.path,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
    });

    let output = '';
    proc.stdout.on('data', (chunk) => (output += chunk));
    proc.stderr.on('data', (chunk) => (output += chunk));

    proc.on('close', (code) =>
      resolve({ success: code === 0, output: cleanOutput(output) })
    );
    proc.on('error', (err) => resolve({ success: false, output: err.message }));
  });
}
