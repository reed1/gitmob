import { NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';
import { Readable } from 'stream';
import { imageTypeFor } from './image-types';

/** Streams an image file with its own type, for an `<img>` to draw. */
export function imageResponse(fullPath: string): NextResponse {
  const type = imageTypeFor(fullPath);
  if (type === null) {
    return NextResponse.json({ error: 'Not an image' }, { status: 415 });
  }

  const stat = statSync(fullPath, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const body = Readable.toWeb(
    createReadStream(fullPath)
  ) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(body, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(stat.size),
      'Cache-Control': 'no-store',
      // An SVG opened on its own is a document that can run script; keep it inert.
      'Content-Security-Policy': 'sandbox',
    },
  });
}
