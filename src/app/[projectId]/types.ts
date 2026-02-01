export interface Project {
  id: string;
  path: string;
  tags?: string[];
}

export interface GitStatus {
  staged: { path: string; status: string }[];
  unstaged: { path: string; status: string }[];
  untracked: string[];
}

export type Tab = 'files' | 'changes' | 'actions' | 'process' | 'cli' | 'dooit';
