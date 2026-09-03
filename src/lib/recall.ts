import { execFile } from 'child_process';

/**
 * `recall` owns the index over every Claude Code transcript on this machine — its own cache,
 * its own ranking. This app asks it questions and maps the answers; the JSONL files under
 * ~/.claude are none of its business.
 */

export interface RecallMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface RecallHit {
  sessionId: string;
  cwd: string;
  timestamp: string;
  messages: RecallMessage[];
}

export interface RecallSession {
  sessionId: string;
  cwd: string;
  timestamp: string;
  messages: RecallMessage[];
}

interface RecallRawMessage {
  role: string;
  content: string;
  timestamp: string;
}

interface RecallRawHit {
  session_id: string;
  source: string;
  cwd: string;
  timestamp: string;
  relevant_messages: RecallRawMessage[];
}

interface RecallRawSessionRow {
  session_id: string;
  source: string;
  cwd: string;
  timestamp: string;
}

/**
 * A warm search answers in ~0.2s, but the first call after a run of new sessions indexes them
 * before it answers anything, so the budget is the indexing one rather than the search one.
 */
const RECALL_TIMEOUT_MS = 60000;

/** Sessions this app can reopen. recall also indexes Codex, Droid and OpenCode. */
const CLAUDE_SOURCE = ['-s', 'claude'];

/**
 * How far back a project-scoped question reaches. `-l` caps what recall considers before
 * `--cwd` narrows it to one project, so it is a lookback over every session on this machine
 * rather than a count of rows to answer with: asking for ten answers with however many of the
 * newest ten machine-wide happen to be this project's. It costs the same as a small one — the
 * index scan is the work — so it is set past the whole index, and the views trim what comes
 * back. A project whose sessions fall behind this many is out of reach.
 */
const LOOKBACK = 5000;

const SEARCH_LIMIT = 25;

/** Ten, because each recent row costs a `read` of its own to have anything to say. */
const RECENTS_LIMIT = 10;

/** Messages either side of a match, so a hit reads as an exchange rather than one line. */
const CONTEXT_MESSAGES = 1;

function recall<T>(args: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile(
      'recall',
      args,
      { timeout: RECALL_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        // Indexing progress goes to stderr, so stdout is the JSON alone.
        resolve(JSON.parse(stdout));
      }
    );
  });
}

/**
 * `--cwd` is an exact match, which is recall's own idea of a folder scope: a session started in
 * a subdirectory of the project belongs to that subdirectory. Widening it here would be this app
 * keeping a second opinion about which sessions are a project's.
 */
export async function searchSessions(
  query: string,
  cwd: string
): Promise<RecallHit[]> {
  const { results } = await recall<{ results: RecallRawHit[] }>([
    'search',
    query,
    ...CLAUDE_SOURCE,
    '--cwd',
    cwd,
    '-l',
    String(LOOKBACK),
    '-C',
    String(CONTEXT_MESSAGES),
  ]);

  return results.slice(0, SEARCH_LIMIT).map((hit) => ({
    sessionId: hit.session_id,
    cwd: hit.cwd,
    timestamp: hit.timestamp,
    messages: hit.relevant_messages,
  }));
}

/** The message a session opened with — its subject, as far as a list row is concerned. */
async function openingMessage(
  sessionId: string
): Promise<RecallMessage | undefined> {
  const { messages } = await readSession(sessionId);
  return messages.find((message) => message.role === 'user') ?? messages[0];
}

/**
 * What an empty search box shows: the newest sessions, each opened for the message it began
 * with. `list` carries no text at all, so a row off it alone would be a timestamp and nothing
 * else — and the read that fixes that is a subprocess per row, which is what keeps the list
 * to ten. Everything older is behind the search box, which costs one call however far back it
 * reaches.
 */
export async function recentSessions(cwd: string): Promise<RecallHit[]> {
  const { sessions } = await recall<{ sessions: RecallRawSessionRow[] }>([
    'list',
    ...CLAUDE_SOURCE,
    '--cwd',
    cwd,
    '-l',
    String(LOOKBACK),
  ]);

  return Promise.all(
    sessions.slice(0, RECENTS_LIMIT).map(async (session) => {
      const opening = await openingMessage(session.session_id);
      return {
        sessionId: session.session_id,
        cwd: session.cwd,
        timestamp: session.timestamp,
        messages: opening ? [opening] : [],
      };
    })
  );
}

export async function readSession(sessionId: string): Promise<RecallSession> {
  const session = await recall<{
    session_id: string;
    cwd: string;
    timestamp: string;
    messages: RecallRawMessage[];
  }>(['read', sessionId]);

  return {
    sessionId: session.session_id,
    cwd: session.cwd,
    timestamp: session.timestamp,
    messages: session.messages,
  };
}
