import { NextResponse } from 'next/server';
import { forceAfk } from '@/lib/afk';

/** Count the user away from the desktop, whatever its idle timer currently thinks. */
export async function POST() {
  forceAfk();
  return NextResponse.json({ success: true });
}
