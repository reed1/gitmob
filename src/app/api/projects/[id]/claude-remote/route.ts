import { NextRequest, NextResponse } from 'next/server';
import { spawn, execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { getProject } from '@/lib/projects';

// Workaround: claude remote-control hangs indefinitely when hooks are enabled
// (https://github.com/anthropics/claude-code/issues/9542).
// Temporarily set disableAllHooks before spawning, then restore after.
const SETTINGS_PATH = join(homedir(), '.claude/settings.json');

function disableHooks() {
  execSync(
    [
      `jq '. + {disableAllHooks: true}' '${SETTINGS_PATH}' > '${SETTINGS_PATH}.tmp'`,
      `cat '${SETTINGS_PATH}.tmp' > '${SETTINGS_PATH}'`,
      `rm '${SETTINGS_PATH}.tmp'`,
    ].join(' && ')
  );
}

function restoreHooks() {
  execSync(
    [
      `jq 'del(.disableAllHooks)' '${SETTINGS_PATH}' > '${SETTINGS_PATH}.tmp'`,
      `cat '${SETTINGS_PATH}.tmp' > '${SETTINGS_PATH}'`,
      `rm '${SETTINGS_PATH}.tmp'`,
    ].join(' && ')
  );
}

function restoreHooksAfterDelay() {
  setTimeout(restoreHooks, 10000);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  disableHooks();

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const child = spawn('claude', ['remote-control'], {
        cwd: project.path,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for URL'));
      }, 10000);

      let output = '';

      const onData = (data: Buffer) => {
        output += data.toString();
        const match = output.match(/https:\/\/\S+/);
        if (match) {
          clearTimeout(timeout);
          child.stdout!.removeListener('data', onData);
          child.stderr!.removeListener('data', onData);
          child.unref();
          resolve(match[0]);
        }
      };

      child.stdout!.on('data', onData);
      child.stderr!.on('data', onData);

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `Process exited with code ${code} before URL was found. Output: ${output}`
          )
        );
      });
    });

    restoreHooksAfterDelay();
    return NextResponse.json({ url });
  } catch (e) {
    restoreHooks();
    throw e;
  }
}
