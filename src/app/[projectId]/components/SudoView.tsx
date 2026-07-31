'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

interface SudoTarget {
  name: string;
  ssh: string;
  enabled: boolean;
  enabledAt: number | null;
}

type SudoAction = 'on' | 'off' | 'status';

function formatAge(since: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - since) / 60000));
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function busyLabel(action: SudoAction): string {
  if (action === 'on') return 'Enabling…';
  if (action === 'off') return 'Disabling…';
  if (action === 'status') return 'Checking…';
  throw new Error(`Unexpected action: ${action}`);
}

export function SudoView({ projectId }: { projectId: string }) {
  const [targets, setTargets] = useState<SudoTarget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{
    target: string;
    action: SudoAction;
  } | null>(null);
  const [output, setOutput] = useState<{ target: string; text: string } | null>(
    null
  );

  const fetchTargets = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/sudo`);
    const data = await res.json();
    if (res.ok) {
      setTargets(data.targets);
      setError(null);
    } else {
      setError(data.error || 'Could not read sudo state');
    }
  }, [projectId]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const run = async (target: string, action: SudoAction) => {
    setBusy({ target, action });
    setOutput(null);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/sudo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, action }),
      });
      const data = await res.json();
      if (data.targets) setTargets(data.targets);
      setOutput({ target, text: data.output || data.error || '' });
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="p-4 space-y-2 text-center">
        <div className="text-red-500">Could not read sudo state</div>
        <pre className="p-2 text-xs text-left bg-foreground/5 border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap">
          {error}
        </pre>
        <button
          onClick={fetchTargets}
          className="px-3 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!targets) {
    return (
      <div className="p-4 text-center text-foreground/50">
        Loading targets...
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <div className="p-4 text-center text-foreground/50">
        No push targets configured for this project.
        <div className="mt-2 text-sm">
          Add a <code className="px-1 bg-foreground/10 rounded">push</code>{' '}
          section to the project YAML to manage passwordless sudo.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {targets.map((target) => {
        const targetBusy = busy?.target === target.name;
        return (
          <div
            key={target.name}
            className={`p-3 border rounded-lg ${
              target.enabled
                ? 'border-purple-500/50 bg-purple-500/10'
                : 'border-foreground/10 bg-foreground/5'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-2.5 h-2.5 shrink-0 rounded-full ${
                    target.enabled ? 'bg-purple-500' : 'bg-foreground/30'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{target.name}</div>
                  <div className="text-xs text-foreground/50 truncate">
                    {target.ssh}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => run(target.name, 'status')}
                  disabled={busy !== null}
                  className="px-2 py-1.5 text-xs bg-foreground/10 border border-foreground/15 rounded active:opacity-80 disabled:opacity-40"
                >
                  Check
                </button>
                {target.enabled ? (
                  <button
                    onClick={() => run(target.name, 'off')}
                    disabled={busy !== null}
                    className="px-2 py-1.5 text-xs bg-red-600 text-white rounded active:opacity-80 disabled:opacity-40"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    onClick={() => run(target.name, 'on')}
                    disabled={busy !== null}
                    className="px-2 py-1.5 text-xs bg-purple-600 text-white rounded active:opacity-80 disabled:opacity-40"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 text-xs">
              {targetBusy ? (
                <span className="text-foreground/60">
                  {busyLabel(busy.action)} (SSH, may take a while)
                </span>
              ) : target.enabled ? (
                <span className="text-purple-400">
                  Passwordless sudo enabled
                  {target.enabledAt !== null &&
                    ` · ${formatAge(target.enabledAt)} ago`}
                </span>
              ) : (
                <span className="text-foreground/40">
                  Not enabled (per local cache)
                </span>
              )}
            </div>

            {output?.target === target.name && output.text && (
              <pre className="mt-2 p-2 text-xs bg-background border border-foreground/10 rounded overflow-x-auto whitespace-pre-wrap">
                {output.text}
              </pre>
            )}
          </div>
        );
      })}

      <p className="text-xs text-foreground/40 pt-1">
        State comes from the local <code>pt sudo</code> cache, which is keyed by
        SSH host — servers shared with another project show there too, and
        toggles made from a different machine are invisible until you hit Check.
      </p>
    </div>
  );
}
