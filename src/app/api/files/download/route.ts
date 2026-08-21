import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import { Readable } from 'stream';
import { resolveSharedPath } from '@/lib/shared-files';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  const full = resolveSharedPath(path);

  if (full === null) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const stat = statSync(full, { throwIfNoEntry: false });

  if (!stat) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  if (stat.isDirectory()) {
    return NextResponse.json(
      { error: 'Cannot download a folder' },
      { status: 422 }
    );
  }

  const body = Readable.toWeb(
    createReadStream(full)
  ) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(basename(full))}`,
    },
  });
}
