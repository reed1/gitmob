import { addToast, apiFetch } from './api';
import type { DesktopMode } from './desktop-modes';

/**
 * Starts a session and answers with the project it landed on, or null when it failed. With a
 * branch that is a new worktree of the project, created before the session opens in it.
 */
export async function launchDesktopSession(
  projectId: string,
  mode: DesktopMode,
  prompt = '',
  branch = ''
): Promise<string | null> {
  const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'launch', mode, prompt, branch }),
  });
  if (!res.ok) return null;

  const { name, projectId: launchedIn } = await res.json();
  addToast(`Started ${name}`, 'success');
  return launchedIn;
}
