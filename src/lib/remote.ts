import { execFile } from 'child_process';

export type PermissionMode = 'auto' | 'default' | 'bypassPermissions';

export const PERMISSION_MODES: readonly PermissionMode[] = [
  'auto',
  'default',
  'bypassPermissions',
];

export interface RemoteSession {
  unit: string;
  projectId: string;
  name: string;
  url: string | null;
  startedAt: number | null;
  active: boolean;
}

interface ClaudexRemoteRow {
  unit: string;
  project_id: string;
  name: string;
  url: string | null;
  started_at: number | null;
  active: boolean;
}

/**
 * `claudex remote` owns the headless sessions the way `claudex desktop` owns the windowed
 * ones: each is a transient systemd unit of its own, so they outlive this app's restarts and
 * there is no local record of them to keep in step.
 */
function claudexRemote(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claudex',
      ['remote', ...args],
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

function toSession(row: ClaudexRemoteRow): RemoteSession {
  return {
    unit: row.unit,
    projectId: row.project_id,
    name: row.name,
    url: row.url,
    startedAt: row.started_at,
    active: row.active,
  };
}

export async function listRemoteSessions(
  projectId: string
): Promise<RemoteSession[]> {
  const result: { sessions: ClaudexRemoteRow[] } = JSON.parse(
    await claudexRemote(['list', projectId])
  );
  return result.sessions.map(toSession);
}

export async function getRemoteCounts(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await claudexRemote(['count']));
  } catch {
    // The project list still has to render without systemd; the Claude tab reports why.
    return {};
  }
}

export async function startRemoteSession(
  projectId: string,
  permissionMode: PermissionMode
): Promise<RemoteSession> {
  return toSession(
    JSON.parse(
      await claudexRemote([
        'start',
        projectId,
        '--permission-mode',
        permissionMode,
      ])
    )
  );
}

export async function stopRemoteSession(unit: string): Promise<void> {
  await claudexRemote(['stop', unit]);
}
