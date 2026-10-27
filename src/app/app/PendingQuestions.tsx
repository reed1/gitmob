'use client';

import { useCallback, useState } from 'react';
import { ModalOverlay } from '@/components/ModalOverlay';
import { addToast, apiFetch } from '@/lib/api';
import { relativeTime } from '@/lib/relative-time';
import { saveTextHistory } from '@/lib/text-history';
import { useLoad } from '@/lib/use-load';
import { CollapsedRows } from './CollapsedRows';
import type { PendingQuestion, Question, Reply } from '@/lib/claude-questions';

interface Choice {
  picked: string[];
  otherOn: boolean;
  other: string;
}

const NO_CHOICE: Choice = { picked: [], otherOn: false, other: '' };

function directoryName(cwd: string): string {
  return cwd.split('/').filter(Boolean).pop() || cwd;
}

function shortPath(path: string): string {
  return path.replace(/^\/home\/[^/]+/, '~');
}

/** What AskUserQuestion expects: one string per question, several picks joined by ", ". */
function answerOf(choice: Choice): string {
  const other = choice.otherOn ? choice.other.trim() : '';
  return [...choice.picked, ...(other ? [other] : [])].join(', ');
}

/**
 * The questions `claudex ask` put here instead of on the desktop, because the user was away from
 * it. The session is blocked on each until it is answered, or until the user is back at the desk
 * and the question moves to Claude Code's own menu, when it drops off this list the next time
 * the front page loads.
 */
export function PendingQuestions({ hidden }: { hidden: boolean }) {
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    const res = await fetch('/api/claude-questions');
    if (!res.ok) return;
    const data: { questions: PendingQuestion[] } = await res.json();
    setQuestions(data.questions);
  }, []);

  useLoad(fetchQuestions);

  const open = questions.find((q) => q.id === openId) ?? null;

  if (questions.length === 0 || hidden) return null;

  return (
    <>
      <section>
        <h2 className="text-sm font-medium text-violet-400 mb-2">
          Claude Asks
          <span className="ml-1.5 text-violet-400/60">{questions.length}</span>
        </h2>
        <CollapsedRows
          items={questions}
          toggleClassName="text-violet-400/80"
          renderItem={(pending) => (
            <button
              key={pending.id}
              onClick={() => setOpenId(pending.id)}
              className="w-full text-left p-3 rounded-lg border border-violet-500/40 bg-violet-500/10 active:opacity-80"
            >
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <span className="font-medium text-violet-400">
                  {directoryName(pending.cwd)}
                </span>
                <span>{relativeTime(pending.createdAt)}</span>
                {pending.questions.length > 1 && (
                  <span>{pending.questions.length} questions</span>
                )}
              </div>
              <div className="mt-1 text-sm line-clamp-2">
                {pending.questions[0].question}
              </div>
              <div className="mt-1 text-xs text-foreground/40 truncate">
                {shortPath(pending.cwd)}
              </div>
            </button>
          )}
        />
      </section>

      {open && (
        <QuestionWizard
          key={open.id}
          pending={open}
          onClose={() => setOpenId(null)}
          onAnswered={() => {
            setOpenId(null);
            setQuestions((current) => current.filter((q) => q.id !== open.id));
          }}
        />
      )}
    </>
  );
}

/**
 * One step per question, then a review of every answer when there was more than one. The menu's
 * Deny swaps the steps for the reason Claude is told instead.
 */
export function QuestionWizard({
  pending,
  onClose,
  onAnswered,
}: {
  pending: PendingQuestion;
  onClose: () => void;
  onAnswered: () => void;
}) {
  const count = pending.questions.length;
  const [choices, setChoices] = useState<Choice[]>(() =>
    pending.questions.map(() => NO_CHOICE)
  );
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');

  const reviewing = step === count;
  const lastStep = count === 1 ? 0 : count;
  const answered = choices.map((choice) => answerOf(choice) !== '');
  const touched =
    reason.trim() !== '' ||
    choices.some(
      (choice) => choice.picked.length > 0 || choice.other.trim() !== ''
    );

  const setChoice = (index: number, choice: Choice) =>
    setChoices((current) =>
      current.map((existing, i) => (i === index ? choice : existing))
    );

  const send = async (reply: Reply, sentMessage: string) => {
    [...choices.map((choice) => choice.other), reason].forEach((text) =>
      saveTextHistory({
        text,
        source: `Claude asks: ${directoryName(pending.cwd)}`,
      })
    );
    setSending(true);
    try {
      const res = await apiFetch('/api/claude-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pending.id, reply }),
      });
      if (!res.ok) return;
      addToast(sentMessage, 'success');
      onAnswered();
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalOverlay
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClose={onClose}
      guardDismiss={touched}
    >
      <div className="bg-background border border-foreground/20 rounded-lg shadow-xl w-full max-w-lg max-h-full flex flex-col">
        <div className="px-4 py-3 border-b border-foreground/10">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">
                {denying ? "Deny Claude's questions" : 'Claude asks'}
              </h3>
              <div className="text-xs text-foreground/50 truncate">
                {shortPath(pending.cwd)}
              </div>
            </div>
            {!denying && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label="More"
                  className="p-1.5 rounded-lg hover:bg-foreground/10 active:bg-foreground/20"
                >
                  <svg
                    className="w-5 h-5 text-foreground/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01"
                    />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setDenying(true);
                        }}
                        className="block w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-foreground/10 whitespace-nowrap"
                      >
                        Deny
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {count > 1 && !denying && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pending.questions.map((q, i) => (
                <button
                  key={q.question}
                  onClick={() => setStep(i)}
                  className={`px-2 py-0.5 text-xs rounded-full border ${
                    i === step
                      ? 'border-violet-400 bg-violet-500/20 text-violet-300'
                      : 'border-foreground/20 text-foreground/60'
                  }`}
                >
                  {answered[i] ? '✓ ' : ''}
                  {q.header}
                </button>
              ))}
              <button
                onClick={() => setStep(count)}
                className={`px-2 py-0.5 text-xs rounded-full border ${
                  reviewing
                    ? 'border-violet-400 bg-violet-500/20 text-violet-300'
                    : 'border-foreground/20 text-foreground/60'
                }`}
              >
                Submit
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-3 overflow-y-auto">
          {denying ? (
            <div className="space-y-2">
              <div className="text-sm">Tell Claude why, or leave it empty.</div>
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="User denied to answer questions"
                className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-none"
              />
            </div>
          ) : reviewing ? (
            <div className="space-y-3">
              {pending.questions.map((q, i) => (
                <button
                  key={q.question}
                  onClick={() => setStep(i)}
                  className="w-full text-left"
                >
                  <div className="text-xs text-foreground/50">{q.question}</div>
                  <div
                    className={`text-sm ${
                      answered[i] ? '' : 'text-red-400 italic'
                    }`}
                  >
                    {answered[i] ? answerOf(choices[i]) : 'Not answered'}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <QuestionStep
              question={pending.questions[step]}
              choice={choices[step]}
              onChange={(choice) => setChoice(step, choice)}
            />
          )}
        </div>

        <div className="px-4 py-3 border-t border-foreground/10 flex items-center justify-between gap-2">
          {denying ? (
            <button
              onClick={() => setDenying(false)}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Back
            </button>
          ) : step === 0 ? (
            <button
              data-modal-cancel
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setStep(step - 1)}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Back
            </button>
          )}
          {denying ? (
            <button
              onClick={() =>
                send(
                  { kind: 'deny', reason: reason.trim() },
                  'Questions denied'
                )
              }
              disabled={sending}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:opacity-90 disabled:opacity-40"
            >
              {sending ? 'Sending...' : 'Deny'}
            </button>
          ) : step === lastStep ? (
            <button
              onClick={() =>
                send(
                  {
                    kind: 'answers',
                    answers: Object.fromEntries(
                      pending.questions.map((q, i) => [
                        q.question,
                        answerOf(choices[i]),
                      ])
                    ),
                  },
                  'Answer sent'
                )
              }
              disabled={sending || answered.includes(false)}
              className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              {sending ? 'Sending...' : 'Submit'}
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!answered[step]}
              className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

function QuestionStep({
  question,
  choice,
  onChange,
}: {
  question: Question;
  choice: Choice;
  onChange: (choice: Choice) => void;
}) {
  const pick = (label: string) => {
    if (!question.multiSelect) {
      onChange({ ...choice, picked: [label], otherOn: false });
    } else if (choice.picked.includes(label)) {
      onChange({
        ...choice,
        picked: choice.picked.filter((picked) => picked !== label),
      });
    } else {
      // Kept in the order Claude listed them, whatever order they were tapped in.
      const picked = question.options
        .map((option) => option.label)
        .filter((option) => option === label || choice.picked.includes(option));
      onChange({ ...choice, picked });
    }
  };

  const toggleOther = () => {
    if (!question.multiSelect)
      onChange({ ...choice, picked: [], otherOn: true });
    else onChange({ ...choice, otherOn: !choice.otherOn });
  };

  const rowClass = (selected: boolean) =>
    `w-full text-left p-3 rounded-lg border flex gap-3 ${
      selected
        ? 'border-violet-400 bg-violet-500/15'
        : 'border-foreground/15 active:bg-foreground/5'
    }`;

  const mark = (selected: boolean) => (
    <span
      className={`mt-0.5 w-4 h-4 shrink-0 border flex items-center justify-center text-[10px] ${
        question.multiSelect ? 'rounded' : 'rounded-full'
      } ${
        selected
          ? 'border-violet-400 bg-violet-500 text-white'
          : 'border-foreground/40'
      }`}
    >
      {selected ? '✓' : ''}
    </span>
  );

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{question.question}</div>
      {question.multiSelect && (
        <div className="text-xs text-foreground/50">Pick any that apply</div>
      )}
      {question.options.map((option) => {
        const selected = choice.picked.includes(option.label);
        return (
          <button
            key={option.label}
            onClick={() => pick(option.label)}
            className={rowClass(selected)}
          >
            {mark(selected)}
            <span className="min-w-0">
              <span className="block text-sm">{option.label}</span>
              {option.description && (
                <span className="block text-xs text-foreground/50 mt-0.5">
                  {option.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
      <button onClick={toggleOther} className={rowClass(choice.otherOn)}>
        {mark(choice.otherOn)}
        <span className="text-sm">Something else</span>
      </button>
      {choice.otherOn && (
        <textarea
          autoFocus
          value={choice.other}
          onChange={(e) => onChange({ ...choice, other: e.target.value })}
          rows={3}
          placeholder="Type your answer, or ask Claude to talk it through first"
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-none"
        />
      )}
    </div>
  );
}
