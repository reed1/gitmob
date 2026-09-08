export interface UsageWindow {
  usedPercentage: number | null;
  resetsAt: number | null;
}

export interface ClaudeUsage {
  todayCost: number;
  capturedAt: number | null;
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
}

/** The deployed build lagging behind HEAD: a restart rebuilds it. */
export interface StaleBuild {
  builtSha: string;
  headSha: string;
  behind: number | null;
}

export interface Project {
  id: string;
  canonicalId: string;
  worktreeName?: string;
  path: string;
  pinned?: boolean;
  repo?: string;
  urls?: Record<string, string>;
  /** Configured, but not on disk: nobody has cloned it here yet. */
  missing: boolean;
  branch: string | null;
  editing: boolean;
  hasPendingMessage: boolean;
  hasRunningProcess: boolean;
  downSites: string[];
  envCheckFailed: boolean;
  sudoEnabled: boolean;
  claudeSessions: number;
  /** Warning messages rworkspaces is holding against this project. */
  warnings: string[];
  githubUrl: string | null;
}
