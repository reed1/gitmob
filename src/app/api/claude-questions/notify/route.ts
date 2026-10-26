import { NextRequest, NextResponse } from 'next/server';
import {
  directoryName,
  isQuestionId,
  readPendingQuestion,
} from '@/lib/claude-questions';
import { sendNotification } from '@/lib/notifications';

/** Called by `claudex ask` once it has parked a question, so the phone hears about it. */
export async function POST(request: NextRequest) {
  const { id } = await request.json();
  if (!isQuestionId(id)) {
    return NextResponse.json({ error: 'Missing question' }, { status: 400 });
  }

  const question = readPendingQuestion(id);
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  const [first] = question.questions;
  const more = question.questions.length - 1;
  const deliveries = await sendNotification({
    title: `Claude asks in ${directoryName(question.cwd)}`,
    body: more > 0 ? `${first.question} (+${more} more)` : first.question,
    url: `/app?question=${encodeURIComponent(id)}`,
    tag: `question-${id}`,
  });

  return NextResponse.json({ deliveries });
}
