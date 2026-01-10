import simpleGit, { SimpleGit, StatusResult } from 'simple-git';

export interface GitStatus {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
}

export interface FileChange {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?';
}

function getGit(cwd: string): SimpleGit {
  return simpleGit(cwd);
}

function mapStatus(index: string): FileChange['status'] {
  const map: Record<string, FileChange['status']> = {
    M: 'M',
    A: 'A',
    D: 'D',
    R: 'R',
    C: 'C',
    U: 'U',
    '?': '?',
  };
  return map[index] || 'M';
}

export async function getStatus(cwd: string): Promise<GitStatus> {
  const git = getGit(cwd);
  const status: StatusResult = await git.status();

  const staged: FileChange[] = [];
  const unstaged: FileChange[] = [];
  const untracked: string[] = status.not_added;

  for (const file of status.staged) {
    staged.push({ path: file, status: 'A' });
  }

  for (const file of status.modified) {
    if (status.staged.includes(file)) {
      continue;
    }
    unstaged.push({ path: file, status: 'M' });
  }

  for (const file of status.deleted) {
    if (status.staged.includes(file)) {
      continue;
    }
    unstaged.push({ path: file, status: 'D' });
  }

  for (const file of status.renamed) {
    staged.push({ path: file.to, status: 'R' });
  }

  for (const file of status.files) {
    const inStaged = staged.some((s) => s.path === file.path);
    const inUnstaged = unstaged.some((u) => u.path === file.path);
    const inUntracked = untracked.includes(file.path);

    if (!inStaged && !inUnstaged && !inUntracked) {
      if (file.index !== ' ' && file.index !== '?') {
        staged.push({ path: file.path, status: mapStatus(file.index) });
      }
      if (file.working_dir !== ' ' && file.working_dir !== '?') {
        unstaged.push({ path: file.path, status: mapStatus(file.working_dir) });
      }
    }
  }

  return { staged, unstaged, untracked };
}

export async function getDiff(
  cwd: string,
  staged: boolean = false
): Promise<string> {
  const git = getGit(cwd);
  if (staged) {
    return git.diff(['--cached']);
  }
  return git.diff();
}

export async function getFileDiff(
  cwd: string,
  filePath: string,
  staged: boolean = false
): Promise<string> {
  const git = getGit(cwd);

  if (staged) {
    const diff = await git.diff(['--cached', '--', filePath]);
    if (diff.trim()) {
      return diff;
    }
    const content = await git.show([`:${filePath}`]).catch(() => null);
    if (content !== null) {
      const lines = content.split('\n');
      return [
        `diff --git a/${filePath} b/${filePath}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/${filePath}`,
        `@@ -0,0 +1,${lines.length} @@`,
        ...lines.map((line) => '+' + line),
      ].join('\n');
    }
    return '';
  }
  return git.diff(['--', filePath]);
}

export async function stageFile(cwd: string, filePath: string): Promise<void> {
  const git = getGit(cwd);
  await git.add(filePath);
}

export async function unstageFile(
  cwd: string,
  filePath: string
): Promise<void> {
  const git = getGit(cwd);
  await git.reset(['HEAD', '--', filePath]);
}

export async function discardChanges(
  cwd: string,
  filePath: string
): Promise<void> {
  const git = getGit(cwd);
  await git.checkout(['--', filePath]);
}

export async function commit(cwd: string, message: string): Promise<string> {
  const git = getGit(cwd);
  const result = await git.commit(message);
  return `[${result.branch} ${result.commit}] ${message}`;
}

export async function pull(cwd: string): Promise<string> {
  const git = getGit(cwd);
  const result = await git.pull();
  if (result.summary.changes === 0 && result.summary.insertions === 0) {
    return 'Already up to date.';
  }
  return `Updated: ${result.summary.changes} files, +${result.summary.insertions}/-${result.summary.deletions}`;
}

export async function push(cwd: string): Promise<string> {
  const git = getGit(cwd);
  const result = await git.push();
  if (result.pushed.length === 0) {
    return 'Everything up-to-date';
  }
  return `Pushed ${result.pushed.length} ref(s)`;
}

export async function getBranch(cwd: string): Promise<string> {
  const git = getGit(cwd);
  const status = await git.status();
  return status.current || 'HEAD';
}

export async function getLog(cwd: string, count: number = 10): Promise<string> {
  const git = getGit(cwd);
  const log = await git.log({ maxCount: count });
  return log.all
    .map((entry) => `${entry.hash.slice(0, 7)} ${entry.message}`)
    .join('\n');
}

export async function hasChanges(cwd: string): Promise<boolean> {
  const git = getGit(cwd);
  const status = await git.status();
  return (
    status.staged.length > 0 ||
    status.modified.length > 0 ||
    status.deleted.length > 0 ||
    status.renamed.length > 0 ||
    status.not_added.length > 0 ||
    status.files.length > 0
  );
}
