import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
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

function ensureJobsDir() {
  if (!existsSync(JOBS_DIR)) {
    mkdirSync(JOBS_DIR, { recursive: true });
  }
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  const jobPath = join(JOBS_DIR, `${jobId}.json`);
  const outputPath = join(JOBS_DIR, `${jobId}.log`);

  if (!existsSync(jobPath)) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const job = JSON.parse(readFileSync(jobPath, 'utf-8'));
  const output = existsSync(outputPath)
    ? readFileSync(outputPath, 'utf-8')
    : '';

  return NextResponse.json({
    ...job,
    output,
  });
}

export async function POST(request: NextRequest) {
  const { command, cwd, notify } = await request.json();

  ensureJobsDir();

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const scriptPath = join(tmpdir(), `gitmob-cli-${jobId}.sh`);
  const jobPath = join(JOBS_DIR, `${jobId}.json`);
  const outputPath = join(JOBS_DIR, `${jobId}.log`);

  writeFileSync(scriptPath, command);

  const outputFd = openSync(outputPath, 'w');

  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio: ['ignore', outputFd, outputFd],
    cwd,
  });

  const startTime = Date.now();
  const job = {
    id: jobId,
    command,
    cwd,
    pid: child.pid,
    startTime,
    status: 'running',
    exitCode: null,
    duration: null,
    notify: !!notify,
  };

  writeFileSync(jobPath, JSON.stringify(job, null, 2));

  child.on('exit', (code) => {
    closeSync(outputFd);
    unlinkSync(scriptPath);

    const endTime = Date.now();
    const updatedJob = {
      ...job,
      status: 'completed',
      exitCode: code ?? 0,
      duration: endTime - startTime,
    };
    writeFileSync(jobPath, JSON.stringify(updatedJob, null, 2));

    if (notify) {
      spawn(
        'pushover-send',
        [`Command finished with exit code ${code}: ${command.slice(0, 100)}`],
        {
          detached: true,
          stdio: 'ignore',
        }
      ).unref();
    }
  });

  child.unref();

  return NextResponse.json({ jobId, pid: child.pid });
}

export async function DELETE(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  const jobPath = join(JOBS_DIR, `${jobId}.json`);
  const outputPath = join(JOBS_DIR, `${jobId}.log`);

  if (existsSync(jobPath)) unlinkSync(jobPath);
  if (existsSync(outputPath)) unlinkSync(outputPath);

  return NextResponse.json({ success: true });
}
