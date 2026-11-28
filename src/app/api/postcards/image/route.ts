import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { imageResponse } from '@/lib/image-response';
import { postcardImagePath } from '@/lib/claudex-postcards';
import { isPostcardId } from '@/lib/postcards';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const file = request.nextUrl.searchParams.get('file');
  if (!isPostcardId(id) || !file) {
    return NextResponse.json({ error: 'Unexpected image' }, { status: 400 });
  }

  try {
    const path = await postcardImagePath(id, file);
    if (path === null) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    return imageResponse(path);
  } catch (err) {
    return errorResponse(request, err, 'claudex postcard failed');
  }
}
