import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { CommonCommand, SpecialKey } from './desktop-keys';
import type { CustomModel, ModelCatalog } from './desktop-models';

/** What Claude Code itself reports the session's context window to be holding. */
export interface SessionContext {
  usedTokens: number;
  windowSize: number;
  usedPercentage: number;
}

/**
 * A session named for closing later: the window to park and the pid that was drawing in it.
 * Either alone can move on to another session while the close waits, so they only travel as
 * a pair, and claudex closes nothing unless the pair still holds.
 */
export interface SessionHandle {
  windowId: string;
  claudePid: string;
}

export interface DesktopSession {
  windowId: string;
  /** A provider id from `claudex models`. */
  provider: string;
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
  provider: string;
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
/** Closing waits for the project's `rv run` units to stop. */
const CLOSE_TIMEOUT_MS = 60000;

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
 * `claudex desktop` handles existing sessions, Claude and Codex alike — claudex owns the session
 * registry, the kitty remote sockets and the i3 lookup that says which windows are still there.
 */
function claudexDesktop(args: string[]): Promise<string> {
  return run('claudex', ['desktop', ...args]);
}

export interface DesktopLaunch {
  projectId: string;
  /** Where the session opens — the project's checkout, or the directory a handoff named. */
  directory: string;
  /** A provider id from `claudex models`. */
  provider: string;
  customModel?: CustomModel;
  prompt: string;
  title?: string;
  /** Reopens that conversation instead of starting an empty one — see below. */
  resumeSessionId?: string;
}

/**
 * A new session is two commands. `rv open` puts the desktop on the project — switching to its
 * workspaces and opening them when they were closed. `claudex kitty` then
 * lands the session on whatever that left focused, which `--focus-ide` makes the IDE, so the
 * session opens beside it at full size. `--detach` hands the window to i3 so it outlives this server.
 *
 * An initial prompt is submitted (passed to the provider as its startup prompt),
 * so the agent starts working immediately; without one the session waits for input.
 *
 * The prompt travels as a file claudex reads once and deletes, so no prompt can be mistaken
 * for one of its options. One claudex refused is left behind, and removed here.
 *
 * A resume only finds a session under the directory it was held in, so the directory above is
 * the contract, not a convenience.
 */
export async function launchDesktopSession(
  launch: DesktopLaunch
): Promise<void> {
  await run('rv', ['open', launch.projectId, '--focus-ide'], OPEN_TIMEOUT_MS);
  const promptFile = launch.prompt
    ? join(tmpdir(), `gitmob-prompt-${randomUUID()}.txt`)
    : null;
  if (promptFile) {
    await writeFile(promptFile, launch.prompt, { mode: 0o600, flag: 'wx' });
  }
  try {
    await runKitty(launch, promptFile);
  } finally {
    if (promptFile) await rm(promptFile, { force: true });
  }
}

function runKitty(
  launch: DesktopLaunch,
  promptFile: string | null
): Promise<string> {
  return run('claudex', [
    'kitty',
    '--detach',
    '--provider',
    launch.provider,
    '--directory',
    launch.directory,
    ...(launch.customModel
      ? [
          '--model',
          launch.customModel.model,
          '--effort',
          launch.customModel.effort,
        ]
      : []),
    ...(launch.title ? ['--title', launch.title] : []),
    ...(launch.resumeSessionId ? ['--resume', launch.resumeSessionId] : []),
    ...(promptFile ? ['--submit', '--file', promptFile, '--rm-file'] : []),
  ]);
}

export async function openProjectOnDesktop(projectId: string): Promise<void> {
  await run('rv', ['open', projectId], OPEN_TIMEOUT_MS);
}

/**
 * `rv close` owns the whole teardown — the project's windows, its IDE, its `rv run` units and
 * its Claude sessions into purgatory — the same one `<leader> q q` runs at the desktop.
 */
export async function closeProjectOnDesktop(projectId: string): Promise<void> {
  await run('rv', ['close', projectId], CLOSE_TIMEOUT_MS);
}

function toDesktopSession(row: ClaudexSessionRow): DesktopSession {
  return {
    windowId: row.window_id,
    provider: row.provider,
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
  };
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
    sessions: result.sessions.map(toDesktopSession),
  };
}

/**
 * Every session window on the desktop, whatever project it belongs to. Asked before a resume:
 * a conversation already open in a window is one a resume must not be pointed at a second
 * time. A live session can report a null id, and one of those matches nothing here.
 */
export async function listAllDesktopSessions(): Promise<DesktopSession[]> {
  const result: ClaudexListResult = JSON.parse(
    await claudexDesktop(['list', '--all'])
  );

  return result.sessions.map(toDesktopSession);
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
 * the session back if the commit was not the end of the work. The handle was noted hours ago,
 * so claudex checks the pid is still Claude in that window and otherwise closes nothing.
 *
 * Not `claudex desktop`: purgatory is its own command, and this is the one call here that
 * ends a session rather than reading or typing into one.
 */
export async function sendSessionToPurgatory(
  session: SessionHandle
): Promise<void> {
  await run('claudex', [
    'purgatory',
    'send',
    '--window',
    session.windowId,
    '--pid',
    session.claudePid,
  ]);
}

export async function sendSessionCommand(
  windowId: string,
  command: CommonCommand
): Promise<void> {
  await claudexDesktop(['send', windowId, '--press-enter', '--', command]);
}

/**
 * Send Keys is a keyboard for a session, so it types past the empty-prompt check `send`
 * normally applies: the caller has the screen in front of them and may well be answering
 * the dialog that check exists to protect. `--paste` keeps a multi-line box multi-line
 * instead of submitting at every newline. The text goes after `--`, where nothing it starts
 * with reads as an option.
 */
export async function typeIntoSession(
  windowId: string,
  text: string,
  pressEnter: boolean
): Promise<void> {
  await claudexDesktop([
    'send',
    windowId,
    '--force',
    '--paste',
    ...(pressEnter ? ['--press-enter'] : []),
    '--',
    text,
  ]);
}

export async function pressSessionKey(
  windowId: string,
  key: SpecialKey
): Promise<void> {
  await claudexDesktop(['keys', windowId, key]);
}

/**
 * Accept the follow-up prompt Claude Code offers: Right fills the prompt with it, and Enter
 * submits. The pause between them lets the TUI redraw, which it needs to accept the Enter.
 */
export async function acceptSuggestedPrompt(windowId: string): Promise<void> {
  await pressSessionKey(windowId, 'right');
  await new Promise((resolve) => setTimeout(resolve, 200));
  await pressSessionKey(windowId, 'enter');
}

let modelCatalog: Promise<ModelCatalog> | undefined;

/**
 * The providers, models and efforts a session can open on, read once per server process:
 * the catalog changes when claudex is edited, and gitmob is restarted after that. A failed
 * read is not kept, so the next request asks again.
 */
export function getModelCatalog(): Promise<ModelCatalog> {
  modelCatalog ??= run('claudex', ['models'])
    .then((output): ModelCatalog => JSON.parse(output))
    .catch((error) => {
      modelCatalog = undefined;
      throw error;
    });
  return modelCatalog;
}

export async function isProvider(value: unknown): Promise<boolean> {
  const catalog = await getModelCatalog();
  return catalog.providers.some((provider) => provider.id === value);
}

export async function isCustomModel(
  provider: string,
  value: unknown
): Promise<boolean> {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const selection = value as CustomModel;
  const catalog = await getModelCatalog();
  const models = catalog.providers.find(
    (entry) => entry.id === provider
  )?.models;
  return (
    catalog.efforts.includes(selection.effort) &&
    !!models?.some((model) => model.id === selection.model)
  );
}
