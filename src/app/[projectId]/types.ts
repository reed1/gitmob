export interface Project {
  id: string;
  path: string;
  tags?: string[];
  urls?: Record<string, string>;
  push?: Record<string, { ssh: string; path?: string }>;
}

export interface GitStatus {
  staged: { path: string; status: string }[];
  unstaged: { path: string; status: string }[];
  untracked: string[];
}

export type Tab =
  | 'files'
  | 'changes'
  | 'actions'
  | 'run'
  | 'cli'
  | 'dooit'
  | 'desktop'
  | 'sudo';
