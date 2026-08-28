import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  exitSession,
  getSessionScreen,
  launchDesktopSession,
  listDesktopSessions,
  pressSessionKey,
  startRemoteControl,
  typeIntoSession,
} from '@/lib/desktop';
import { isSpecialKey } from '@/lib/desktop-keys';
import { isClaudeMode } from '@/lib/desktop-modes';

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

  const { windowId, name, action, text, key, pressEnter, mode, prompt } =
    await request.json();

  try {
    if (action === 'launch') {
      if (!isClaudeMode(mode)) {
        return NextResponse.json(
          { error: `Unexpected mode: ${mode}` },
          { status: 400 }
        );
      }
      const initialPrompt = typeof prompt === 'string' ? prompt.trim() : '';
      const sessionName = project.path.split('/').pop() || id;
      await launchDesktopSession({
        projectId: id,
        directory: project.path,
        mode,
        name: sessionName,
        prompt: initialPrompt,
      });
      return NextResponse.json({ success: true, name: sessionName });
    }

    if (typeof windowId !== 'string' || !windowId) {
      return NextResponse.json({ error: 'Missing window' }, { status: 400 });
    }

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
    } else if (action === 'type') {
      if (typeof text !== 'string' || !text) {
        return NextResponse.json({ error: 'Missing text' }, { status: 400 });
      }
      await typeIntoSession(windowId, text, pressEnter === true);
      return NextResponse.json({ success: true });
    } else if (action === 'key') {
      if (!isSpecialKey(key)) {
        return NextResponse.json(
          { error: `Unexpected key: ${key}` },
          { status: 400 }
        );
      }
      await pressSessionKey(windowId, key);
      return NextResponse.json({ success: true });
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
