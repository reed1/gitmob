import { NextRequest, NextResponse } from 'next/server';
import { appForHost, appForPath, homePath, hostForApp } from '@/lib/hosts';

/**
 * Keeps each app on its own hostname. One server answers both, so without this every page is
 * reachable on either origin — and a Pinboard installed from GitMob's hostname is the whole bug
 * back again, since the install, not the visit, is what claims the origin's notification
 * permission.
 *
 * `/api` is deliberately not matched: both apps call it on their own origin.
 */
export const config = {
  matcher: ['/', '/app', '/app/:path*', '/pinboard', '/pinboard/:path*'],
};

export default function proxy(request: NextRequest) {
  const host = request.headers.get('host');
  if (host === null) return NextResponse.next();

  const serves = appForHost(host);
  if (serves === null) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const scheme =
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(':', '');

  if (pathname === '/') {
    return NextResponse.redirect(`${scheme}://${host}${homePath(serves)}`);
  }

  const wants = appForPath(pathname);
  if (wants === serves) return NextResponse.next();

  const elsewhere = hostForApp(host, wants);
  if (elsewhere === null) return NextResponse.next();

  return NextResponse.redirect(`${scheme}://${elsewhere}${pathname}${search}`);
}
