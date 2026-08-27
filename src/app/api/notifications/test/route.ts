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

  const deliveries = await sendNotification({
    title: 'GitMob test',
    body: 'Push is working on this device',
    tag: 'gitmob-test',
  });

  const delivered = deliveries.filter((d) => d.status === 'delivered').length;
  const gone = deliveries.filter((d) => d.status === 'gone').length;
  const failed = deliveries.filter((d) => d.status === 'failed').length;

  // A send that reached nobody used to answer `success` all the same, so a dead subscription
  // read as a working one right up until the notification never arrived.
  if (delivered === 0) {
    return NextResponse.json(
      {
        warning:
          gone > 0
            ? 'The push service no longer knows this subscription, so it has been dropped. Enable notifications again to register a live one.'
            : 'The push service could not be reached. Nothing was delivered.',
        delivered,
        gone,
        failed,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ delivered, gone, failed });
}
