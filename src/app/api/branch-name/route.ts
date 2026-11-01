import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { suggestBranchName } from '@/lib/branch-name';

export async function POST(request: NextRequest) {
  const { description } = await request.json();

  if (typeof description !== 'string' || description.trim() === '') {
    return NextResponse.json(
      { error: 'Nothing to name a branch after' },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({
      branch: await suggestBranchName(description.trim()),
    });
  } catch (err) {
    return errorResponse(request, err, 'Branch naming failed');
  }
}
