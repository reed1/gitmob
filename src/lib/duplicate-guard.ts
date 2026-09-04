import { NextRequest, NextResponse } from 'next/server';

/**
 * A request that was sent twice must only run once.
 *
 * The phone's connection is not reliable, and a browser that loses one mid-POST resends it byte
 * for byte. The resend happens below `fetch`, so the client never hears about it or can hold it
 * back — what arrives is a second `claudex kitty`, a second commit, a second push, a second
 * `npm run build`. None of those are safe to repeat.
 *
 * The guard sits in the proxy rather than in the handlers, so it covers `/api` by the shape of a
 * request instead of by every endpoint remembering to opt in, and a new endpoint is guarded the
 * day it is written. Non-GET only. The last five requests that got through are remembered — one
 * history for the whole API, not one per URL — and a sixth matching any of them is answered 400.
 *
 * A resend is recognised by being identical: same method, path, query and body. Nothing in that
 * separates it from a repeat that was meant, so the match only holds for a couple of seconds. A
 * connection that dies on the way out is resent at once, while a second tap is slower than that.
 */

const HISTORY_SIZE = 5;
const WINDOW_MS = 2000;

/**
 * The endpoints that are meant to be called twice with the same body. Send Keys is a keyboard,
 * and a keyboard repeats: pressing Down twice is one request sent twice, and the second press is
 * not a resend of the first. It has a URL of its own for exactly this — so the exemption can be
 * read off the path, rather than guessed at by looking inside the body of a shared endpoint.
 */
const REPEATABLE = ['/desktop/keys'];

interface Submission {
  key: string;
  at: number;
}

const submissions: Submission[] = [];

/**
 * Hashed rather than kept: an upload's body is megabytes, and five of those held for two seconds
 * is memory this does not need. Over the bytes, not the text — decoding would let two different
 * files compare equal.
 */
async function fingerprint(
  request: NextRequest,
  body: ArrayBuffer
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', body);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  const { pathname, search } = request.nextUrl;
  return `${request.method} ${pathname}${search} ${hex}`;
}

/** The 400 to answer with, or null when this request is the first of its kind. */
export async function resentRequest(
  request: NextRequest
): Promise<NextResponse | null> {
  if (request.method === 'GET' || request.method === 'HEAD') return null;

  const { pathname } = request.nextUrl;
  if (REPEATABLE.some((route) => pathname.endsWith(route))) return null;

  // Reading the body here costs the handler nothing: Next hands it the original request, not the
  // one the proxy drained.
  const key = await fingerprint(request, await request.arrayBuffer());
  const now = Date.now();

  if (submissions.some((s) => s.key === key && now - s.at < WINDOW_MS)) {
    return NextResponse.json(
      {
        error: 'Duplicate request — this one has already been sent',
        duplicate: true,
      },
      { status: 400 }
    );
  }

  // Recorded before the request is let through, not after: the resend of one whose response was
  // lost arrives while the first is still working, which is exactly when it must lose.
  submissions.push({ key, at: now });
  if (submissions.length > HISTORY_SIZE) submissions.shift();

  return null;
}
