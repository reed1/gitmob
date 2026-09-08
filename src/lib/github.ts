import simpleGit from 'simple-git';
import { existsSync } from 'fs';

const REMOTE_PREFERENCE = ['origin', 'personal'];

const GITHUB_REMOTE =
  /^(?:(?:https?|ssh|git):\/\/)?(?:[^@/]+@)?github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

function parseGithubRepo(url: string): string | null {
  const match = url.match(GITHUB_REMOTE);
  return match ? match[1] : null;
}

export async function getGithubRepoUrl(cwd: string): Promise<string | null> {
  // simple-git throws on construction when the checkout is missing — a configured project
  // nobody has cloned yet must not take the whole project list down with it.
  if (!existsSync(cwd)) return null;

  const remotes = await simpleGit(cwd)
    .getRemotes(true)
    .catch(() => []);

  for (const name of REMOTE_PREFERENCE) {
    const remote = remotes.find((r) => r.name === name);
    const repo = remote && parseGithubRepo(remote.refs.fetch);
    if (repo) return `https://github.com/${repo}`;
  }
  return null;
}
