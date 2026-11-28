import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { CommonCommand, SpecialKey } from './desktop-keys';
import type { CustomModel, ModelCatalog } from './desktop-models';
import type { PendingQuestion, Question, Reply } from './claude-questions';
import type { SessionPostcards } from './postcards';
import { getProjectsWithWorktrees, projectHolding } from './projects';
import type { PendingEdit } from './remote-edits';

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
  /** Whether the session has written anything into its agenda. */
  hasAgenda: boolean;
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
  has_agenda: boolean;
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
  { timeout = 30000, env }: { timeout?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout, env, maxBuffer: 4 * 1024 * 1024 },
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
  /** Gives the session the project's agent Chrome as its `browser` MCP server. */
  browser: boolean;
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
  await run('rv', ['open', launch.projectId, '--focus-ide'], {
    timeout: OPEN_TIMEOUT_MS,
  });
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
    ...(launch.browser ? ['--browser', 'agent'] : []),
    ...(promptFile ? ['--submit', '--file', promptFile, '--rm-file'] : []),
  ]);
}

export async function openProjectOnDesktop(projectId: string): Promise<void> {
  await run('rv', ['open', projectId], { timeout: OPEN_TIMEOUT_MS });
}

/**
 * `rv close` owns the whole teardown — the project's windows, its IDE, its `rv run` units and
 * its Claude sessions into purgatory — the same one `<leader> q q` runs at the desktop.
 */
export async function closeProjectOnDesktop(projectId: string): Promise<void> {
  await run('rv', ['close', projectId], { timeout: CLOSE_TIMEOUT_MS });
}

/**
 * `claudex agenda` says where a session keeps its agenda, creating the file empty when the
 * session has written none, so an empty string is a session without one.
 */
export async function readSessionAgenda(sessionId: string): Promise<string> {
  const path = await run('claudex', ['agenda', 'path'], {
    env: { ...process.env, CLAUDE_CODE_SESSION_ID: sessionId },
  });
  return readFile(path.trim(), 'utf8');
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
    hasAgenda: row.has_agenda,
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

interface ClaudexQuestionRow {
  id: string;
  session_id: string;
  cwd: string;
  created_at: string;
  questions: Question[];
}

/** claudex knows only the session's cwd; the project is looked up here, as edits carry theirs. */
async function toPendingQuestions(
  rows: ClaudexQuestionRow[]
): Promise<PendingQuestion[]> {
  if (rows.length === 0) return [];
  const { projects } = await getProjectsWithWorktrees();
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    cwd: row.cwd,
    canonicalProjectId: projectHolding(projects, row.cwd)?.canonicalId ?? null,
    createdAt: row.created_at,
    questions: row.questions,
  }));
}

interface ClaudexEditRow {
  id: string;
  window_id: string;
  project_id: string | null;
  canonical_project_id: string | null;
  cwd: string;
  created_at: string;
  text: string;
}

function toPendingEdit(row: ClaudexEditRow): PendingEdit {
  return {
    id: row.id,
    windowId: row.window_id,
    projectId: row.project_id,
    canonicalProjectId: row.canonical_project_id,
    cwd: row.cwd,
    createdAt: row.created_at,
    text: row.text,
  };
}

/**
 * The screen, the question its session is blocked on while the user is away, its input box
 * when `claudex edit-remote` has handed that here, and how many postcards its session has sent.
 */
export async function getSessionScreen(windowId: string): Promise<{
  content: string;
  question: PendingQuestion | null;
  edit: PendingEdit | null;
  postcards: SessionPostcards;
}> {
  const result: {
    content: string;
    question: ClaudexQuestionRow | null;
    edit: ClaudexEditRow | null;
    postcards: SessionPostcards;
  } = JSON.parse(await claudexDesktop(['screen', windowId, '--json']));
  return {
    content: result.content,
    question: result.question
      ? (await toPendingQuestions([result.question]))[0]
      : null,
    edit: result.edit && toPendingEdit(result.edit),
    postcards: result.postcards,
  };
}

/** Every question a session is blocked on, oldest first. */
export async function listPendingQuestions(): Promise<PendingQuestion[]> {
  const rows: ClaudexQuestionRow[] = JSON.parse(
    await claudexDesktop(['questions'])
  );
  return toPendingQuestions(rows);
}

/** claudex refuses a question nobody waits on any more, and answers that leave one unanswered. */
export async function replyToQuestion(id: string, reply: Reply): Promise<void> {
  if (reply.kind === 'answers') {
    await claudexDesktop(['answer', id, JSON.stringify(reply.answers)]);
  } else if (reply.kind === 'deny') {
    await claudexDesktop(['deny', id, ...(reply.reason ? [reply.reason] : [])]);
  } else {
    throw new Error(`Unexpected reply: ${JSON.stringify(reply)}`);
  }
}

/** Every input box out here, oldest first. */
export async function listPendingEdits(): Promise<PendingEdit[]> {
  const rows: ClaudexEditRow[] = JSON.parse(await claudexDesktop(['edits']));
  return rows.map(toPendingEdit);
}

/**
 * The text goes back into the session's input box; `submit` presses Enter on it too. claudex
 * refuses an edit nobody waits on any more — its window was closed — and an empty submit.
 */
export async function replyToEdit(
  id: string,
  text: string,
  submit: boolean
): Promise<void> {
  await claudexDesktop([
    'edit-reply',
    id,
    ...(submit ? ['--submit'] : []),
    '--',
    text,
  ]);
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

/** The providers, models and efforts a session can open on. */
export async function getModelCatalog(): Promise<ModelCatalog> {
  return JSON.parse(await run('claudex', ['models']));
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
