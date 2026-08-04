import { execFile } from 'child_process';

export interface DesktopSession {
  windowId: string;
  title: string;
  workspace: string;
  projectId: string;
  focused: boolean;
  sessionId: string | null;
  cwd: string | null;
}

interface ClaudexSessionRow {
  window_id: string;
  title: string;
  workspace: string;
  project_id: string;
  focused: boolean;
  session_id: string | null;
  listen_on: string | null;
  cwd: string | null;
}

interface ClaudexListResult {
  workspaces: string[];
  sessions: ClaudexSessionRow[];
}

/**
 * `claudex desktop` is the only way this app reaches the desktop — claudex owns the session
 * registry, the kitty remote sockets and the i3 lookup that says which windows are still there.
 */
function claudexDesktop(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claudex',
      ['desktop', ...args],
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

export async function listDesktopSessions(projectId: string): Promise<{
  workspaces: string[];
  sessions: DesktopSession[];
}> {
  const result: ClaudexListResult = JSON.parse(
    await claudexDesktop(['list', projectId])
  );

  return {
    workspaces: result.workspaces,
    sessions: result.sessions.map((row) => ({
      windowId: row.window_id,
      title: row.title,
      workspace: row.workspace,
      projectId: row.project_id,
      focused: row.focused,
      sessionId: row.session_id,
      cwd: row.cwd,
    })),
  };
}

export async function getClaudeSessionCounts(): Promise<
  Record<string, number>
> {
  try {
    return JSON.parse(await claudexDesktop(['list', '--all-projects']));
  } catch {
    // The project list still has to render without a desktop; the Desktop tab reports why.
    return {};
  }
}

export function getSessionScreen(windowId: string): Promise<string> {
  return claudexDesktop(['screen', windowId]);
}

export async function startRemoteControl(
  windowId: string,
  name: string
): Promise<void> {
  await claudexDesktop([
    'send',
    windowId,
    `/remote-control ${name}`,
    '--press-enter',
  ]);
}
