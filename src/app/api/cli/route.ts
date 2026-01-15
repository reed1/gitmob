import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export async function POST(request: NextRequest) {
  const { command, cwd, notify } = await request.json();

  const scriptPath = join(tmpdir(), `gitmob-cli-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(scriptPath, command);

  const { output, exitCode } = await new Promise<{ output: string; exitCode: number }>((resolve) => {
    exec(
      `bash "${scriptPath}" 2>&1`,
      { cwd, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        unlinkSync(scriptPath);
        resolve({
          output: stdout || (error?.message ?? ''),
          exitCode: error?.code ?? 0,
        });
      }
    );
  });

  if (notify) {
    exec(`pushover-send "Command finished with exit code ${exitCode}: ${command.slice(0, 100)}"`);
  }

  return NextResponse.json({ output, exitCode });
}
