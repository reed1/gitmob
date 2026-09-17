import { NextRequest, NextResponse } from 'next/server';
import { stopJob } from '@/lib/cli-jobs';

export async function POST(request: NextRequest) {
  const { jobId } = await request.json();
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  if (!stopJob(jobId)) {
    return NextResponse.json({ error: 'Job is not running' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
