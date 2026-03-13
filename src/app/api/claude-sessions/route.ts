import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionStatuses,
  clearDeadSessions,
  removeSession,
} from '@/lib/claude-sessions';

export async function GET() {
  const sessions = getSessionStatuses();
  return NextResponse.json(sessions);
}

export async function DELETE(request: NextRequest) {
  const { pid, kill } = await request.json();
  if (kill) {
    try {
      process.kill(pid);
    } catch {}
  }
  removeSession(pid);
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const { action } = await request.json();
  if (action === 'clearDead') {
    clearDeadSessions();
  }
  return NextResponse.json({ ok: true });
}
