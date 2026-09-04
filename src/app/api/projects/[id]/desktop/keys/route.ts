import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { pressSessionKey } from '@/lib/desktop';
import { isSpecialKey } from '@/lib/desktop-keys';

/**
 * A key press has a URL of its own so the duplicate guard can let it through by path. Send Keys
 * is a keyboard, and a keyboard repeats: pressing Down twice is one request sent twice, with
 * nothing in it to tell the second press from a resend of the first. Everything else the desktop
 * endpoint does — launching a session above all, where a repeat is a second Claude window — has
 * to stay guarded, and could not be while the two shared a URL.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { windowId, key } = await request.json();

  if (typeof windowId !== 'string' || !windowId) {
    return NextResponse.json({ error: 'Missing window' }, { status: 400 });
  }
  if (!isSpecialKey(key)) {
    return NextResponse.json(
      { error: `Unexpected key: ${key}` },
      { status: 400 }
    );
  }

  try {
    await pressSessionKey(windowId, key);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'claudex desktop failed' },
      { status: 500 }
    );
  }
}
