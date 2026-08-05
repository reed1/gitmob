export interface Project {
  id: string;
  path: string;
  tags?: string[];
  pinned?: boolean;
  urls?: Record<string, string>;
  editing: boolean;
  hasPendingMessage: boolean;
  hasRunningProcess: boolean;
  downSites: string[];
  envCheckFailed: boolean;
  sudoEnabled: boolean;
  claudeSessions: number;
  githubUrl: string | null;
}
