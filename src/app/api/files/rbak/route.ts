import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { listSharedFiles, resolveSharedPath } from '@/lib/shared-files';

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const dir = resolveSharedPath(path);

  if (dir === null) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const targets = listSharedFiles(path).map((entry) => `${dir}/${entry.name}`);
  if (targets.length === 0) {
    return NextResponse.json({ error: 'Nothing to move' }, { status: 400 });
  }

  const error = await new Promise<string | null>((resolve) => {
    execFile(
      'rbak',
      ['move', ...targets],
      { timeout: 120000 },
      (err, _stdout, stderr) => {
        resolve(err ? stderr.trim() || err.message : null);
      }
    );
  });

  if (error !== null) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ moved: targets.length });
}
