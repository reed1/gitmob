import { execFile } from 'child_process';
import type { SpecialKey } from './desktop-keys';
import type { ClaudeMode } from './desktop-modes';

/** What Claude Code itself reports the session's context window to be holding. */
export interface SessionContext {
  usedTokens: number;
  windowSize: number;
  usedPercentage: number;
}

export interface DesktopSession {
  windowId: string;
  title: string;
  workspace: string;
  projectId: string;
  focused: boolean;
  sessionId: string | null;
  cwd: string | null;
  context: SessionContext | null;
}

interface ClaudexSessionContext {
  used_tokens: number;
  window_size: number;
  used_percentage: number;
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
  context: ClaudexSessionContext | null;
}

interface ClaudexListResult {
  workspaces: string[];
  sessions: ClaudexSessionRow[];
}

/** Opening a project can mean starting an editor and its terminals, so it gets its own budget. */
const OPEN_TIMEOUT_MS = 120000;

function run(
  command: string,
  args: string[],
  timeout = 30000
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout, maxBuffer: 4 * 1024 * 1024 },
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

/**
 * `claudex desktop` is the only way this app reaches the desktop — claudex owns the session
 * registry, the kitty remote sockets and the i3 lookup that says which windows are still there.
 */
function claudexDesktop(args: string[]): Promise<string> {
  return run('claudex', ['desktop', ...args]);
}

export interface DesktopLaunch {
  projectId: string;
  /** Where the session opens — the project's checkout, or the directory a handoff named. */
  directory: string;
  mode: ClaudeMode;
  name: string;
  prompt: string;
  title?: string;
}

/**
 * A new session is two commands. `rv open` puts the desktop on the project — switching to its
 * workspaces and opening them when they were closed — and `claudex kitty` then lands the Claude
 * window on whatever that left focused, which `--focus-ide` makes the IDE, so the session opens
 * beside it at full size. `--detach` hands the window to i3 so it outlives this server, and
 * `--remote-control` names the session for the Claude app, which would otherwise list it under
 * an auto-generated name.
 *
 * An initial prompt is typed in after that and submitted, so the agent is already working when
 * the session is looked at; without one there is nothing to submit and the session waits.
 */
export async function launchDesktopSession(
  launch: DesktopLaunch
): Promise<void> {
  await run('rv', ['open', launch.projectId, '--focus-ide'], OPEN_TIMEOUT_MS);
  await run('claudex', [
    'kitty',
    '--detach',
    '--mode',
    launch.mode,
    '--directory',
    launch.directory,
    '--remote-control',
    launch.name,
    ...(launch.title ? ['--title', launch.title] : []),
    ...(launch.prompt ? ['--press-enter', launch.prompt] : []),
  ]);
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
      context: row.context && {
        usedTokens: row.context.used_tokens,
        windowSize: row.context.window_size,
        usedPercentage: row.context.used_percentage,
      },
    })),
  };
}

export async function getClaudeSessionCounts(): Promise<
  Record<string, number>
> {
  try {
    return JSON.parse(await claudexDesktop(['count']));
  } catch {
    // The project list still has to render without a desktop; the Desktop tab reports why.
    return {};
  }
}

export function getSessionScreen(windowId: string): Promise<string> {
  return claudexDesktop(['screen', windowId]);
}

/**
 * The deferred close the commit overlay's `t` toggle makes at the desktop: claudex parks the
 * window on its own workspace and SIGTERMs it 30s later, so `claudex purgatory cancel` takes
 * the session back if the commit was not the end of the work. The window is the whole handle
 * — claudex looks up the process behind it now, rather than trusting a pid noted hours ago.
 *
 * Not `claudex desktop`: purgatory is its own command, and this is the one call here that
 * ends a session rather than reading or typing into one.
 */
export async function sendSessionToPurgatory(windowId: string): Promise<void> {
  await run('claudex', ['purgatory', 'send', '--window', windowId]);
}

export async function exitSession(windowId: string): Promise<void> {
  await claudexDesktop(['send', windowId, '/exit', '--press-enter']);
}

/**
 * Send Keys is a keyboard for a session, so it types past the empty-prompt check `send`
 * normally applies: the caller has the screen in front of them and may well be answering
 * the dialog that check exists to protect. `--paste` keeps a multi-line box multi-line
 * instead of submitting at every newline.
 */
export async function typeIntoSession(
  windowId: string,
  text: string,
  pressEnter: boolean
): Promise<void> {
  await claudexDesktop([
    'send',
    windowId,
    text,
    '--force',
    '--paste',
    ...(pressEnter ? ['--press-enter'] : []),
  ]);
}

export async function pressSessionKey(
  windowId: string,
  key: SpecialKey
): Promise<void> {
  await claudexDesktop(['keys', windowId, key]);
}
