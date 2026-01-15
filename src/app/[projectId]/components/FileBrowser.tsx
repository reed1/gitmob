'use client';

import { useState, useEffect } from 'react';

function FileViewer({
  projectId,
  filePath,
  wordWrap,
  onClose,
  showStageButton,
  onStage,
}: {
  projectId: string;
  filePath: string;
  wordWrap: boolean;
  onClose: () => void;
  showStageButton: boolean;
  onStage: () => void;
}) {
  const [content, setContent] = useState<{
    highlighted: string;
    language: string;
    lineCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fileName = filePath.split('/').pop() || filePath;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(
        `/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        setContent(await res.json());
      }
      setLoading(false);
    }
    load();
  }, [projectId, filePath]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground transition-colors"
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
            <h2 className="text-base font-medium truncate">{fileName}</h2>
            {content && (
              <div className="text-xs text-foreground/50">
                {content.language} · {content.lineCount} lines
              </div>
            )}
          </div>
          {showStageButton && (
            <button
              onClick={onStage}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded active:opacity-80"
            >
              Stage
            </button>
          )}
        </div>
        <div className="mt-1 text-xs text-foreground/40 truncate">
          {filePath}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-center text-foreground/50">Loading...</div>
        ) : content ? (
          content.lineCount === 0 ? (
            <div className="p-4 text-center text-foreground/30">Empty file</div>
          ) : (
            <div
              className={`text-xs font-mono [&_pre]:!bg-transparent [&_pre]:p-4 [&_code]:!bg-transparent ${
                wordWrap
                  ? '[&_pre]:whitespace-pre-wrap'
                  : '[&_pre]:overflow-x-auto'
              }`}
              dangerouslySetInnerHTML={{ __html: content.highlighted }}
            />
          )
        ) : (
          <div className="p-4 text-center text-foreground/50">
            Failed to load file
          </div>
        )}
      </div>
    </div>
  );
}

export function FileBrowser({
  projectId,
  wordWrap,
  onShowingFileChange,
  initialFilePath,
  onInitialFileConsumed,
  fromGitUntracked,
  onStageRequest,
  onClearGitContext,
}: {
  projectId: string;
  wordWrap: boolean;
  onShowingFileChange: (showing: boolean) => void;
  initialFilePath: string | null;
  onInitialFileConsumed: () => void;
  fromGitUntracked: boolean;
  onStageRequest: (filePath: string) => void;
  onClearGitContext: () => void;
}) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<
    { name: string; path: string; isDirectory: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilePath) {
      setSelectedFile(initialFilePath);
      onInitialFileConsumed();
    }
  }, [initialFilePath, onInitialFileConsumed]);

  useEffect(() => {
    onShowingFileChange(selectedFile !== null);
  }, [selectedFile, onShowingFileChange]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
      );
      setEntries(await res.json());
      setLoading(false);
    }
    load();
  }, [projectId, path]);

  const navigateTo = (entry: { path: string; isDirectory: boolean }) => {
    if (entry.isDirectory) {
      setPath(entry.path);
    } else {
      onClearGitContext();
      setSelectedFile(entry.path);
    }
  };

  const goUp = () => {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    setPath(parts.join('/'));
  };

  if (selectedFile) {
    return (
      <FileViewer
        projectId={projectId}
        filePath={selectedFile}
        wordWrap={wordWrap}
        onClose={() => setSelectedFile(null)}
        showStageButton={fromGitUntracked}
        onStage={() => onStageRequest(selectedFile)}
      />
    );
  }

  return (
    <div className="divide-y divide-foreground/10">
      {path && (
        <button
          onClick={goUp}
          className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-foreground/5"
        >
          <svg
            className="w-5 h-5 text-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>
          <span className="text-foreground/70">..</span>
        </button>
      )}

      {loading ? (
        <div className="p-4 text-center text-foreground/50">Loading...</div>
      ) : (
        entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => navigateTo(entry)}
            className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-foreground/5"
          >
            {entry.isDirectory ? (
              <svg
                className="w-5 h-5 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-foreground/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
            <span className="truncate">{entry.name}</span>
          </button>
        ))
      )}
    </div>
  );
}
