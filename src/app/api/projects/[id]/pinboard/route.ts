import { NextRequest, NextResponse } from 'next/server';
import { getPinboardNotes } from '@/lib/pinboard';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ notes: getPinboardNotes(id) });
}
