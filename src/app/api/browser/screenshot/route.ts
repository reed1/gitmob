import { NextRequest, NextResponse } from 'next/server';
import { captureTab } from '@/lib/browser';

/**
 * One frame of a tab, as a JPEG sized in CSS pixels — so where the page was tapped is already
 * the coordinate `/browser/input` wants, with no scaling in between.
 *
 * What the frame is _of_ rides back in headers rather than costing a second call: the page
 * needs the tab's url and title beside every frame to keep its address bar honest, and the id
 * because a poll with no tab named follows whichever tab Chrome has in front.
 */
export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get('tab');

  try {
    const shot = await captureTab(tab);
    return new NextResponse(new Uint8Array(shot.jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
        'X-Browser-Tab': shot.id,
        // Percent-encoded: a header is Latin-1, and a page title is whatever the page says.
        'X-Browser-Url': encodeURIComponent(shot.url),
        'X-Browser-Title': encodeURIComponent(shot.title),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'claude-in-chrome cdp failed',
      },
      { status: 500 }
    );
  }
}
