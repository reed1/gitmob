import { NextRequest, NextResponse } from 'next/server';
import {
  closeTab,
  listTabs,
  navigateTab,
  openTab,
  reloadTab,
  stepTabHistory,
} from '@/lib/browser';

/**
 * The agent's Chrome, which is one browser for the whole desktop rather than a project's —
 * so this sits at the top of `/api` and takes no project id. Everything that changes what a
 * tab _is_ lives here; everything that drives one is `/browser/input`, which the duplicate
 * guard lets repeat.
 */

export async function GET() {
  try {
    return NextResponse.json({ tabs: await listTabs() });
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

export async function POST(request: NextRequest) {
  const { action, tab, url } = await request.json();

  try {
    if (action === 'open') {
      if (typeof url !== 'string' || !url) {
        return NextResponse.json({ error: 'Missing url' }, { status: 400 });
      }
      return NextResponse.json({ id: await openTab(url) });
    }

    if (action === 'navigate') {
      if (typeof url !== 'string' || !url) {
        return NextResponse.json({ error: 'Missing url' }, { status: 400 });
      }
      await navigateTab(tab ?? null, url);
      return NextResponse.json({ success: true });
    }

    if (action === 'close') {
      if (typeof tab !== 'string' || !tab) {
        return NextResponse.json({ error: 'Missing tab' }, { status: 400 });
      }
      await closeTab(tab);
      return NextResponse.json({ success: true });
    }

    if (action === 'back' || action === 'forward') {
      await stepTabHistory(tab ?? null, action);
      return NextResponse.json({ success: true });
    }

    if (action === 'reload') {
      await reloadTab(tab ?? null);
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
