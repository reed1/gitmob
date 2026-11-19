/**
 * A session's input box `claudex edit-remote` handed here instead of to nvim. Claude Code's
 * external editor stays open on it, so the session cannot be typed into at the desk until it
 * goes back, saved into the box or submitted. `claudex desktop` hands them out and takes the
 * text back (`src/lib/desktop.ts`).
 */
export interface PendingEdit {
  id: string;
  windowId: string;
  /** The project whose workspace holds the window, a worktree under its own id. */
  projectId: string | null;
  canonicalProjectId: string | null;
  cwd: string;
  createdAt: string;
  text: string;
}
