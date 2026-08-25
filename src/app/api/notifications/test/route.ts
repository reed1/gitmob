import { NextResponse } from 'next/server';
import { readDevices, sendNotification } from '@/lib/notifications';

export async function POST() {
  const devices = readDevices();
  if (devices.length === 0) {
    return NextResponse.json(
      { error: 'No device is subscribed' },
      { status: 400 }
    );
  }

  await sendNotification({
    title: 'GitMob test',
    body: `Delivered to ${devices.length} device${devices.length === 1 ? '' : 's'}`,
    tag: 'gitmob-test',
  });

  return NextResponse.json({ success: true, devices: devices.length });
}
