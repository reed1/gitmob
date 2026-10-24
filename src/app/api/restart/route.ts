import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

// run_production.sh rebuilds on the way up, so restarting is all this does. --no-block queues
// the restart and returns, letting this response go out before systemd stops the server.
export async function POST() {
  execSync('systemctl --user restart --no-block gitmob');
  return NextResponse.json({ success: true });
}
