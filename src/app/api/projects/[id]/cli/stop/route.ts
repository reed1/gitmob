import { NextResponse } from 'next/server';
import { stopCli } from '@/lib/cli';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!stopCli(id)) {
    return NextResponse.json({ error: 'Job is not running' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
