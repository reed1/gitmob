import simpleGit from 'simple-git';

const REMOTE_PREFERENCE = ['origin', 'personal'];

const GITHUB_REMOTE =
  /^(?:(?:https?|ssh|git):\/\/)?(?:[^@/]+@)?github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

function parseGithubRepo(url: string): string | null {
  const match = url.match(GITHUB_REMOTE);
  return match ? match[1] : null;
}

export async function getGithubRepoUrl(cwd: string): Promise<string | null> {
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
