import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { listPendingEdits, replyToEdit } from '@/lib/desktop';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ edits: await listPendingEdits() });
  } catch (err) {
    return errorResponse(request, err, 'claudex desktop failed');
  }
}

export async function POST(request: NextRequest) {
  const { id, text, submit } = await request.json();
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Missing edit' }, { status: 400 });
  }
  if (typeof text !== 'string' || typeof submit !== 'boolean') {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }

  try {
    await replyToEdit(id, text, submit);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(request, err, 'claudex desktop failed');
  }
}
