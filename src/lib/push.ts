import { execFile } from 'child_process';
import { CliJob, readJob, startJob } from './cli-jobs';
import { Project } from './projects';
import {
  buildCheckArgv,
  buildPushArgv,
  PushConfig,
  PushResolution,
  PushSelection,
} from './push-command';

interface PtPushJson {
  servers: { name: string; ssh: string; path: string | null }[];
  default_servers: string[];
  targets: string[];
  scope_targets: string[];
}

/**
 * `pt push config` is the only place the pick-list comes from: the servers are project config,
 * but the targets are the `push-*` tags in the project's ansible tree, and reading those here
 * would be a second implementation of pt's own discovery.
 */
export function getPushConfig(project: Project): Promise<PushConfig> {
  return new Promise((resolve, reject) => {
    execFile(
      'pt',
      ['push', 'config'],
      { cwd: project.path, timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        const raw: PtPushJson = JSON.parse(stdout);
        resolve({
          servers: raw.servers,
          defaultServers: raw.default_servers,
          targets: raw.targets,
          scopeTargets: raw.scope_targets,
        });
      }
    );
  });
}

/**
 * What the Push tab highlights from: pt's own answer for this selection, so the targets shown
 * are the ones it would deploy rather than a second reading of the pick-list.
 */
export function checkPush(
  project: Project,
  selection: PushSelection
): Promise<PushResolution> {
  const [command, ...args] = buildCheckArgv(selection);
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd: project.path, timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve(JSON.parse(stdout));
      }
    );
  });
}

/**
 * One job id per project, so a push found still running is the one this project started and a
 * new push replaces the last one's log instead of piling up deploy logs nobody reads.
 */
function pushJobId(projectId: string): string {
  return `push-${projectId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export function readPushJob(
  projectId: string
): (CliJob & { output: string }) | null {
  return readJob(pushJobId(projectId));
}

export function startPush(
  project: Project,
  selection: PushSelection,
  notify: boolean
): CliJob {
  return startJob({
    argv: buildPushArgv(selection),
    cwd: project.path,
    jobId: pushJobId(project.id),
    notify,
    notifyLabel: `Push ${project.id}`,
    notifyUrl: `/app/p/${project.id}`,
  });
}
