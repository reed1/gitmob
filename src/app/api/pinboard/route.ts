import { NextResponse } from 'next/server';
import { getRecentPinboardNotes } from '@/lib/pinboard';

const RECENT_LIMIT = 50;

export async function GET() {
  return NextResponse.json(await getRecentPinboardNotes(RECENT_LIMIT));
}
