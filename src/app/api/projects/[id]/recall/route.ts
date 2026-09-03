import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { launchDesktopSession, listAllDesktopSessions } from '@/lib/desktop';
import { readSession, recentSessions, searchSessions } from '@/lib/recall';

/** What a resumed window is called, as a handoff's is "Claude (handoff)". */
const RESUME_TITLE = 'Claude (recall)';

/** `claudex recall` resumes with --dangerously-skip-permissions; this is the same session. */
const RESUME_MODE = 'yolo';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const sessionId = request.nextUrl.searchParams.get('session');
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  try {
    if (sessionId) {
      return NextResponse.json({ session: await readSession(sessionId) });
    }
    return NextResponse.json({
      results: query
        ? await searchSessions(query, project.path)
        : await recentSessions(project.path),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'recall failed' },
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

  const { sessionId } = await request.json();
  if (typeof sessionId !== 'string' || !sessionId) {
    return NextResponse.json({ error: 'Missing session' }, { status: 400 });
  }

  try {
    // Resuming a conversation that is already open would leave two windows writing one
    // transcript, so the window that has it is offered instead of a second one.
    const open = (await listAllDesktopSessions()).find(
      (session) => session.sessionId === sessionId
    );
    if (open) {
      return NextResponse.json(
        { error: 'Session is already active', windowId: open.windowId },
        { status: 409 }
      );
    }

    // The search is scoped to the project's path, so that is the directory the session was
    // held in — the one `claude --resume` can find it under.
    const name = project.path.split('/').pop() || id;
    await launchDesktopSession({
      projectId: id,
      directory: project.path,
      mode: RESUME_MODE,
      name,
      prompt: '',
      title: RESUME_TITLE,
      resumeSessionId: sessionId,
    });
    return NextResponse.json({ success: true, name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'claudex kitty failed' },
      { status: 500 }
    );
  }
}
