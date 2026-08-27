import { NextRequest, NextResponse } from 'next/server';
import {
  addDevice,
  publicKey,
  readDevices,
  removeDevice,
  replaceDevice,
} from '@/lib/notifications';

export async function GET() {
  return NextResponse.json({
    publicKey: publicKey(),
    devices: readDevices().map((d) => ({
      endpoint: d.subscription.endpoint,
      label: d.label,
      createdAt: d.createdAt,
      installId: d.installId,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { subscription, label, installId, replaces } = await request.json();

  if (!subscription?.endpoint) {
    return NextResponse.json(
      { error: 'subscription required' },
      { status: 400 }
    );
  }

  // `replaces` comes from the service worker's pushsubscriptionchange handler: it knows the
  // endpoint it is standing in for, but neither the label nor the install id that device was
  // enrolled under, so the row carries those over.
  if (typeof replaces === 'string') replaceDevice(replaces, subscription);
  else
    addDevice(
      subscription,
      label || 'Unnamed device',
      typeof installId === 'string' ? installId : null
    );

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  removeDevice(
    endpoint,
    request.nextUrl.searchParams.get('reason') ?? 'unspecified'
  );

  return NextResponse.json({ success: true });
}
