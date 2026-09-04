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
  /** A commit count or a duration like `2h`; null when the targets are chosen by hand. */
  scope: string | null;
}

export interface PushScope {
  files: string[];
  /** The targets the changed files picked, each with the files that picked it. */
  selected: Record<string, string[]>;
}

/** What pt says a selection would deploy: the servers and targets it resolves to. */
export interface PushResolution {
  servers: string[];
  targets: string[];
  limit: string;
  tags: string;
  /** null when not scoping. */
  scope: PushScope | null;
}

export const SCOPE_PATTERN = /^\d+[hmd]?$/;

/** The words a deploy is named with: the servers, then either the targets or the scope. */
function pushWords(selection: PushSelection): string[] {
  const words = [...selection.servers].sort();
  // Under a scope, pt picks the targets from what changed, so naming any would be an error.
  if (selection.scope === null) words.push(...[...selection.targets].sort());
  else words.push('scope', selection.scope);
  return words;
}

export function buildPushArgv(selection: PushSelection): string[] {
  return ['pt', 'push', ...pushWords(selection)];
}

/**
 * The same push, asked rather than run: pt resolves the words into the deploy it would do.
 * Under a scope the targets are pt's answer alone, so this is the only way to show them.
 *
 * `check` is a mode of its own rather than a flag on the push, so the line this tab sends on
 * every keystroke has nothing that could go missing and leave a deploy behind.
 */
export function buildCheckArgv(selection: PushSelection): string[] {
  return ['pt', 'push', 'check', ...pushWords(selection), '--json'];
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
