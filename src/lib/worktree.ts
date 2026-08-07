/**
 * A worktree's local url carries the worktree's name, so the checkouts of one project do not
 * all answer on the same host. The rule belongs to the shared python library
 * `rlocal/lib/python/rworktree`, which this app is the one consumer of that cannot import it.
 *
 * How a worktree project is *named* is not restated here: rworkspaces publishes the name and
 * the project it belongs to alongside the id, so nothing in this app takes an id apart.
 */

// The worktree name attaches to the domain label, leaving subdomains and TLD untouched:
// sisdur.dit.krisna.loc -> sisdur.dit.krisna-next-bs5.loc
function modifyHostWithWorktree(host: string, worktreeName: string): string {
  const parts = host.split('.');
  if (parts.length === 1) return `${host}-${worktreeName}`;

  const tld = parts[parts.length - 1];
  const domain = parts[parts.length - 2];
  const subdomains = parts.slice(0, -2);
  return [...subdomains, `${domain}-${worktreeName}`, tld].join('.');
}

// Only the host is spliced, rather than rebuilding through URL, which would append a path
// to the host-only urls these configs are full of: http://krisna.loc -> http://krisna.loc/
const URL_HOST = /^([a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?)([^:/?#]+)/i;

/** http://krisna.loc -> http://krisna-next-bs5.loc */
export function modifyUrlWithWorktree(
  url: string,
  worktreeName: string
): string {
  return url.replace(
    URL_HOST,
    (_, prefix, host) => prefix + modifyHostWithWorktree(host, worktreeName)
  );
}
