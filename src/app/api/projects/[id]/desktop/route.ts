import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  exitSession,
  getSessionScreen,
  listDesktopSessions,
  startRemoteControl,
} from '@/lib/desktop';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const windowId = request.nextUrl.searchParams.get('window');

  try {
    if (windowId) {
      return NextResponse.json({ content: await getSessionScreen(windowId) });
    }
    return NextResponse.json(await listDesktopSessions(id));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'claudex desktop failed' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { windowId, name, action } = await request.json();

  if (typeof windowId !== 'string' || !windowId) {
    return NextResponse.json({ error: 'Missing window' }, { status: 400 });
  }

  try {
    if (action === 'exit') {
      await exitSession(windowId);
      return NextResponse.json({ success: true });
    } else if (action === 'remote') {
      // The name is typed into a terminal as one slash command, so a newline would submit
      // half of it and leave the rest as a new prompt.
      const remoteName = typeof name === 'string' ? name.trim() : '';
      if (!remoteName || /[\r\n]/.test(remoteName)) {
        return NextResponse.json(
          { error: 'Invalid remote control name' },
          { status: 400 }
        );
      }
      await startRemoteControl(windowId, remoteName);
      return NextResponse.json({ success: true, name: remoteName });
    } else {
      return NextResponse.json(
        { error: `Unexpected action: ${action}` },
        { status: 400 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'claudex desktop failed' },
      { status: 500 }
    );
  }
}
