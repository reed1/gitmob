import { NextRequest, NextResponse } from 'next/server';

const DOOIT_API_BASE = process.env.NEXT_PUBLIC_DOOIT_DOMAIN + '/api/v1/dooit';
const DOOIT_API_KEY = process.env.DOOIT_API_KEY;

const GET_ACTIONS = ['workspaces', 'todos'] as const;
const POST_ACTIONS = ['add_workspace', 'add_todo', 'update_todo', 'delete_todo', 'delete_workspace'] as const;

async function doitFetch(url: string, options?: RequestInit) {
  if (!DOOIT_API_BASE || !DOOIT_API_KEY) {
    return NextResponse.json({ error: 'Dooit not configured' }, { status: 500 });
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': DOOIT_API_KEY,
      ...options?.headers,
    },
  });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!GET_ACTIONS.includes(action as typeof GET_ACTIONS[number])) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const url = `${DOOIT_API_BASE}/${action}?${searchParams.toString().replace(/action=[^&]+&?/, '')}`;
  return doitFetch(url);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const body = await request.json();

  if (!POST_ACTIONS.includes(action as typeof POST_ACTIONS[number])) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return doitFetch(`${DOOIT_API_BASE}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
