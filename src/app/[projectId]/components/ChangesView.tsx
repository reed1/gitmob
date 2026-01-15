'use client';

import { useState, useEffect } from 'react';
import { GitStatus } from '../types';

export function ChangesView({
  projectId,
  status,
  onRefresh,
  wordWrap,
  onShowingDiffChange,
  onGoToFile,
}: {
  projectId: string;
  status: GitStatus | null;
  onRefresh: () => void;
  wordWrap: boolean;
  onShowingDiffChange: (showing: boolean) => void;
  onGoToFile: (filePath: string, fromGitUntracked?: boolean) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [isStaged, setIsStaged] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    onShowingDiffChange(selectedFile !== null);
  }, [selectedFile, onShowingDiffChange]);

  useEffect(() => {
    if (selectedFile) {
      loadDiff(selectedFile, isStaged);
    }
  }, [selectedFile, isStaged, projectId]);

  const loadDiff = async (file: string, staged: boolean) => {
    const res = await fetch(
      `/api/projects/${projectId}/git?action=diff&file=${encodeURIComponent(file)}&staged=${staged}`
    );
    const data = await res.json();
    setDiff(data.diff);
  };

  const handleAction = async (action: string, file: string) => {
    setActionLoading(true);
    await fetch(`/api/projects/${projectId}/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, file }),
    });
    setSelectedFile(null);
    setDiff('');
    onRefresh();
    setActionLoading(false);
  };

  if (selectedFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 bg-background border-b border-foreground/10 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => setSelectedFile(null)}
            className="text-foreground/50 hover:text-foreground"
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
          <span className="text-sm truncate flex-1 mx-2">{selectedFile}</span>
          <div className="flex gap-2">
            <button
              onClick={() => onGoToFile(selectedFile)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded active:opacity-80"
            >
              View
            </button>
            {isStaged ? (
              <button
                onClick={() => handleAction('unstage', selectedFile)}
                disabled={actionLoading}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded active:opacity-80 disabled:opacity-50"
              >
                Unstage
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Discard changes to ${selectedFile}? This cannot be undone.`
                      )
                    ) {
                      handleAction('discard', selectedFile);
                    }
                  }}
                  disabled={actionLoading}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded active:opacity-80 disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  onClick={() => handleAction('stage', selectedFile)}
                  disabled={actionLoading}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded active:opacity-80 disabled:opacity-50"
                >
                  Stage
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 text-xs font-mono">
          <div
            className={
              wordWrap
                ? 'whitespace-pre-wrap'
                : 'whitespace-pre w-max min-w-full'
            }
          >
            {diff.split('\n').map((line, i) => {
              let className = 'text-foreground/70';
              if (line.startsWith('+') && !line.startsWith('+++')) {
                className = 'text-green-400 bg-green-400/10';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                className = 'text-red-400 bg-red-400/10';
              } else if (line.startsWith('@@')) {
                className = 'text-blue-400';
              }
              return (
                <div key={i} className={className}>
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return <div className="p-4 text-foreground/50">Loading...</div>;
  }

  const hasChanges =
    status.staged.length + status.unstaged.length + status.untracked.length > 0;

  if (!hasChanges) {
    return (
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
  }

  return (
    <div className="divide-y divide-foreground/10">
      {status.staged.length > 0 && (
        <section>
          <h3 className="px-4 py-2 text-sm font-medium text-green-400 bg-green-400/10">
            Staged ({status.staged.length})
          </h3>
          {status.staged.map((file) => (
            <button
              key={file.path}
              onClick={() => {
                setSelectedFile(file.path);
                setIsStaged(true);
              }}
              className="w-full px-4 py-3 text-left flex items-center gap-2 active:bg-foreground/5"
            >
              <span className="text-xs font-mono w-5 text-green-400">
                {file.status}
              </span>
              <span className="truncate text-sm font-mono">{file.path}</span>
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
              onClick={() => {
                setSelectedFile(file.path);
                setIsStaged(false);
              }}
              className="w-full px-4 py-3 text-left flex items-center gap-2 active:bg-foreground/5"
            >
              <span className="text-xs font-mono w-5 text-yellow-400">
                {file.status}
              </span>
              <span className="truncate text-sm font-mono">{file.path}</span>
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
              onClick={() => onGoToFile(file, true)}
              className="w-full px-4 py-3 text-left flex items-center gap-2 active:bg-foreground/5"
            >
              <span className="text-xs font-mono w-5 text-foreground/40">
                ?
              </span>
              <span className="truncate text-sm font-mono">{file}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
