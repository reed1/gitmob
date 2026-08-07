import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  PERMISSION_MODES,
  PermissionMode,
  listRemoteSessions,
  startRemoteSession,
  stopRemoteSession,
} from '@/lib/remote';

function failed(err: unknown) {
  return NextResponse.json(
    { error: err instanceof Error ? err.message : 'claudex remote failed' },
    { status: 500 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getProject(id))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    return NextResponse.json({ sessions: await listRemoteSessions(id) });
  } catch (err) {
    return failed(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getProject(id))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { permissionMode } = await request.json();
  if (!PERMISSION_MODES.includes(permissionMode)) {
    return NextResponse.json(
      { error: `Unknown permission mode: ${permissionMode}` },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await startRemoteSession(id, permissionMode as PermissionMode)
    );
  } catch (err) {
    return failed(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getProject(id))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const unit = request.nextUrl.searchParams.get('unit');
  if (!unit) {
    return NextResponse.json({ error: 'Missing unit' }, { status: 400 });
  }

  try {
    await stopRemoteSession(unit);
  } catch (err) {
    return failed(err);
  }

  return NextResponse.json({ success: true });
}
