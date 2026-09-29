import { NextRequest, NextResponse } from 'next/server';
import { resolveSharedPath } from '@/lib/shared-files';
import { imageResponse } from '@/lib/image-response';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  const full = resolveSharedPath(path);

  if (full === null) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  return imageResponse(full);
}
