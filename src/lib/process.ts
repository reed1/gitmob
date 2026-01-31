import { exec, execSync, spawn } from 'child_process';
import { Project } from './projects';

const SESSION_PREFIX = 'rvp-';

export interface ProcessInfo {
  name: string;
  running: boolean;
  pid?: string;
  uptime?: string;
}

export function getSessionName(projectId: string): string {
  return `${SESSION_PREFIX}${projectId}`;
}

export function sessionExists(projectId: string): boolean {
  const sessionName = getSessionName(projectId);
  try {
    execSync(`tmux has-session -t ${sessionName}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function listWindows(projectId: string): string[] {
  const sessionName = getSessionName(projectId);
  try {
    const result = execSync(
      `tmux list-windows -t ${sessionName} -F "#{window_name}"`,
      { encoding: 'utf-8' }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export async function getAllRunningProcesses(): Promise<Record<string, string[]>> {
  return new Promise((resolve) => {
    exec('rv proc status --json', (error, stdout) => {
      if (error) {
        resolve({});
        return;
      }
      try {
        const entries = JSON.parse(stdout) as Array<{
          project: string;
          command: string;
        }>;

        const map: Record<string, string[]> = {};
        for (const entry of entries) {
          if (!map[entry.project]) {
            map[entry.project] = [];
          }
          map[entry.project].push(entry.command);
        }
        resolve(map);
      } catch {
        resolve({});
      }
    });
  });
}

interface RunningProcessMap {
  [key: string]: { pid: string; uptime: string };
}

function getRunningProcesses(projectId: string): RunningProcessMap {
  try {
    const result = execSync('rv proc status --json', { encoding: 'utf-8' });
    const entries = JSON.parse(result) as Array<{
      project: string;
      command: string;
      pid: string;
      uptime: string;
    }>;
    const map: RunningProcessMap = {};
    for (const entry of entries) {
      if (entry.project === projectId) {
        map[entry.command] = { pid: entry.pid, uptime: entry.uptime };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function parseProcessDefinitions(
  cmd: Project['cmd']
): { name: string; commands: string[] }[] {
  if (!cmd) return [];

  const processes: { name: string; commands: string[] }[] = [];

  for (const [name, value] of Object.entries(cmd)) {
    if (typeof value === 'string') {
      processes.push({ name, commands: [value] });
    } else if (Array.isArray(value)) {
      processes.push({ name, commands: value });
    } else if (typeof value === 'object' && value.run) {
      const run = value.run;
      if (typeof run === 'string') {
        processes.push({ name, commands: [run] });
      } else if (Array.isArray(run)) {
        const isReference = run.some((r) => r.startsWith('@'));
        if (isReference) {
          continue;
        }
        processes.push({ name, commands: run });
      }
    }
  }

  return processes;
}

export function getProcessStatus(
  projectId: string,
  cmd: Project['cmd']
): ProcessInfo[] {
  const definitions = parseProcessDefinitions(cmd);
  if (definitions.length === 0) return [];

  const runningMap = getRunningProcesses(projectId);

  return definitions.map((def) => {
    const running = runningMap[def.name];
    return {
      name: def.name,
      running: !!running,
      pid: running?.pid,
      uptime: running?.uptime,
    };
  });
}

export async function startProcess(
  projectId: string,
  processName: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('rv', ['proc', 'start', projectId, processName], {
      stdio: 'pipe',
    });

    let stderr = '';
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

export async function stopProcess(
  projectId: string,
  processName: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('rv', ['proc', 'stop', projectId, processName], {
      stdio: 'pipe',
    });

    let stderr = '';
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

export async function restartProcess(
  projectId: string,
  processName: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('rv', ['proc', 'restart', projectId, processName], {
      stdio: 'pipe',
    });

    let stderr = '';
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}
