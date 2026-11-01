import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { getProject } from '@/lib/projects';
import { releaseHold } from '@/lib/gg-hold';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    await releaseHold(project.path);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(request, err, 'gg hold release failed');
  }
}
