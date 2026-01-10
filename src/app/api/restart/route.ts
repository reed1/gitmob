import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST() {
  execSync('systemctl --user restart gitmob');
  return NextResponse.json({ success: true });
}
