import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(request: NextRequest) {
  const { tmuxSession, text, enter } = await request.json();

  if (!tmuxSession || !text) {
    return NextResponse.json(
      { error: 'Missing tmuxSession or text' },
      { status: 400 }
    );
  }

  execSync(
    `tmux send-keys -t ${JSON.stringify(tmuxSession)} -l ${JSON.stringify(text)}`
  );
  if (enter) {
    execSync(`tmux send-keys -t ${JSON.stringify(tmuxSession)} Enter`);
  }

  return NextResponse.json({ ok: true });
}
