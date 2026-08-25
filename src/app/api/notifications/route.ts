import { NextRequest, NextResponse } from 'next/server';
import {
  addDevice,
  publicKey,
  readDevices,
  removeDevice,
} from '@/lib/notifications';

export async function GET() {
  return NextResponse.json({
    publicKey: publicKey(),
    devices: readDevices().map((d) => ({
      endpoint: d.subscription.endpoint,
      label: d.label,
      createdAt: d.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { subscription, label } = await request.json();

  if (!subscription?.endpoint) {
    return NextResponse.json(
      { error: 'subscription required' },
      { status: 400 }
    );
  }

  addDevice(subscription, label || 'Unnamed device');

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  removeDevice(endpoint);

  return NextResponse.json({ success: true });
}
