import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import {
  addPinboardNote,
  deletePinboardNote,
  editPinboardNote,
  getPinboardNotes,
} from '@/lib/pinboard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return NextResponse.json({ notes: await getPinboardNotes(id) });
  } catch (err) {
    // An empty board and an unreachable rv are different answers, and only one of them is
    // safe to draw as "no notes".
    return errorResponse(request, err, 'rv pinboard list failed');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action, noteId, text } = await request.json();

  try {
    if (action === 'add') {
      await addPinboardNote(id, text);
    } else if (action === 'edit') {
      await editPinboardNote(id, noteId, text);
    } else if (action === 'delete') {
      await deletePinboardNote(id, noteId);
    } else {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400 }
      );
    }
  } catch (err) {
    return errorResponse(request, err, `rv pinboard ${action} failed`);
  }

  // The CLI reports what it did, not the board it left behind, so the fresh list is what
  // keeps the client honest about ids the desktop may have changed meanwhile.
  return NextResponse.json({ notes: await getPinboardNotes(id) });
}
