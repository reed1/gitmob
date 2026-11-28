import { execFile } from 'child_process';
import { getProjectsWithWorktrees, projectHolding } from './projects';
import type { Postcard } from './postcards';

interface ClaudexPostcard {
  id: string;
  session_id: string;
  cwd: string;
  created_at: string;
  caption: string;
  images: { file: string; path: string }[];
  seen_at: string | null;
}

function runClaudexPostcard(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claudex',
      ['postcard', ...args],
      { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

/** Newest first. */
export async function listPostcards(): Promise<Postcard[]> {
  const rows: ClaudexPostcard[] = JSON.parse(
    await runClaudexPostcard(['list'])
  );
  if (rows.length === 0) return [];
  const { projects } = await getProjectsWithWorktrees();
  return rows.map((row) => {
    const project = projectHolding(projects, row.cwd);
    return {
      id: row.id,
      sessionId: row.session_id,
      cwd: row.cwd,
      projectId: project?.id ?? null,
      canonicalProjectId: project?.canonicalId ?? null,
      worktreeName: project?.worktreeName ?? null,
      createdAt: row.created_at,
      caption: row.caption,
      images: row.images.map((image) => image.file),
      seen: row.seen_at !== null,
    };
  });
}

/** Where claudex keeps one of the postcard's images; null for a file it does not have. */
export async function postcardImagePath(
  id: string,
  file: string
): Promise<string | null> {
  const postcard: ClaudexPostcard = JSON.parse(
    await runClaudexPostcard(['show', id])
  );
  return postcard.images.find((image) => image.file === file)?.path ?? null;
}

export async function markPostcardsSeen(ids: string[]): Promise<void> {
  await runClaudexPostcard(['seen', ...ids]);
}
