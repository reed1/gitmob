import type { CustomModel } from './desktop-models';
import { addToast, apiFetch } from './api';
import { projectApiPath } from './project-paths';

/**
 * Starts a session and answers with the project it landed on, or null when it failed. With a
 * branch that is a new worktree of the project, created before the session opens in it.
 */
export async function launchDesktopSession(
  projectId: string,
  launch: {
    provider: string;
    prompt: string;
    branch: string;
    customModel: CustomModel;
    browser: boolean;
  }
): Promise<string | null> {
  const res = await apiFetch(`${projectApiPath(projectId)}/desktop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'launch',
      ...launch,
    }),
  });
  if (!res.ok) return null;

  const { name, projectId: launchedIn } = await res.json();
  addToast(`Started ${name}`, 'success');
  return launchedIn;
}
