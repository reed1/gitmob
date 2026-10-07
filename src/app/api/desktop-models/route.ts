import { NextResponse } from 'next/server';
import { getModelCatalog } from '@/lib/desktop';

export async function GET() {
  try {
    return NextResponse.json(await getModelCatalog());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to load models',
      },
      { status: 500 }
    );
  }
}
