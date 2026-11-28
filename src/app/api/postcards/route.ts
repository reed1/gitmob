import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { listPostcards, markPostcardsSeen } from '@/lib/claudex-postcards';
import { isPostcardId } from '@/lib/postcards';

/** Every postcard, newest first; `?session=` narrows them to one session's. */
export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get('session');
  try {
    const postcards = await listPostcards();
    return NextResponse.json({
      postcards: session
        ? postcards.filter((postcard) => postcard.sessionId === session)
        : postcards,
    });
  } catch (err) {
    return errorResponse(request, err, 'claudex postcard failed');
  }
}

export async function POST(request: NextRequest) {
  const { seen } = await request.json();
  if (!Array.isArray(seen) || seen.length === 0 || !seen.every(isPostcardId)) {
    return NextResponse.json(
      { error: 'Unexpected postcards' },
      { status: 400 }
    );
  }

  try {
    await markPostcardsSeen(seen);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(request, err, 'claudex postcard failed');
  }
}
