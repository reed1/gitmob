import { addToast, apiFetch } from './api';
import type { ClaudeMode } from './desktop-modes';

export async function launchDesktopSession(
  projectId: string,
  mode: ClaudeMode
): Promise<boolean> {
  const res = await apiFetch(`/api/projects/${projectId}/desktop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'launch', mode }),
  });
  if (!res.ok) return false;

  const { name } = await res.json();
  addToast(`Started ${name}`, 'success');
  return true;
}
