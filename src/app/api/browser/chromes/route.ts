import { NextResponse } from 'next/server';
import { listChromes } from '@/lib/browser';

/** The agent Chromes running on this machine — what `/app/browser` picks among. */
export async function GET() {
  try {
    return NextResponse.json({ chromes: await listChromes() });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'rv chrome cdp failed',
      },
      { status: 500 }
    );
  }
}
