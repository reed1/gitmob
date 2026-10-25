import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { getProject } from '@/lib/projects';
import { getDesktopState } from '@/lib/workspaces';
import { readHold } from '@/lib/gg-hold';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { openIds } = await getDesktopState();

  return NextResponse.json({
    ...project,
    missing: !existsSync(project.path),
    openOnDesktop: openIds.includes(id),
    hold: readHold(project.path),
  });
}
