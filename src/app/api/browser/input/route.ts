import { NextRequest, NextResponse } from 'next/server';
import { clickTab, pressTabKey, scrollTab, typeIntoTab } from '@/lib/browser';
import { isBrowserKey } from '@/lib/browser-keys';

/**
 * Driving a tab — taps, scrolls, keys, typed text — on a URL of its own so the duplicate guard
 * can let it repeat by path, the same reason `/desktop/keys` has one. A finger is a keyboard
 * and a mouse: tapping the same button twice, or pressing Down twice, is one request sent
 * twice with nothing in it to tell the second from a resend of the first. Opening and closing
 * tabs stays on `/api/browser`, where a repeat is a second tab and must still be caught.
 */
export async function POST(request: NextRequest) {
  const { action, tab, x, y, dx, dy, count, text, key } = await request.json();
  const target = typeof tab === 'string' && tab ? tab : null;

  try {
    if (action === 'click') {
      if (typeof x !== 'number' || typeof y !== 'number') {
        return NextResponse.json({ error: 'Missing point' }, { status: 400 });
      }
      await clickTab(target, x, y, count === 2 ? 2 : 1);
      return NextResponse.json({ success: true });
    }

    if (action === 'scroll') {
      if (typeof x !== 'number' || typeof y !== 'number') {
        return NextResponse.json({ error: 'Missing point' }, { status: 400 });
      }
      await scrollTab(target, x, y, dx ?? 0, dy ?? 0);
      return NextResponse.json({ success: true });
    }

    if (action === 'text') {
      if (typeof text !== 'string' || !text) {
        return NextResponse.json({ error: 'Missing text' }, { status: 400 });
      }
      await typeIntoTab(target, text);
      return NextResponse.json({ success: true });
    }

    if (action === 'key') {
      if (!isBrowserKey(key)) {
        return NextResponse.json(
          { error: `Unexpected key: ${key}` },
          { status: 400 }
        );
      }
      await pressTabKey(target, key);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Unexpected action: ${action}` },
      { status: 400 }
    );
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
