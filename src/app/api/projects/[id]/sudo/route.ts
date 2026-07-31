import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { getSudoTargets, runPtSudo, SudoAction } from '@/lib/sudo';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    return NextResponse.json({ targets: await getSudoTargets(project) });
  } catch (err) {
    // Reporting every target as disabled would be a lie about a security setting, so the
    // failure has to reach the user instead.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'pt sudo list failed' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { target, action } = await request.json();

  if (!project.push?.[target]) {
    return NextResponse.json(
      { error: `Unknown push target: ${target}` },
      { status: 400 }
    );
  }

  if (action !== 'on' && action !== 'off' && action !== 'status') {
    return NextResponse.json(
      { error: `Invalid action: ${action}` },
      { status: 400 }
    );
  }

  const result = await runPtSudo(project, target, action as SudoAction);
  // A failed refresh must not mask the action's own result; the client keeps its last state.
  const targets = await getSudoTargets(project).catch(() => undefined);

  if (!result.success) {
    return NextResponse.json(
      {
        error: `pt sudo ${target} ${action} failed`,
        output: result.output,
        targets,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, output: result.output, targets });
}
