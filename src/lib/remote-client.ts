import { addToast, apiFetch } from './api';
import type { PermissionMode, RemoteSession } from './remote';

export type { PermissionMode, RemoteSession };

export const PERMISSION_MODE_OPTIONS: {
  value: PermissionMode;
  label: string;
}[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'default', label: 'Ask' },
  { value: 'bypassPermissions', label: 'Bypass' },
];

/**
 * The Claude Code Android app mishandles a session URL handed to it from outside, so we only
 * start the session. Flip this back on once that app is fixed.
 */
export const OPEN_REMOTE_SESSION_URL = false;

export async function launchRemoteSession(
  projectId: string,
  permissionMode: PermissionMode
): Promise<RemoteSession | null> {
  const res = await apiFetch(`/api/projects/${projectId}/remote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionMode }),
  });
  if (!res.ok) return null;

  const session: RemoteSession = await res.json();
  addToast(`Started ${session.name}`, 'success');
  if (OPEN_REMOTE_SESSION_URL && session.url) {
    window.open(session.url, '_blank');
  }
  return session;
}
