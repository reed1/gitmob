import { CliJob, readJob, startJob } from './cli-jobs';
import { Project } from './projects';

/**
 * One job id per project, so a clone found still running is this project's and a second attempt
 * replaces the last one's log instead of leaving failed clones piled up.
 */
function cloneJobId(projectId: string): string {
  return `clone-${projectId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export function readCloneJob(
  projectId: string
): (CliJob & { output: string }) | null {
  return readJob(cloneJobId(projectId));
}

/**
 * `gh repo clone`, which is what `rv open` runs at the desktop when it meets a project nobody
 * has cloned — the same command, without the terminal it asks for confirmation in. It takes
 * the ssh url out of the project config as readily as an `OWNER/REPO`, and git makes the
 * leading directories itself, so a project under a folder that does not exist needs no mkdir.
 *
 * Always notified: a clone is minutes of work started by somebody who then puts the phone away.
 */
export function startClone(project: Project, repo: string): CliJob {
  return startJob({
    argv: ['gh', 'repo', 'clone', repo, project.path],
    jobId: cloneJobId(project.id),
    notify: true,
    notifyLabel: `Clone ${project.id}`,
    notifyUrl: `/app/p/${project.id}`,
  });
}
