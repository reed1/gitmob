'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAutoRefresh } from '../../lib/use-auto-refresh';
import {
  ClientJob,
  elapsedSince,
  formatSeconds,
  statusLabel,
} from '../../lib/job-status';
import { Modal } from './Modal';

/**
 * Cloning a configured project nobody has checked out here. The clone is a detached job, so
 * this box can be closed and reopened on one still running — and the notification lands
 * whether or not it is.
 */
export function CloneModal({
  projectId,
  repo,
  path,
  onCloned,
  onClose,
}: {
  projectId: string;
  repo: string;
  path: string;
  onCloned: () => void;
  onClose: () => void;
}) {
  const [job, setJob] = useState<ClientJob | null>(null);
  const [starting, setStarting] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const announced = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/clone`);
    const data = await res.json();
    setJob(data.job);
  }, [projectId]);

  const running = job?.status === 'running';

  useAutoRefresh(load, running ? 1000 : undefined);

  useEffect(() => {
    if (running) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job?.output, running]);

  // The card behind is still saying "not cloned"; tell the list to ask again. Once only —
  // the poll keeps handing back the same finished job.
  useEffect(() => {
    if (announced.current) return;
    if (job?.status === 'completed' && job.exitCode === 0 && !job.signal) {
      announced.current = true;
      onCloned();
    }
  }, [job, onCloned]);

  const clone = async () => {
    setStarting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/clone`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.job) setJob(data.job);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal heading="Clone project" subtitle={projectId} onClose={onClose}>
      <div className="px-4 py-3 space-y-2 text-xs">
        <div>
          <div className="text-foreground/50">Repository</div>
          <div className="font-mono break-all">{repo}</div>
        </div>
        <div>
          <div className="text-foreground/50">Into</div>
          <div className="font-mono break-all">{path}</div>
        </div>
      </div>

      {job && (
        <div className="px-4 pb-3 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className={statusLabel(job).className}>
              {statusLabel(job).text}
            </span>
            <span className="text-foreground/40 tabular-nums">
              {job.duration !== null
                ? formatSeconds(job.duration)
                : elapsedSince(job.startTime)}
            </span>
          </div>
          <pre
            ref={logRef}
            className="max-h-40 overflow-auto rounded bg-foreground/5 p-2 text-[11px] leading-snug whitespace-pre-wrap break-words"
          >
            {job.output || (running ? 'Starting...' : '(no output)')}
          </pre>
        </div>
      )}

      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Close
        </button>
        <button
          onClick={clone}
          disabled={running || starting}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-500/20 text-blue-300 active:opacity-80 disabled:opacity-40"
        >
          {running ? 'Cloning...' : job ? 'Clone again' : 'Clone'}
        </button>
      </div>
    </Modal>
  );
}
