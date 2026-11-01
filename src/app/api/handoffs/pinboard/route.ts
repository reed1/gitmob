import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import {
  deletePendingHandoff,
  handoffPinboardNote,
  isHandoffId,
  readPendingHandoff,
} from '@/lib/handoffs';
import { addPinboardNote } from '@/lib/pinboard';

/** Puts a handoff off: it moves to its project's pinboard as a note, and stops being parked. */
export async function POST(request: NextRequest) {
  const { handoffId } = await request.json();
  if (!isHandoffId(handoffId)) {
    return NextResponse.json({ error: 'Missing handoff' }, { status: 400 });
  }

  const handoff = readPendingHandoff(handoffId);
  if (!handoff) {
    return NextResponse.json({ error: 'Handoff not found' }, { status: 404 });
  }

  try {
    const { text, metadata } = handoffPinboardNote(handoff);
    await addPinboardNote(handoff.projectId, text, metadata);
  } catch (err) {
    // A note that never landed leaves the handoff parked, so nothing is lost.
    return errorResponse(request, err, 'rv pinboard add failed');
  }

  deletePendingHandoff(handoffId);
  return NextResponse.json({ success: true });
}
