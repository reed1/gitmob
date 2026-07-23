import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionStatuses,
  clearDeadSessions,
  removeSession,
  reapIdleSessions,
} from '@/lib/claude-sessions';

export async function GET() {
  const sessions = getSessionStatuses();
  return NextResponse.json(sessions);
}

export async function DELETE(request: NextRequest) {
  const { pid, kill } = await request.json();
  removeSession(pid, { killProcesses: !!kill });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const { action } = await request.json();
  if (action === 'clearDead') {
    clearDeadSessions();
    return NextResponse.json({ ok: true });
  } else if (action === 'reapIdle') {
    const reaped = reapIdleSessions();
    return NextResponse.json({ ok: true, reaped });
  } else {
    return NextResponse.json(
      { error: `Unexpected action: ${action}` },
      { status: 400 }
    );
  }
}
