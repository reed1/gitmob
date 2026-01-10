import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST(request: NextRequest) {
  const { command, cwd } = await request.json();

  const output = await new Promise<string>((resolve) => {
    exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve(stdout + stderr || error.message);
      } else {
        resolve(stdout + stderr);
      }
    });
  });

  return NextResponse.json({ output });
}
