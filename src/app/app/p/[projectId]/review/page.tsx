'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { apiFetch } from '../../../../../lib/api';
import { useAutoRefresh } from '../../../../../lib/use-auto-refresh';
import type { Review, ReviewFile, SkipReason } from '../../../../../lib/review';
import { Modal } from '../../../Modal';
import { DiffLines } from '../components/DiffLines';
import { HighlightedCode } from '../components/HighlightedCode';
import { WrapToggle } from '../components/WrapToggle';

const KIND_TAGS: Record<Exclude<ReviewFile['kind'], 'skipped'>, string> = {
  added: 'text-green-400 bg-green-400/10',
  modified: 'text-yellow-400 bg-yellow-400/10',
  deleted: 'text-red-400 bg-red-400/10',
  renamed: 'text-blue-400 bg-blue-400/10',
  copied: 'text-blue-400 bg-blue-400/10',
};

function Tag({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`shrink-0 text-[11px] leading-none px-1.5 py-1 rounded ${className}`}
    >
      {label}
    </span>
  );
}

function SkippedRow({ path, reason }: { path: string; reason: SkipReason }) {
  return (
    <div className="px-4 py-2 flex items-center gap-2 border-b border-foreground/10 bg-foreground/5">
      <span className="flex-1 min-w-0 text-sm font-mono break-all text-foreground/40">
        {path}
      </span>
      <Tag label={reason} className="text-foreground/50 bg-foreground/10" />
    </div>
  );
}

function FileSection({
  file,
  wordWrap,
}: {
  file: Exclude<ReviewFile, { kind: 'skipped' }>;
  wordWrap: boolean;
}) {
  return (
    <section className="border-b border-foreground/10">
      <div className="sticky top-0 z-[1] px-4 py-2 flex items-center gap-2 border-b border-foreground/10 bg-background">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono break-all">{file.path}</div>
          {(file.kind === 'renamed' || file.kind === 'copied') && (
            <div className="text-xs font-mono break-all text-foreground/50">
              from {file.from}
            </div>
          )}
        </div>
        <Tag label={file.kind} className={KIND_TAGS[file.kind]} />
      </div>
      {file.kind === 'added' ? (
        file.lineCount === 0 ? (
          <div className="px-4 py-3 text-xs text-foreground/30">Empty file</div>
        ) : (
          <HighlightedCode html={file.highlighted} wordWrap={wordWrap} />
        )
      ) : file.diff === '' ? (
        <div className="px-4 py-3 text-xs text-foreground/30">
          No content changes
        </div>
      ) : (
        <div className="p-4 overflow-x-auto text-xs font-mono">
          <DiffLines diff={file.diff} wordWrap={wordWrap} />
        </div>
      )}
    </section>
  );
}

export default function ReviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [failed, setFailed] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  // Past the line limit, the first answer is only that; Continue asks again with force.
  const [force, setForce] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch(
      `/api/projects/${projectId}/review${force ? '?force=1' : ''}`
    );
    if (!res.ok) {
      setFailed(true);
      return;
    }
    setReview(await res.json());
  }, [projectId, force]);

  useAutoRefresh(load);

  const backToChanges = () => router.replace(`/app/p/${projectId}?tab=changes`);

  const fileCount = review && !review.tooLarge ? review.files.length : null;

  return (
    <div className="h-dvh bg-background flex flex-col">
      <header className="border-b border-foreground/10 bg-background/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={backToChanges}
            aria-label="Back to Changes"
            className="text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Review</h1>
            <div className="text-sm text-foreground/50 truncate">
              {projectId}
              {review &&
                ` · ${review.scope === 'staged' ? 'staged' : 'all changes'}`}
              {fileCount !== null &&
                ` · ${fileCount} file${fileCount === 1 ? '' : 's'}`}
            </div>
          </div>
          <WrapToggle wordWrap={wordWrap} setWordWrap={setWordWrap} />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto">
        {failed ? (
          <div className="p-8 text-center text-foreground/50">
            Failed to load the changes
          </div>
        ) : review === null ? (
          <div className="p-8 text-center text-foreground/50">Loading...</div>
        ) : review.tooLarge ? null : review.files.length === 0 ? (
          <div className="p-8 text-center text-foreground/50">
            Working tree clean
          </div>
        ) : (
          review.files.map((file) =>
            file.kind === 'skipped' ? (
              <SkippedRow
                key={file.path}
                path={file.path}
                reason={file.reason}
              />
            ) : (
              <FileSection key={file.path} file={file} wordWrap={wordWrap} />
            )
          )
        )}
      </main>

      {review?.tooLarge && (
        <Modal
          heading="Large diff"
          subtitle={projectId}
          onClose={backToChanges}
        >
          <p className="px-4 py-3 text-sm text-foreground/70">
            These changes run past {review.limit.toLocaleString('en-US')} lines.
            Showing them all on one page may slow the browser down or hang it.
          </p>
          <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
            <button
              onClick={backToChanges}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Back
            </button>
            <button
              onClick={() => {
                setReview(null);
                setForce(true);
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background active:opacity-80"
            >
              Continue
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
