/**
 * The questions `claudex ask` parked instead of letting Claude Code show its menu, which it does
 * whenever the user is away from the desktop. The session is blocked on each until it is answered.
 * `claudex desktop` hands them out and takes the answers (`src/lib/desktop.ts`).
 */

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
  createdAt: string;
  questions: Question[];
}

/** Question text to the answer, as AskUserQuestion takes them: several picks joined by ", ". */
export type Answers = Record<string, string>;

/** A denial with no reason leaves it to claudex, which tells Claude the user denied answering. */
export type Reply =
  | { kind: 'answers'; answers: Answers }
  | { kind: 'deny'; reason: string };
