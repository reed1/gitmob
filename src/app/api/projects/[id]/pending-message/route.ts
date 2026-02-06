import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PENDING_MESSAGES_DIR = join(
  homedir(),
  '.local/share/gitmob/pending-messages'
);

function encodeRepoPath(repoPath: string): string {
  return Buffer.from(repoPath).toString('base64url');
}

interface PendingMessage {
  repo_path: string;
  message: string;
  timestamp: string;
  source: string;
  short_options?: string[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const filename = encodeRepoPath(project.path) + '.json';
  const filepath = join(PENDING_MESSAGES_DIR, filename);

  if (!existsSync(filepath)) {
    return NextResponse.json({ pending: null });
  }

  try {
    const content = readFileSync(filepath, 'utf-8');
    const data: PendingMessage = JSON.parse(content);

    if (data.repo_path !== project.path) {
      return NextResponse.json({ pending: null });
    }

    return NextResponse.json({
      pending: {
        message: data.message,
        timestamp: data.timestamp,
        source: data.source,
        short_options: data.short_options ?? [],
      },
    });
  } catch {
    return NextResponse.json({ pending: null });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const filename = encodeRepoPath(project.path) + '.json';
  const filepath = join(PENDING_MESSAGES_DIR, filename);

  if (existsSync(filepath)) {
    unlinkSync(filepath);
  }

  return NextResponse.json({ success: true });
}
