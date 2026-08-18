/**
 * The shape of a push and the argument line it turns into. Pure, so the Push tab can preview
 * the exact command it is about to run; `push.ts` reaches for child_process and cannot be
 * imported by a client component.
 */

export interface PushServer {
  name: string;
  ssh: string;
  path: string | null;
}

export interface PushConfig {
  servers: PushServer[];
  /** What pt would pick with no server named — the only one, or `dev`, or nothing. */
  defaultServers: string[];
  targets: string[];
  /** The `push_scope` keys; empty when the project has no block and `scope` is unavailable. */
  scopeTargets: string[];
}

export interface PushSelection {
  servers: string[];
  targets: string[];
  /** A commit count or a duration like `2h`; null when not scoping. */
  scope: string | null;
}

export const SCOPE_PATTERN = /^\d+[hmd]?$/;

export function buildPushArgv(selection: PushSelection): string[] {
  const argv = ['pt', 'push', ...[...selection.servers].sort()];
  // Under a scope, pt picks the targets from what changed, so naming any would be ignored.
  if (selection.scope === null) argv.push(...[...selection.targets].sort());
  else argv.push('scope', selection.scope);
  return argv;
}

/** The reason this selection cannot be pushed, or null when it can. */
export function checkSelection(
  config: PushConfig,
  selection: PushSelection
): string | null {
  const serverNames = config.servers.map((s) => s.name);
  const unknownServer = selection.servers.find((s) => !serverNames.includes(s));
  if (unknownServer) return `Unknown server: ${unknownServer}`;
  if (selection.servers.length === 0) return 'No server selected';

  const unknownTarget = selection.targets.find(
    (t) => !config.targets.includes(t)
  );
  if (unknownTarget) return `Unknown target: ${unknownTarget}`;

  if (selection.scope !== null) {
    if (config.scopeTargets.length === 0) {
      return 'This project has no push_scope block to scope against';
    }
    if (!SCOPE_PATTERN.test(selection.scope)) {
      return `Invalid scope: ${selection.scope}`;
    }
  }

  return null;
}
