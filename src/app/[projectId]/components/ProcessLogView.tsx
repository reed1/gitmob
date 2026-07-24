'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function ProcessLogView({
  projectId,
  processName,
  onBack,
}: {
  projectId: string;
  processName: string;
  onBack: () => void;
}) {
  const [output, setOutput] = useState('');
  const [unitExists, setUnitExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [wrap, setWrap] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const fetchLog = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/process?action=logs&name=${encodeURIComponent(processName)}`
    );
    const data = await res.json();
    setOutput(data.output ?? '');
    setUnitExists(data.unitExists ?? false);
    setLoading(false);
  }, [projectId, processName]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-foreground/10 bg-background">
        <button
          onClick={onBack}
          className="p-1 text-foreground/50 active:opacity-80"
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
        <div className="flex-1 min-w-0 font-medium truncate">{processName}</div>
        <button
          onClick={() => setWrap((w) => !w)}
          className={`px-2 py-1 text-xs rounded border ${
            wrap
              ? 'bg-foreground/10 border-foreground/20'
              : 'border-foreground/10 text-foreground/50'
          }`}
        >
          Wrap
        </button>
        <button
          onClick={fetchLog}
          className="px-2 py-1 text-xs rounded border border-foreground/10 text-foreground/50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-foreground/50">
          Loading logs...
        </div>
      ) : !unitExists ? (
        <div className="p-4 text-center text-foreground/50">
          No logs for{' '}
          <code className="px-1 bg-foreground/10 rounded">{processName}</code>.
          <div className="mt-2 text-sm">
            Logs are only available after the process has been started at least
            once.
          </div>
        </div>
      ) : (
        <pre
          ref={preRef}
          className={`flex-1 min-h-0 overflow-auto p-3 text-xs font-mono leading-relaxed ${
            wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
          }`}
        >
          {output || '(empty)'}
        </pre>
      )}
    </div>
  );
}
