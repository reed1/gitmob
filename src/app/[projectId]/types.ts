export interface Project {
  id: string;
  canonicalId: string;
  worktreeName?: string;
  path: string;
  tags?: string[];
  urls?: Record<string, string>;
  push?: Record<string, { ssh: string; path?: string }>;
  githubUrl: string | null;
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
  | 'claude'
  | 'sudo';
