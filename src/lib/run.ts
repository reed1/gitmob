import { exec, execFileSync, spawn } from 'child_process';
import { Project } from './projects';

const UNIT_PREFIX = 'rvp-';

export interface RunInfo {
  name: string;
  running: boolean;
  pid?: string;
  uptime?: string;
  members?: string[];
  runningMembers?: number;
}

export interface RunDefinition {
  name: string;
  commands?: string[];
  members?: string[];
}

// Must mirror _sanitize_unit_part in rofi-vscode/shared/proc.py so names line up.
function sanitizeUnitPart(part: string): string {
  return part.replace(/[^A-Za-z0-9:_.\-]/g, '_');
}

export function getUnitName(projectId: string, cmdName: string): string {
  return `${UNIT_PREFIX}${sanitizeUnitPart(projectId)}-${sanitizeUnitPart(cmdName)}.service`;
}

export interface RunLog {
  unitExists: boolean;
  output: string;
}

export function captureLog(
  projectId: string,
  cmdName: string,
  lines = 2000
): RunLog {
  const unit = getUnitName(projectId, cmdName);
  const output = execFileSync(
    'journalctl',
    [
      '--user',
      '-u',
      unit,
      '-n',
      String(lines),
      '-o',
      'cat',
      '--no-pager',
      '-q',
    ],
    { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 }
  ).replace(/\s+$/, '');
  return { unitExists: output.length > 0, output };
}

export async function getAllRunning(): Promise<Record<string, string[]>> {
  return new Promise((resolve) => {
    exec('rv run status --all --json', (error, stdout) => {
      if (error) {
        // The project list still has to render without rv; the Run tab reports the failure.
        resolve({});
        return;
      }
      try {
        const entries = JSON.parse(stdout) as Array<{
          project: string;
          command: string;
          state: string;
        }>;

        const map: Record<string, string[]> = {};
        for (const entry of entries) {
          if (entry.state !== 'running') continue;
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

interface RunningUnitMap {
  [key: string]: { pid: string; uptime: string };
}

// execFileSync hangs rv's stderr off the error and leaves the message at 'Command failed',
// which is no use to whoever reads it. Everything below reports the failure, so it has to say why.
function rvSync(args: string[]): string {
  try {
    return execFileSync('rv', args, { encoding: 'utf-8' });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr?.toString().trim();
    throw new Error(stderr || (err as Error).message);
  }
}

function getRunningUnits(projectId: string): RunningUnitMap {
  const entries = JSON.parse(
    rvSync(['run', 'status', '-p', projectId, '--json'])
  ) as Array<{
    command: string;
    state: string;
    pid: string;
    uptime: string;
  }>;
  const map: RunningUnitMap = {};
  for (const entry of entries) {
    if (entry.state === 'running') {
      map[entry.command] = { pid: entry.pid, uptime: entry.uptime };
    }
  }
  return map;
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

export function parseRunDefinitions(cmd: Project['cmd']): RunDefinition[] {
  if (!cmd) return [];

  const definitions: RunDefinition[] = [];

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

export function getRunStatus(
  projectId: string,
  cmd: Project['cmd']
): RunInfo[] {
  const definitions = parseRunDefinitions(cmd);
  if (definitions.length === 0) return [];

  const runningMap = getRunningUnits(projectId);

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

function startArgs(projectId: string, runName: string): string[] {
  return ['run', 'start', '--mode', 'systemd', '-p', projectId, runName];
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

export async function startRun(
  projectId: string,
  runName: string
): Promise<{ success: boolean; error?: string }> {
  return runRv(startArgs(projectId, runName));
}

export async function stopRun(
  projectId: string,
  runName: string,
  cmd?: Project['cmd']
): Promise<{ success: boolean; error?: string }> {
  const members = getGroupMembers(cmd, runName);
  if (members && members.length > 0) {
    const runningMap = getRunningUnits(projectId);
    const runningMembers = members.filter((m) => runningMap[m]);
    if (runningMembers.length === 0) {
      return { success: true };
    }
    const errors: string[] = [];
    for (const member of runningMembers) {
      const result = await runRv(['run', 'stop', '-p', projectId, member]);
      if (!result.success && result.error)
        errors.push(`${member}: ${result.error}`);
    }
    if (errors.length > 0) {
      return { success: false, error: errors.join('; ') };
    }
    return { success: true };
  }
  return runRv(['run', 'stop', '-p', projectId, runName]);
}

export async function restartRun(
  projectId: string,
  runName: string,
  cmd?: Project['cmd']
): Promise<{ success: boolean; error?: string }> {
  const members = getGroupMembers(cmd, runName);
  if (members && members.length > 0) {
    const stopResult = await stopRun(projectId, runName, cmd);
    if (!stopResult.success) return stopResult;
    return runRv(startArgs(projectId, runName));
  }
  return runRv(['run', 'restart', '-p', projectId, runName]);
}
