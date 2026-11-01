import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/error-response';
import { getModelCatalog } from '@/lib/desktop';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getModelCatalog());
  } catch (error) {
    return errorResponse(request, error, 'Unable to load models');
  }
}
