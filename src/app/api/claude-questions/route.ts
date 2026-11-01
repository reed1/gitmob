import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { listPendingQuestions, replyToQuestion } from '@/lib/desktop';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ questions: await listPendingQuestions() });
  } catch (err) {
    return errorResponse(request, err, 'claudex desktop failed');
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
    return errorResponse(request, err, 'claudex desktop failed');
  }
}
