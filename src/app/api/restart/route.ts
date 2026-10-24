import { after, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// run_production.sh rebuilds on the way up, so restarting is all this does. It runs after the
// response, and unwatched: stopping the unit kills this server's whole cgroup, systemctl included.
export async function POST() {
  after(() => {
    spawn('systemctl', ['--user', 'restart', 'gitmob'], { stdio: 'ignore' });
  });
  return NextResponse.json({ success: true });
}
