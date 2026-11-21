import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { getProject } from '@/lib/projects';
import { readSessionAgenda } from '@/lib/desktop';

/** claudex names the agenda file after the session, so anything else would be a path. */
const SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  if (!sessionId || !SESSION_ID.test(sessionId)) {
    return NextResponse.json(
      { error: `Unexpected session: ${sessionId}` },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ content: await readSessionAgenda(sessionId) });
  } catch (err) {
    return errorResponse(request, err, 'claudex agenda failed');
  }
}
