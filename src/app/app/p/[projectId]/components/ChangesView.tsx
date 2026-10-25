'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GitStatus } from '@/app/app/p/[projectId]/types';
import { KebabMenu, KebabMenuItem } from '@/app/app/KebabMenu';
import { ModalOverlay } from '@/components/ModalOverlay';
import { apiFetch } from '@/lib/api';
import { ReviewScreen } from './ReviewScreen';

export function ChangesView({
  projectId,
  status,
  onRefresh,
  goBack,
}: {
  projectId: string;
  status: GitStatus | null;
  onRefresh: () => Promise<void>;
  goBack: (fallback: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFile = searchParams.get('file');
  const isStaged = searchParams.get('staged') === '1';
  const isUntracked = searchParams.get('untracked') === '1';
  const diffKey = `${selectedFile}:${isStaged}:${isUntracked}`;
  // Keyed by the file it was turned on for, so opening another file drops back
  // to the contextual diff.
  const [fullDiffKey, setFullDiffKey] = useState<string | null>(null);
  const isFullDiff = fullDiffKey === diffKey;
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const openFile = (
    file: string,
    staged: boolean,
    untracked: boolean,
    replace = false
  ) => {
    const params = new URLSearchParams({ tab: 'changes', file });
    if (staged) params.set('staged', '1');
    if (untracked) params.set('untracked', '1');
    const url = `/app/p/${projectId}?${params}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  const closeFile = () => goBack(`/app/p/${projectId}?tab=changes`);

  const allFiles = status
    ? [
        ...status.staged.map((f) => ({
          path: f.path,
          isStaged: true,
          isUntracked: false,
        })),
        ...status.unstaged.map((f) => ({
          path: f.path,
          isStaged: false,
          isUntracked: false,
        })),
        ...status.untracked.map((f) => ({
          path: f,
          isStaged: false,
          isUntracked: true,
        })),
      ]
    : [];
  const currentIndex = allFiles.findIndex(
    (f) =>
      f.path === selectedFile &&
      f.isStaged === isStaged &&
      f.isUntracked === isUntracked
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allFiles.length - 1;

  const navigateTo = (index: number) => {
    const file = allFiles[index];
    openFile(file.path, file.isStaged, file.isUntracked, true);
  };

  const handleAction = async (action: string, file: string) => {
    await apiFetch(`/api/projects/${projectId}/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, file }),
    });
    closeFile();
    onRefresh();
  };

  const diffActions = selectedFile !== null && (
    <>
      {isStaged ? (
        <button
          onClick={() => handleAction('unstage', selectedFile)}
          className="shrink-0 px-3 py-1 text-sm bg-yellow-600 text-white rounded active:opacity-80"
        >
          Unstage
        </button>
      ) : (
        <button
          onClick={() => handleAction('stage', selectedFile)}
          className="shrink-0 px-3 py-1 text-sm bg-green-600 text-white rounded active:opacity-80"
        >
          Stage
        </button>
      )}
      <KebabMenu label={`Actions for ${selectedFile}`}>
        <KebabMenuItem
          onSelect={() =>
            // A sideways jump into the same file, not a step deeper: back belongs to
            // the change list this diff was opened from.
            router.replace(
              `/app/p/${projectId}?tab=files&file=${encodeURIComponent(selectedFile)}`
            )
          }
        >
          View
        </KebabMenuItem>
        {!isUntracked && (
          <KebabMenuItem
            onSelect={() => setFullDiffKey(isFullDiff ? null : diffKey)}
          >
            {isFullDiff ? 'Contextual Diff' : 'Full Diff'}
          </KebabMenuItem>
        )}
        {!isStaged && (
          <KebabMenuItem danger onSelect={() => setConfirmDiscard(true)}>
            {isUntracked ? 'Delete' : 'Discard'}
          </KebabMenuItem>
        )}
        <KebabMenuItem
          disabled={!hasPrev}
          onSelect={() => navigateTo(currentIndex - 1)}
        >
          Previous File
        </KebabMenuItem>
        <KebabMenuItem
          disabled={!hasNext}
          onSelect={() => navigateTo(currentIndex + 1)}
        >
          Next File
        </KebabMenuItem>
      </KebabMenu>
    </>
  );

  // Laid over the change list instead of replacing it: the list stays mounted underneath,
  // scrolled where it was, for back to uncover.
  const diff = selectedFile !== null && (
    <div className="fixed inset-0 z-20">
      <ReviewScreen
        key={diffKey}
        projectId={projectId}
        commit={null}
        side={isUntracked ? 'untracked' : isStaged ? 'staged' : 'unstaged'}
        path={selectedFile}
        full={isFullDiff}
        actions={diffActions}
        onBack={closeFile}
      />
      {confirmDiscard && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClose={() => setConfirmDiscard(false)}
        >
          <div
            className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-foreground/10">
              <h3 className="font-medium">
                {isUntracked ? 'Delete file?' : 'Discard changes?'}
              </h3>
            </div>
            <div className="px-4 py-3 text-sm text-foreground/80">
              {isUntracked ? 'Delete untracked file ' : 'Discard changes to '}
              <span className="font-mono break-all">{selectedFile}</span>? This
              cannot be undone.
            </div>
            <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
              <button
                data-modal-cancel
                onClick={() => setConfirmDiscard(false)}
                className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDiscard(false);
                  handleAction(
                    isUntracked ? 'discard-untracked' : 'discard',
                    selectedFile
                  );
                }}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:opacity-90"
              >
                {isUntracked ? 'Delete' : 'Discard'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );

  if (!status) {
    return (
      <>
        <div className="p-4 text-foreground/50">Loading...</div>
        {diff}
      </>
    );
  }

  const hasChanges =
    status.staged.length + status.unstaged.length + status.untracked.length > 0;
  const partiallyStagedCount = status.staged.filter(
    (f) => f.partiallyStaged
  ).length;

  const content = hasChanges ? (
    <div className="divide-y divide-foreground/10">
      {status.staged.length > 0 && (
        <section>
          <h3 className="px-4 py-2 text-sm font-medium text-green-400 bg-green-400/10">
            Staged ({status.staged.length})
            {partiallyStagedCount > 0 && (
              <span className="text-yellow-400">
                {' '}
                &middot; {partiallyStagedCount} partially staged
              </span>
            )}
          </h3>
          {status.staged.map((file) => (
            <button
              key={file.path}
              onClick={() => openFile(file.path, true, false)}
              className="w-full px-4 py-3 text-left flex items-center gap-2 active:bg-foreground/5"
            >
              <span
                className={`text-xs font-mono w-5 shrink-0 ${
                  file.partiallyStaged ? 'text-yellow-400' : 'text-green-400'
                }`}
              >
                {file.status}
              </span>
              <span
                className={`truncate text-sm font-mono min-w-0 ${
                  file.partiallyStaged ? 'text-yellow-400' : ''
                }`}
              >
                {file.path}
              </span>
            </button>
          ))}
        </section>
      )}

      {status.unstaged.length > 0 && (
        <section>
          <h3 className="px-4 py-2 text-sm font-medium text-yellow-400 bg-yellow-400/10">
            Modified ({status.unstaged.length})
          </h3>
          {status.unstaged.map((file) => (
            <button
              key={file.path}
              onClick={() => openFile(file.path, false, false)}
              className="w-full px-4 py-3 text-left flex items-center gap-2 active:bg-foreground/5"
            >
              <span className="text-xs font-mono w-5 shrink-0 text-yellow-400">
                {file.status}
              </span>
              <span className="truncate text-sm font-mono min-w-0">
                {file.path}
              </span>
            </button>
          ))}
        </section>
      )}

      {status.untracked.length > 0 && (
        <section>
          <div className="px-4 py-2 bg-foreground/5">
            <h3 className="text-sm font-medium text-foreground/50">
              Untracked ({status.untracked.length})
            </h3>
          </div>
          {status.untracked.map((file) => (
            <button
              key={file}
              onClick={() => openFile(file, false, true)}
              className="w-full px-4 py-3 text-left flex items-center gap-2 active:bg-foreground/5"
            >
              <span className="text-xs font-mono w-5 shrink-0 text-foreground/40">
                ?
              </span>
              <span className="truncate text-sm font-mono min-w-0">{file}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  ) : (
    <div className="p-8 text-center text-foreground/50">
      <svg
        className="w-12 h-12 mx-auto mb-4 text-foreground/20"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p>Working tree clean</p>
    </div>
  );

  return (
    <>
      {content}
      {diff}
    </>
  );
}
