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

  const { searchParams } = request.nextUrl;
  const commit = searchParams.get('commit');
  if (commit !== null && !/^[0-9a-f]{4,64}$/.test(commit)) {
    return NextResponse.json({ error: 'Invalid commit' }, { status: 400 });
  }

  const force = searchParams.get('force') === '1';
  return NextResponse.json(await getReview(project.path, force, commit));
}
