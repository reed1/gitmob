import { isCustomModel, isProvider } from '@/lib/desktop';
import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  acceptSuggestedPrompt,
  closeProjectOnDesktop,
  getSessionScreen,
  launchDesktopSession,
  listDesktopSessions,
  openProjectOnDesktop,
  sendSessionCommand,
  sendSessionToPurgatory,
  typeIntoSession,
} from '@/lib/desktop';
import { isCommonCommand } from '@/lib/desktop-keys';
import { createWorktree } from '@/lib/wtman';

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

  const {
    windowId,
    claudePid,
    action,
    text,
    command,
    pressEnter,
    provider,
    prompt,
    branch,
    customModel,
  } = await request.json();

  try {
    if (action === 'launch') {
      if (!(await isProvider(provider))) {
        return NextResponse.json(
          { error: `Unexpected provider: ${provider}` },
          { status: 400 }
        );
      }
      if (!(await isCustomModel(provider, customModel))) {
        return NextResponse.json(
          { error: 'Invalid custom model' },
          { status: 400 }
        );
      }

      const initialPrompt = typeof prompt === 'string' ? prompt.trim() : '';
      const newBranch = typeof branch === 'string' ? branch.trim() : '';
      // A branch means the session gets a worktree of its own, created off main first.
      const target = newBranch
        ? await createWorktree(project, newBranch)
        : { projectId: id, path: project.path };
      const sessionName = target.path.split('/').pop() || target.projectId;
      await launchDesktopSession({
        projectId: target.projectId,
        directory: target.path,
        provider,
        customModel,
        prompt: initialPrompt,
      });
      return NextResponse.json({
        success: true,
        name: sessionName,
        projectId: target.projectId,
      });
    }

    if (action === 'open') {
      await openProjectOnDesktop(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'close') {
      await closeProjectOnDesktop(id);
      return NextResponse.json({ success: true });
    }

    if (typeof windowId !== 'string' || !windowId) {
      return NextResponse.json({ error: 'Missing window' }, { status: 400 });
    }

    if (action === 'command') {
      if (!isCommonCommand(command)) {
        return NextResponse.json(
          { error: `Unexpected command: ${command}` },
          { status: 400 }
        );
      }
      await sendSessionCommand(windowId, command);
      return NextResponse.json({ success: true });
    } else if (action === 'accept-prompt') {
      await acceptSuggestedPrompt(windowId);
      return NextResponse.json({ success: true });
    } else if (action === 'purgatory') {
      if (typeof claudePid !== 'string' || !claudePid) {
        return NextResponse.json({ error: 'Missing pid' }, { status: 400 });
      }
      await sendSessionToPurgatory({ windowId, claudePid });
      return NextResponse.json({ success: true });
    } else if (action === 'type') {
      if (typeof text !== 'string' || !text) {
        return NextResponse.json({ error: 'Missing text' }, { status: 400 });
      }
      await typeIntoSession(windowId, text, pressEnter === true);
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
