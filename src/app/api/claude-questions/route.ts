import { NextRequest, NextResponse } from 'next/server';
import { listPendingQuestions, replyToQuestion } from '@/lib/desktop';

export async function GET() {
  try {
    return NextResponse.json({ questions: await listPendingQuestions() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'claudex desktop failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { id, reply } = await request.json();
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Missing question' }, { status: 400 });
  }

  try {
    await replyToQuestion(id, reply);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'claudex desktop failed' },
      { status: 500 }
    );
  }
}
