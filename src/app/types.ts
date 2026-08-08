export interface Project {
  id: string;
  canonicalId: string;
  worktreeName?: string;
  path: string;
  pinned?: boolean;
  urls?: Record<string, string>;
  branch: string | null;
  editing: boolean;
  hasPendingMessage: boolean;
  hasRunningProcess: boolean;
  downSites: string[];
  envCheckFailed: boolean;
  sudoEnabled: boolean;
  claudeSessions: number;
  githubUrl: string | null;
}
