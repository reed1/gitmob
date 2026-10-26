import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * The questions `claudex ask` parked instead of letting Claude Code show its menu, which it does
 * whenever the user is away from the desktop. The hook blocks on each one until an answer file
 * lands beside it, then hands the answers to the session and removes both. One file per question,
 * named by the tool call that asked it.
 */
const QUESTIONS_DIR = join(homedir(), '.local/share/gitmob/claude-questions');

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  question: string;
  header: string;
  multiSelect: boolean;
  options: QuestionOption[];
}

export interface PendingQuestion {
  id: string;
  sessionId: string;
  cwd: string;
  /** The hook that is waiting; a question whose hook is gone has nobody to answer. */
  pid: number;
  createdAt: string;
  questions: Question[];
}

/** Question text to the answer, as AskUserQuestion takes them: several picks joined by ", ". */
export type Answers = Record<string, string>;

/** The id is a filename, and it arrives from the browser. */
export function isQuestionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
}

function questionPath(id: string): string {
  if (!isQuestionId(id)) throw new Error(`Unexpected question id: ${id}`);
  return join(QUESTIONS_DIR, `${id}.json`);
}

function answerPath(id: string): string {
  if (!isQuestionId(id)) throw new Error(`Unexpected question id: ${id}`);
  return join(QUESTIONS_DIR, `${id}.answer.json`);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw err;
  }
}

/**
 * Null for a question that is not waiting: never parked, already answered, or left behind by a
 * hook that was killed before it could clean up — that last kind is removed on the way.
 */
export function readPendingQuestion(id: string): PendingQuestion | null {
  const path = questionPath(id);
  if (!existsSync(path) || existsSync(answerPath(id))) return null;
  const question: PendingQuestion = JSON.parse(readFileSync(path, 'utf-8'));
  if (!isAlive(question.pid)) {
    unlinkSync(path);
    return null;
  }
  return question;
}

/** Every question still waiting, oldest first: the session waiting longest is the one to answer. */
export function listPendingQuestions(): PendingQuestion[] {
  if (!existsSync(QUESTIONS_DIR)) return [];
  return readdirSync(QUESTIONS_DIR)
    .filter((name) => name.endsWith('.json') && !name.endsWith('.answer.json'))
    .map((name) => readPendingQuestion(name.slice(0, -'.json'.length)))
    .filter((question) => question !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Renamed into place, so the hook polling for it never reads half a file. */
export function writeAnswers(id: string, answers: Answers): void {
  const path = answerPath(id);
  const partial = `${path}.partial`;
  writeFileSync(partial, JSON.stringify({ answers }, null, 2));
  renameSync(partial, path);
}

/** Every question has an answer, and nothing answers a question that was not asked. */
export function isAnswersFor(
  question: PendingQuestion,
  value: unknown
): value is Answers {
  if (typeof value !== 'object' || value === null) return false;
  const asked = question.questions.map((q) => q.question);
  const given = Object.entries(value);
  return (
    given.length === asked.length &&
    given.every(
      ([text, answer]) =>
        asked.includes(text) &&
        typeof answer === 'string' &&
        answer.trim() !== ''
    )
  );
}

export function directoryName(cwd: string): string {
  return cwd.split('/').filter(Boolean).pop() || cwd;
}
