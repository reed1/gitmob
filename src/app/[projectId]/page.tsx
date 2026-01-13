'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  path: string;
  tags?: string[];
}

interface GitStatus {
  staged: { path: string; status: string }[];
  unstaged: { path: string; status: string }[];
  untracked: string[];
}

type Tab = 'files' | 'changes' | 'actions' | 'cli';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('changes');
  const [branch, setBranch] = useState<string>('');
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [showingDiff, setShowingDiff] = useState(false);
  const [showingFile, setShowingFile] = useState(false);
  const [viewFilePath, setViewFilePath] = useState<string | null>(null);
  const [viewFileFromGitUntracked, setViewFileFromGitUntracked] =
    useState(false);

  const goToFile = (filePath: string, fromGitUntracked = false) => {
    setViewFilePath(filePath);
    setViewFileFromGitUntracked(fromGitUntracked);
    setTab('files');
  };

  const handleStageFromPreview = async (filePath: string) => {
    await fetch(`/api/projects/${projectId}/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stage', file: filePath }),
    });
    setViewFileFromGitUntracked(false);
    setTab('changes');
    refreshStatus();
  };

  useEffect(() => {
    async function load() {
      const [projRes, branchRes, statusRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/git?action=branch`),
        fetch(`/api/projects/${projectId}/git?action=status`),
      ]);

      setProject(await projRes.json());
      setBranch((await branchRes.json()).branch);
      setStatus(await statusRes.json());
      setLoading(false);
    }
    load();
  }, [projectId]);

  const refreshStatus = async () => {
    const res = await fetch(`/api/projects/${projectId}/git?action=status`);
    setStatus(await res.json());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground/50">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
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
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{project?.id}</h1>
            <div className="text-sm text-foreground/50 flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-foreground/10 rounded text-xs">
                {branch}
              </span>
            </div>
          </div>
          {((tab === 'changes' && showingDiff) ||
            (tab === 'files' && showingFile)) && (
            <label className="flex items-center gap-2 text-sm text-foreground/60 cursor-pointer">
              <input
                type="checkbox"
                checked={wordWrap}
                onChange={(e) => setWordWrap(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-foreground/30 peer-checked:bg-foreground peer-checked:border-foreground flex items-center justify-center">
                {wordWrap && (
                  <svg
                    className="w-3 h-3 text-background"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              Wrap
            </label>
          )}
        </div>

        <nav className="flex border-t border-foreground/10">
          {(['files', 'changes', 'actions', 'cli'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-foreground/50'
              }`}
            >
              {t === 'cli' ? 'CLI' : t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'changes' && status && (
                <span className="ml-1 text-xs">
                  (
                  {status.staged.length +
                    status.unstaged.length +
                    status.untracked.length}
                  )
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-auto">
        {tab === 'files' && (
          <FileBrowser
            projectId={projectId}
            wordWrap={wordWrap}
            onShowingFileChange={setShowingFile}
            initialFilePath={viewFilePath}
            onInitialFileConsumed={() => setViewFilePath(null)}
            fromGitUntracked={viewFileFromGitUntracked}
            onStageRequest={handleStageFromPreview}
            onClearGitContext={() => setViewFileFromGitUntracked(false)}
          />
        )}
        {tab === 'changes' && (
          <ChangesView
            projectId={projectId}
            status={status}
            onRefresh={refreshStatus}
            wordWrap={wordWrap}
            onShowingDiffChange={setShowingDiff}
            onGoToFile={goToFile}
          />
        )}
        {tab === 'actions' && (
          <ActionsView projectId={projectId} onRefresh={refreshStatus} />
        )}
        {tab === 'cli' && project && <CLIView projectPath={project.path} />}
      </main>
    </div>
  );
}

function FileBrowser({
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

function ChangesView({
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
                    if (window.confirm(`Discard changes to ${selectedFile}? This cannot be undone.`)) {
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

function ActionsView({
  projectId,
  onRefresh,
}: {
  projectId: string;
  onRefresh: () => void;
}) {
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleAction = async (action: string, body?: object) => {
    setLoading(action);
    setResult(null);
    const res = await fetch(`/api/projects/${projectId}/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    setResult(data.result || (data.success ? 'Success' : 'Failed'));
    setLoading(null);
    if (action === 'commit') {
      setCommitMessage('');
    }
    onRefresh();
  };

  const generateCommitMessage = async () => {
    setLoading('generate');
    const res = await fetch(`/api/projects/${projectId}/git?action=diff-summary`);
    const data = await res.json();
    if (data.summary) {
      setCommitMessage(data.summary);
    }
    setLoading(null);
  };

  return (
    <div className="p-4 space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground/60">Commit</h3>
          <button
            onClick={generateCommitMessage}
            disabled={loading === 'generate' || commitMessage.trim() !== ''}
            className="px-2 py-1 text-xs bg-foreground/10 rounded active:opacity-80 disabled:opacity-30"
          >
            {loading === 'generate' ? 'Generating...' : 'Generate'}
          </button>
        </div>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className="w-full p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-sm resize-none h-24"
        />
        <button
          onClick={() => handleAction('commit', { message: commitMessage })}
          disabled={loading === 'commit' || !commitMessage.trim()}
          className="mt-2 w-full py-3 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-50"
        >
          {loading === 'commit' ? 'Committing...' : 'Commit'}
        </button>
      </section>

      <section>
        <h3 className="text-sm font-medium text-foreground/60 mb-3">Sync</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('pull')}
            disabled={loading === 'pull'}
            className="py-3 bg-blue-600 text-white font-medium rounded-lg active:opacity-80 disabled:opacity-50"
          >
            {loading === 'pull' ? 'Pulling...' : 'Pull'}
          </button>
          <button
            onClick={() => handleAction('push')}
            disabled={loading === 'push'}
            className="py-3 bg-green-600 text-white font-medium rounded-lg active:opacity-80 disabled:opacity-50"
          >
            {loading === 'push' ? 'Pushing...' : 'Push'}
          </button>
        </div>
      </section>

      {result && (
        <section>
          <h3 className="text-sm font-medium text-foreground/60 mb-2">
            Result
          </h3>
          <pre className="p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-auto max-h-48">
            {result}
          </pre>
        </section>
      )}
    </div>
  );
}

function CLIView({ projectPath }: { projectPath: string }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runCommand = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setOutput(null);
    const res = await fetch('/api/cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd: projectPath }),
    });
    const data = await res.json();
    setOutput(data.output);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      runCommand();
    }
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          autoCapitalize="off"
          className="flex-1 px-3 py-2 bg-foreground/5 border border-foreground/10 rounded-lg text-sm font-mono"
        />
        <button
          onClick={runCommand}
          disabled={loading || !command.trim()}
          className="px-4 py-2 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-50"
        >
          {loading ? 'Running...' : 'Run'}
        </button>
      </div>

      {output !== null && (
        <pre className="mt-4 flex-1 p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-auto">
          {output || '(no output)'}
        </pre>
      )}
    </div>
  );
}
