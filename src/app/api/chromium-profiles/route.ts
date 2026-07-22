import { NextResponse } from 'next/server';
import { closeAllBrowsers, listProfiles } from '@/lib/chrome-profiles';

export async function GET() {
  return NextResponse.json({ profiles: await listProfiles() });
}

export async function POST() {
  const closed = closeAllBrowsers();
  return NextResponse.json({ closed: closed.length });
}
