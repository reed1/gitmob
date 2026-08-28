import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  deletePendingHandoff,
  isHandoffId,
  listPendingHandoffs,
  readPendingHandoff,
} from '@/lib/handoffs';
import { launchDesktopSession } from '@/lib/desktop';
import { isClaudeMode } from '@/lib/desktop-modes';

/** What claudex-handoff would have titled the window it opened itself. */
const HANDOFF_TITLE = 'Claude (handoff)';

export async function GET() {
  return NextResponse.json({ handoffs: listPendingHandoffs() });
}

export async function POST(request: NextRequest) {
  const { handoffId, prompt, mode } = await request.json();
  if (!isHandoffId(handoffId)) {
    return NextResponse.json({ error: 'Missing handoff' }, { status: 400 });
  }
  if (!isClaudeMode(mode)) {
    return NextResponse.json(
      { error: `Unexpected mode: ${mode}` },
      { status: 400 }
    );
  }

  const handoff = readPendingHandoff(handoffId);
  if (!handoff) {
    return NextResponse.json({ error: 'Handoff not found' }, { status: 404 });
  }

  // The project is the one claudex parked it under; a worktree answers to its own id.
  const project = await getProject(handoff.projectId);
  if (!project) {
    return NextResponse.json(
      { error: `No such project: ${handoff.projectId}` },
      { status: 404 }
    );
  }

  // The prompt is the browser's to edit; the directory is not, so it comes from the file.
  const briefing = typeof prompt === 'string' ? prompt.trim() : '';
  if (!briefing) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const sessionName = project.path.split('/').pop() || project.id;
  try {
    await launchDesktopSession({
      projectId: handoff.projectId,
      directory: handoff.directory,
      mode,
      name: sessionName,
      prompt: briefing,
      title: HANDOFF_TITLE,
    });
  } catch (err) {
    // A launch that never happened leaves the handoff parked, to fix and try again.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'claudex kitty failed' },
      { status: 500 }
    );
  }

  deletePendingHandoff(handoffId);
  return NextResponse.json({ success: true, name: sessionName });
}

export async function DELETE(request: NextRequest) {
  const handoffId = request.nextUrl.searchParams.get('handoff');
  if (!isHandoffId(handoffId)) {
    return NextResponse.json({ error: 'Missing handoff' }, { status: 400 });
  }
  if (!readPendingHandoff(handoffId)) {
    return NextResponse.json({ error: 'Handoff not found' }, { status: 404 });
  }

  deletePendingHandoff(handoffId);
  return NextResponse.json({ success: true });
}
