import { NextRequest, NextResponse } from 'next/server';
import { deleteJob, readJob, startJob } from '@/lib/cli-jobs';

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  const job = readJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function POST(request: NextRequest) {
  const { command, cwd, notify } = await request.json();

  const job = startJob({ script: command, cwd, notify });

  return NextResponse.json({ jobId: job.id, pid: job.pid });
}

export async function DELETE(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  deleteJob(jobId);

  return NextResponse.json({ success: true });
}
