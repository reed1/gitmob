import { CliJob, readJob, startJob, stopJob } from './cli-jobs';
import { Project } from './projects';
import { projectPagePath } from './project-paths';

/**
 * One job id per project, so the CLI tab finds its last command again after a reload and a new
 * command replaces the last one's log instead of piling up logs nothing points at.
 */
function cliJobId(projectId: string): string {
  return `cli-${projectId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export function readCliJob(
  projectId: string
): (CliJob & { output: string }) | null {
  return readJob(cliJobId(projectId));
}

export function startCli(
  project: Project,
  command: string,
  notify: boolean
): CliJob {
  return startJob({
    script: command,
    cwd: project.path,
    jobId: cliJobId(project.id),
    notify,
    notifyUrl: `${projectPagePath(project.id)}?tab=cli`,
  });
}

export function stopCli(projectId: string): boolean {
  return stopJob(cliJobId(projectId));
}
