import { execFile, spawn } from 'child_process';
import { Project } from './projects';

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
 * `pt sudo list` is the only way this app learns sudo state — pt owns the flag cache and the
 * target-to-server mapping. It reads local state only, so sweeping every project stays cheap
 * enough for the project list.
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

export async function getSudoEnabledProjects(): Promise<
  Record<string, boolean>
> {
  let rows: PtSudoRow[];
  try {
    rows = await listSudo(['--all-projects']);
  } catch {
    // The project list still has to render without pt; the Sudo tab reports the failure.
    return {};
  }

  const enabled: Record<string, boolean> = {};
  for (const row of rows) {
    if (row.enabled) enabled[row.project] = true;
  }
  return enabled;
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
