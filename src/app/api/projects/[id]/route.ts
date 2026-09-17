import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { getProject } from '@/lib/projects';
import { getGithubRepoUrl } from '@/lib/github';
import { getDesktopState } from '@/lib/workspaces';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const [githubUrl, { openIds }] = await Promise.all([
    getGithubRepoUrl(project.path),
    getDesktopState(),
  ]);

  return NextResponse.json({
    ...project,
    missing: !existsSync(project.path),
    openOnDesktop: openIds.includes(id),
    githubUrl,
  });
}
