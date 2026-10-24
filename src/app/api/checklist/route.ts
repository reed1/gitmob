import { NextRequest, NextResponse } from 'next/server';
import { isChecklists, readChecklists, saveChecklists } from '@/lib/checklist';

export async function GET() {
  return NextResponse.json({ checklists: readChecklists() });
}

/** Every list, every time: what is not sent is deleted. */
export async function PUT(request: NextRequest) {
  const { checklists } = await request.json();
  if (!isChecklists(checklists)) {
    return NextResponse.json(
      { error: 'Malformed checklists' },
      { status: 400 }
    );
  }
  await saveChecklists(checklists);
  return NextResponse.json({ success: true });
}
