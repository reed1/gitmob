/**
 * Images with a caption a Claude Code session sent with `claudex postcard`, for the user to look
 * at here. claudex keeps them and whether each was seen; it knows only the session's cwd, so the
 * project and worktree are looked up here, as questions' are.
 */
export interface Postcard {
  id: string;
  sessionId: string;
  cwd: string;
  /** The checkout holding the cwd, a worktree's own id for a worktree, if any checkout does. */
  projectId: string | null;
  canonicalProjectId: string | null;
  worktreeName: string | null;
  createdAt: string;
  caption: string;
  /** File names, in the order the session gave them; `postcardImageUrl` serves each. */
  images: string[];
  seen: boolean;
}

/** Summary `claudex desktop screen --json` carries for a window's session. */
export interface SessionPostcards {
  count: number;
  unseen: number;
}

/** claudex names the postcard's directory after its id, so anything else would be a path. */
export function isPostcardId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{8}-\d{6}-[0-9a-f]{6}$/.test(value);
}

export function postcardImageUrl(id: string, file: string): string {
  return `/api/postcards/image?id=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`;
}
