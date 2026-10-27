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
 * A project's agent Chrome, named by `project` on every call. It sits at the top of `/api`
 * rather than under a project's routes because the page picks among the Chromes running, not
 * among projects. Everything that changes what a tab _is_ lives here; everything that drives
 * one is `/browser/input`, which the duplicate guard lets repeat.
 */

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project');
  if (!project) return missingProject();

  try {
    return NextResponse.json({ tabs: await listTabs(project) });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'rv chrome cdp failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { action, project, tab, url } = await request.json();
  if (typeof project !== 'string' || !project) return missingProject();

  try {
    if (action === 'open') {
      if (typeof url !== 'string' || !url) {
        return NextResponse.json({ error: 'Missing url' }, { status: 400 });
      }
      return NextResponse.json({ id: await openTab(project, url) });
    }

    if (action === 'navigate') {
      if (typeof url !== 'string' || !url) {
        return NextResponse.json({ error: 'Missing url' }, { status: 400 });
      }
      await navigateTab(project, tab ?? null, url);
      return NextResponse.json({ success: true });
    }

    if (action === 'close') {
      if (typeof tab !== 'string' || !tab) {
        return NextResponse.json({ error: 'Missing tab' }, { status: 400 });
      }
      await closeTab(project, tab);
      return NextResponse.json({ success: true });
    }

    if (action === 'back' || action === 'forward') {
      await stepTabHistory(project, tab ?? null, action);
      return NextResponse.json({ success: true });
    }

    if (action === 'reload') {
      await reloadTab(project, tab ?? null);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Unexpected action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'rv chrome cdp failed',
      },
      { status: 500 }
    );
  }
}

function missingProject() {
  return NextResponse.json({ error: 'Missing project' }, { status: 400 });
}
