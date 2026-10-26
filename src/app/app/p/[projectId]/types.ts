export interface Project {
  id: string;
  canonicalId: string;
  worktreeName?: string;
  path: string;
  repo?: string;
  /** Configured, but not on disk: nobody has cloned it here yet. */
  missing: boolean;
  /** Open on the desktop right now: its IDE and terminals are up. */
  openOnDesktop: boolean;
  /** Rewinds `gg hold` recorded while holding autopush and auto-pull; null when not held. */
  hold: string[] | null;
  urls?: Record<string, string>;
  push?: Record<string, { ssh: string; path?: string }>;
}

export interface GitStatus {
  staged: { path: string; status: string; partiallyStaged?: boolean }[];
  unstaged: { path: string; status: string }[];
  untracked: string[];
}
