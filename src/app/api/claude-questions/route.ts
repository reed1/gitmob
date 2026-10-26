import { NextRequest, NextResponse } from 'next/server';
import {
  isAnswersFor,
  isQuestionId,
  listPendingQuestions,
  readPendingQuestion,
  writeAnswers,
} from '@/lib/claude-questions';

export async function GET() {
  return NextResponse.json({ questions: listPendingQuestions() });
}

export async function POST(request: NextRequest) {
  const { id, answers } = await request.json();
  if (!isQuestionId(id)) {
    return NextResponse.json({ error: 'Missing question' }, { status: 400 });
  }

  const question = readPendingQuestion(id);
  if (!question) {
    return NextResponse.json(
      { error: 'The session is no longer waiting on this question' },
      { status: 404 }
    );
  }

  if (!isAnswersFor(question, answers)) {
    return NextResponse.json(
      { error: 'Every question needs an answer' },
      { status: 400 }
    );
  }

  writeAnswers(id, answers);
  return NextResponse.json({ success: true });
}
