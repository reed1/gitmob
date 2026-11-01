import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';

export const runtime = 'nodejs';

const IMAGE_DIRECTORY = '/tmp/rlocal/gitmob-images';

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get('image');
    if (
      !(image instanceof File) ||
      !image.type.startsWith('image/') ||
      image.size === 0
    ) {
      return NextResponse.json(
        { error: 'Select a non-empty image file' },
        { status: 400 }
      );
    }
    const name =
      basename(image.name).replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';
    const path = join(IMAGE_DIRECTORY, `${randomUUID()}-${name}`);
    await mkdir(IMAGE_DIRECTORY, { recursive: true });
    await writeFile(path, Buffer.from(await image.arrayBuffer()), {
      flag: 'wx',
      mode: 0o600,
    });
    return NextResponse.json({ path });
  } catch (error) {
    return errorResponse(request, error, 'Image upload failed');
  }
}
