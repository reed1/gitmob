import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { getReview } from '@/lib/review';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const force = request.nextUrl.searchParams.get('force') === '1';
  return NextResponse.json(await getReview(project.path, force));
}
