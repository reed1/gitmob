import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { getProject } from '@/lib/projects';
import { imageResponse } from '@/lib/image-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const filePath = request.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  return imageResponse(join(project.path, filePath));
}
