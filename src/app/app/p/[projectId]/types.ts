export interface Project {
  id: string;
  canonicalId: string;
  worktreeName?: string;
  path: string;
  urls?: Record<string, string>;
  push?: Record<string, { ssh: string; path?: string }>;
  githubUrl: string | null;
}

export interface GitStatus {
  staged: { path: string; status: string; partiallyStaged?: boolean }[];
  unstaged: { path: string; status: string }[];
  untracked: string[];
}

export type Tab =
  | 'pinboard'
  | 'files'
  | 'changes'
  | 'commit'
  | 'run'
  | 'cli'
  | 'dooit'
  | 'claude'
  | 'push'
  | 'sudo';
