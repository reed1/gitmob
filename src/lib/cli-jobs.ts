import { ChildProcess, spawn, StdioOptions } from 'child_process';
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  openSync,
  closeSync,
} from 'fs';
import { tmpdir, homedir } from 'os';
import { join } from 'path';

const JOBS_DIR = join(homedir(), '.local/share/gitmob/cli-jobs');

/** 'lost' is a job whose process died while no server was watching it — see `readJob`. */
export type JobStatus = 'running' | 'completed' | 'lost';

export interface CliJob {
  id: string;
  command: string;
  cwd?: string;
  pid?: number;
  /** The server process that spawned it, and so the only one that can record its exit. */
  owner: number;
  startTime: number;
  status: JobStatus;
  /** null when the process died on a signal rather than exiting; `signal` says which. */
  exitCode: number | null;
  signal: string | null;
  duration: number | null;
  notify: boolean;
}

export interface JobSpec {
  /** Run through bash. Mutually exclusive with `argv`. */
  script?: string;
  /** Spawned as-is, no shell between the arguments and the program. */
  argv?: string[];
  cwd?: string;
  notify?: boolean;
  /** Reuse an id to keep one live job per subject; the previous run's log is replaced. */
  jobId?: string;
}

function jobPath(jobId: string) {
  return join(JOBS_DIR, `${jobId}.json`);
}

function outputPath(jobId: string) {
  return join(JOBS_DIR, `${jobId}.log`);
}

function isAlive(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function startJob(spec: JobSpec): CliJob {
  if (!existsSync(JOBS_DIR)) mkdirSync(JOBS_DIR, { recursive: true });

  const id =
    spec.jobId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const outputFd = openSync(outputPath(id), 'w');
  const stdio: StdioOptions = ['ignore', outputFd, outputFd];

  let command: string;
  let child: ChildProcess;
  let scriptPath: string | null = null;

  if (spec.argv) {
    command = spec.argv.join(' ');
    child = spawn(spec.argv[0], spec.argv.slice(1), {
      detached: true,
      stdio,
      cwd: spec.cwd,
    });
  } else if (spec.script !== undefined) {
    command = spec.script;
    scriptPath = join(tmpdir(), `gitmob-cli-${id}.sh`);
    writeFileSync(scriptPath, spec.script);
    child = spawn('bash', [scriptPath], {
      detached: true,
      stdio,
      cwd: spec.cwd,
    });
  } else {
    throw new Error('A job needs either a script or an argv');
  }

  const job: CliJob = {
    id,
    command,
    cwd: spec.cwd,
    pid: child.pid,
    owner: process.pid,
    startTime: Date.now(),
    status: 'running',
    exitCode: null,
    signal: null,
    duration: null,
    notify: !!spec.notify,
  };
  writeFileSync(jobPath(id), JSON.stringify(job, null, 2));

  child.on('exit', (code, signal) => {
    closeSync(outputFd);
    if (scriptPath) unlinkSync(scriptPath);

    // A killed process has no exit code. Calling that a zero would report a deploy someone
    // interrupted as one that succeeded.
    const finished: CliJob = {
      ...job,
      status: 'completed',
      exitCode: code,
      signal,
      duration: Date.now() - job.startTime,
    };
    writeFileSync(jobPath(id), JSON.stringify(finished, null, 2));

    if (spec.notify) {
      const outcome = signal ? `on ${signal}` : `with exit code ${code}`;
      spawn(
        'pushover-send',
        [`Command finished ${outcome}: ${command.slice(0, 100)}`],
        { detached: true, stdio: 'ignore' }
      ).unref();
    }
  });

  child.unref();

  return job;
}

/**
 * A job outlives the server that spawned it, but its exit code does not: only the spawning
 * process has the handler that records one. So a running job left by an earlier process whose
 * pid is gone reads as 'lost' rather than hanging on 'running' forever.
 */
export function readJob(jobId: string): (CliJob & { output: string }) | null {
  if (!existsSync(jobPath(jobId))) return null;

  const job: CliJob = JSON.parse(readFileSync(jobPath(jobId), 'utf-8'));
  const output = existsSync(outputPath(jobId))
    ? readFileSync(outputPath(jobId), 'utf-8')
    : '';

  const orphaned =
    job.status === 'running' && job.owner !== process.pid && !isAlive(job.pid);

  return { ...job, status: orphaned ? 'lost' : job.status, output };
}

export function deleteJob(jobId: string) {
  if (existsSync(jobPath(jobId))) unlinkSync(jobPath(jobId));
  if (existsSync(outputPath(jobId))) unlinkSync(outputPath(jobId));
}
