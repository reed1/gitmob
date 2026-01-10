import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(request: NextRequest) {
  const { command, cwd } = await request.json();

  let output: string;
  try {
    output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    output = (execErr.stdout || '') + (execErr.stderr || '') || execErr.message || 'Command failed';
  }

  return NextResponse.json({ output });
}
