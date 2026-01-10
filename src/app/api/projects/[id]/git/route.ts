import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import {
  getStatus,
  getDiff,
  getFileDiff,
  getBranch,
  getLog,
  getDiffSummary,
  stageFile,
  unstageFile,
  discardChanges,
  commit,
  pull,
  push,
} from '@/lib/git';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'status';

  switch (action) {
    case 'status':
      return NextResponse.json(await getStatus(project.path));
    case 'diff': {
      const staged = searchParams.get('staged') === 'true';
      const file = searchParams.get('file');
      const diff = file
        ? await getFileDiff(project.path, file, staged)
        : await getDiff(project.path, staged);
      return NextResponse.json({ diff });
    }
    case 'branch':
      return NextResponse.json({ branch: await getBranch(project.path) });
    case 'log': {
      const count = parseInt(searchParams.get('count') || '10', 10);
      return NextResponse.json({ log: await getLog(project.path, count) });
    }
    case 'diff-summary':
      return NextResponse.json({ summary: getDiffSummary(project.path) });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'stage':
      await stageFile(project.path, body.file);
      return NextResponse.json({ success: true });
    case 'unstage':
      await unstageFile(project.path, body.file);
      return NextResponse.json({ success: true });
    case 'discard':
      await discardChanges(project.path, body.file);
      return NextResponse.json({ success: true });
    case 'commit': {
      const result = await commit(project.path, body.message);
      return NextResponse.json({ success: true, result });
    }
    case 'pull': {
      const result = await pull(project.path);
      return NextResponse.json({ success: true, result });
    }
    case 'push': {
      const result = await push(project.path);
      return NextResponse.json({ success: true, result });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
