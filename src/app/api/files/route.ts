import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync } from 'fs';
import { rm, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import {
  SHARED_FILES_DIR,
  listSharedFiles,
  resolveSharedPath,
} from '@/lib/shared-files';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';

  if (resolveSharedPath(path) === null) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  return NextResponse.json({
    root: SHARED_FILES_DIR,
    path,
    entries: listSharedFiles(path),
  });
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const dir = resolveSharedPath(path);

  if (dir === null) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const form = await request.formData();
  const uploads = form.getAll('files').filter((f) => f instanceof File);

  if (uploads.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  mkdirSync(dir, { recursive: true });

  const names: string[] = [];
  for (const upload of uploads) {
    // Browsers can send a relative path as the name for directory uploads; keep the leaf only.
    const name = basename(upload.name);
    if (!name || name === '.' || name === '..') {
      return NextResponse.json(
        { error: `Invalid file name: ${upload.name}` },
        { status: 400 }
      );
    }
    await writeFile(join(dir, name), Buffer.from(await upload.arrayBuffer()));
    names.push(name);
  }

  return NextResponse.json({ uploaded: names });
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const target = resolveSharedPath(path);

  if (target === null || target === SHARED_FILES_DIR) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  await rm(target, { recursive: true });

  return NextResponse.json({ deleted: basename(target) });
}
