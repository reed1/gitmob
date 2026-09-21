import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  deletePendingHandoff,
  isHandoffId,
  listPendingHandoffs,
  readPendingHandoff,
} from '@/lib/handoffs';
import { launchDesktopSession } from '@/lib/desktop';
import { getRepoSummary } from '@/lib/git';
import { isClaudeMode } from '@/lib/desktop-modes';

/** The title a handoff window carries, whichever end launches it. */
const HANDOFF_TITLE = 'Claude (handoff)';

/**
 * Whether the tree a briefing would run in has uncommitted work. The question is asked of the
 * handoff's own directory rather than of its project's checkout: that directory is the cwd the
 * session gets, whichever worktree it is. Null where git cannot answer, which is a directory
 * gone since the handoff was parked.
 */
async function isClean(directory: string): Promise<boolean | null> {
  try {
    const { hasChanges } = await getRepoSummary(directory);
    return !hasChanges;
  } catch {
    return null;
  }
}

export async function GET() {
  const handoffs = await Promise.all(
    listPendingHandoffs().map(async (handoff) => ({
      ...handoff,
      clean: await isClean(handoff.directory),
    }))
  );
  return NextResponse.json({ handoffs });
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
