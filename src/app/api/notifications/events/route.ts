import { NextRequest, NextResponse } from 'next/server';
import { logEvent } from '@/lib/notifications';

/**
 * What the browser saw, written into the same trail as what the server saw. A dropped
 * subscription leaves no trace on this machine — the page and the service worker are the only
 * witnesses, and the service worker has nowhere else to say it.
 *
 * A fixed set of names, so this stays a report of known states rather than a log anyone can
 * write anything into.
 */
const CLIENT_EVENTS = [
  'boot-state',
  'subscription-change',
  'subscription-change-failed',
  'push-received',
];

export async function POST(request: NextRequest) {
  const { event, detail } = await request.json();

  if (!CLIENT_EVENTS.includes(event)) {
    return NextResponse.json({ error: 'unknown event' }, { status: 400 });
  }

  logEvent(event, {
    source: 'client',
    ...(detail && typeof detail === 'object' ? detail : {}),
  });

  return NextResponse.json({ success: true });
}
