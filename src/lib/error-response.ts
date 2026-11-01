import { NextRequest, NextResponse } from 'next/server';

// The client gets the message to show; the journal gets the stack, which nothing else records for
// an error the route caught. Uncaught ones are logged by Next and `onRequestError` instead.
export function errorResponse(
  request: NextRequest,
  err: unknown,
  fallback: string
): NextResponse {
  console.error(
    `${request.method} ${request.nextUrl.pathname}${request.nextUrl.search} failed:`,
    err
  );
  return NextResponse.json(
    { error: err instanceof Error ? err.message : fallback },
    { status: 500 }
  );
}
