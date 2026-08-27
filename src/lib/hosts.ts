/**
 * GitMob and Pinboard are two installed apps on two hostnames differing only in their first
 * label — `gitmob.zerotail.r-mulyadi.com` and `pinboard.zerotail.r-mulyadi.com` — one portman
 * registration each, both proxied to this same server.
 *
 * Separate origins on purpose. Android gives every installed PWA its own app-level notification
 * permission while Chrome keeps one permission per origin, so two apps sharing an origin take
 * turns overwriting it: opening the one that was never granted the permission dropped the
 * other's push subscription along with it. Different origins have nothing to fight over.
 */
export type AppName = 'gitmob' | 'pinboard';

function splitPort(host: string): [string, string] {
  const colon = host.lastIndexOf(':');
  return colon === -1 ? [host, ''] : [host.slice(0, colon), host.slice(colon)];
}

/**
 * Which app a host serves, by the first label — the portman service name, the same on all five
 * fronts. Null means the name does not say: a dev host, localhost, an IP. Those keep serving
 * both apps, since nothing is installed from them.
 */
export function appForHost(host: string): AppName | null {
  const first = splitPort(host)[0].split('.')[0];
  if (first === 'gitmob') return 'gitmob';
  if (first === 'pinboard') return 'pinboard';
  return null;
}

/** The host the other app answers on, or null where the swap would be a guess. */
export function hostForApp(host: string, app: AppName): string | null {
  if (appForHost(host) === null) return null;
  const [hostname, port] = splitPort(host);
  const labels = hostname.split('.');
  labels[0] = app;
  return labels.join('.') + port;
}

/** Where an app's own root lives. */
export function homePath(app: AppName): string {
  if (app === 'gitmob') return '/app';
  if (app === 'pinboard') return '/pinboard';
  throw new Error(`Unexpected app: ${app}`);
}

/** Which app a path belongs to. Everything outside Pinboard's pages is GitMob's. */
export function appForPath(pathname: string): AppName {
  return pathname === '/pinboard' || pathname.startsWith('/pinboard/')
    ? 'pinboard'
    : 'gitmob';
}
