import { exec, execSync, spawn } from 'child_process';
import { Project } from './projects';

const SESSION_PREFIX = 'rvp-';

export interface ProcessInfo {
  name: string;
  running: boolean;
  pid?: string;
  uptime?: string;
  members?: string[];
  runningMembers?: number;
}

export interface ProcessDefinition {
  name: string;
  commands?: string[];
  members?: string[];
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

export async function getAllRunningProcesses(): Promise<
  Record<string, string[]>
> {
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

function getEntryRun(
  entry: NonNullable<Project['cmd']>[string]
): string | string[] | undefined {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry)) return entry;
  if (typeof entry === 'object') return entry.run;
  return undefined;
}

function resolveGroupMembers(
  cmd: NonNullable<Project['cmd']>,
  name: string,
  visited: Set<string>
): string[] {
  if (visited.has(name)) {
    throw new Error(`Circular cmd reference: ${name}`);
  }
  visited.add(name);

  const entry = cmd[name];
  if (!entry) return [];

  const run = getEntryRun(entry);
  if (!Array.isArray(run)) {
    return [name];
  }

  const hasRefs = run.some((r) => typeof r === 'string' && r.startsWith('@'));
  if (!hasRefs) {
    return [name];
  }

  const members: string[] = [];
  for (const item of run) {
    if (typeof item === 'string' && item.startsWith('@')) {
      const refName = item.slice(1);
      for (const m of resolveGroupMembers(cmd, refName, new Set(visited))) {
        if (!members.includes(m)) members.push(m);
      }
    }
  }
  return members;
}

export function getGroupMembers(
  cmd: Project['cmd'],
  name: string
): string[] | null {
  if (!cmd) return null;
  const entry = cmd[name];
  if (!entry) return null;
  const run = getEntryRun(entry);
  if (!Array.isArray(run)) return null;
  if (!run.some((r) => typeof r === 'string' && r.startsWith('@'))) return null;
  return resolveGroupMembers(cmd, name, new Set());
}

export function parseProcessDefinitions(
  cmd: Project['cmd']
): ProcessDefinition[] {
  if (!cmd) return [];

  const definitions: ProcessDefinition[] = [];

  for (const [name, value] of Object.entries(cmd)) {
    if (typeof value === 'string') {
      definitions.push({ name, commands: [value] });
    } else if (Array.isArray(value)) {
      definitions.push({ name, commands: value });
    } else if (typeof value === 'object' && value.run) {
      const run = value.run;
      if (typeof run === 'string') {
        definitions.push({ name, commands: [run] });
      } else if (Array.isArray(run)) {
        const hasRefs = run.some(
          (r) => typeof r === 'string' && r.startsWith('@')
        );
        if (hasRefs) {
          definitions.push({
            name,
            members: resolveGroupMembers(cmd, name, new Set()),
          });
        } else {
          definitions.push({ name, commands: run });
        }
      }
    }
  }

  return definitions;
}

export function getProcessStatus(
  projectId: string,
  cmd: Project['cmd']
): ProcessInfo[] {
  const definitions = parseProcessDefinitions(cmd);
  if (definitions.length === 0) return [];

  const runningMap = getRunningProcesses(projectId);

  return definitions.map((def) => {
    if (def.members) {
      const runningMembers = def.members.filter((m) => runningMap[m]).length;
      return {
        name: def.name,
        running: runningMembers > 0,
        members: def.members,
        runningMembers,
      };
    }
    const running = runningMap[def.name];
    return {
      name: def.name,
      running: !!running,
      pid: running?.pid,
      uptime: running?.uptime,
    };
  });
}

function runRv(args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('rv', args, { stdio: 'pipe' });

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

export async function startProcess(
  projectId: string,
  processName: string
): Promise<{ success: boolean; error?: string }> {
  return runRv(['proc', 'start', projectId, processName]);
}

export async function stopProcess(
  projectId: string,
  processName: string,
  cmd?: Project['cmd']
): Promise<{ success: boolean; error?: string }> {
  const members = getGroupMembers(cmd, processName);
  if (members && members.length > 0) {
    const runningMap = getRunningProcesses(projectId);
    const runningMembers = members.filter((m) => runningMap[m]);
    if (runningMembers.length === 0) {
      return { success: true };
    }
    const errors: string[] = [];
    for (const member of runningMembers) {
      const result = await runRv(['proc', 'stop', projectId, member]);
      if (!result.success && result.error)
        errors.push(`${member}: ${result.error}`);
    }
    if (errors.length > 0) {
      return { success: false, error: errors.join('; ') };
    }
    return { success: true };
  }
  return runRv(['proc', 'stop', projectId, processName]);
}

export async function restartProcess(
  projectId: string,
  processName: string,
  cmd?: Project['cmd']
): Promise<{ success: boolean; error?: string }> {
  const members = getGroupMembers(cmd, processName);
  if (members && members.length > 0) {
    const stopResult = await stopProcess(projectId, processName, cmd);
    if (!stopResult.success) return stopResult;
    await new Promise((r) => setTimeout(r, 500));
    return runRv(['proc', 'start', projectId, processName]);
  }
  return runRv(['proc', 'restart', projectId, processName]);
}

export async function stopAllProcesses(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    exec(`rv proc stop ${projectId}`, (error, _, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}
