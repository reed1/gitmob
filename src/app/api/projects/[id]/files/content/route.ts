import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { readFile, getLanguageFromPath } from '@/lib/files';
import { join } from 'path';
import { codeToHtml } from 'shiki';

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
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  const fullPath = join(project.path, filePath);
  const language = getLanguageFromPath(fullPath);

  try {
    const content = readFile(fullPath);
    const highlighted = await codeToHtml(content, {
      lang: language,
      theme: 'github-dark',
    });

    return NextResponse.json({
      content,
      highlighted,
      language,
      lineCount: content.split('\n').length,
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
