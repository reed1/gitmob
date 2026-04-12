import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { getLanguageFromPath } from '@/lib/files';
import { join } from 'path';
import { statSync } from 'fs';
import { execFileSync } from 'child_process';
import { readFile } from 'fs/promises';
import { codeToHtml } from 'shiki';

const MAX_FILE_SIZE = 1_000_000;

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

  try {
    const stat = statSync(fullPath);

    if (stat.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Cannot preview file larger than 1 MB' },
        { status: 422 }
      );
    }

    const mime = execFileSync('file', ['--brief', '--mime', fullPath], {
      encoding: 'utf-8',
    }).trim();
    if (mime.includes('charset=binary')) {
      return NextResponse.json(
        { error: 'Cannot preview binary file' },
        { status: 422 }
      );
    }

    const content = await readFile(fullPath, 'utf-8');
    const language = getLanguageFromPath(fullPath);
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
  } catch (err) {
    if (err instanceof Error && 'status' in err) throw err;
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
