import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { listChromes } from '@/lib/browser';

/** The agent Chromes running on this machine — what `/app/browser` picks among. */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ chromes: await listChromes() });
  } catch (err) {
    return errorResponse(request, err, 'rv chrome cdp failed');
  }
}
