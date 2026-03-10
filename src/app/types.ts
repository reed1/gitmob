export interface Project {
  id: string;
  path: string;
  tags?: string[];
  urls?: Record<string, string>;
  editing: boolean;
  hasPendingMessage: boolean;
  hasRunningProcess: boolean;
  downSites: string[];
}
