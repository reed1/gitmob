'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, addToast } from '../../lib/api';
import { useOutsideClick } from '../../lib/use-outside-click';

interface SharedFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function formatModified(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function EntryMenu({
  entry,
  onDelete,
}: {
  entry: SharedFile;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(open, menuRef, () => setOpen(false));

  const itemClass =
    'block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10';

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-foreground/50 hover:bg-foreground/10 active:opacity-80"
        aria-label={`Actions for ${entry.name}`}
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
            d="M12 5v.01M12 12v.01M12 19v.01"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[140px]">
          {!entry.isDirectory && (
            <a
              href={`/api/files/download?path=${encodeURIComponent(entry.path)}`}
              download={entry.name}
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              Download
            </a>
          )}
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className={`${itemClass} text-red-500`}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function FilesPage() {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [root, setRoot] = useState('');
  const [entries, setEntries] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SharedFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const data = await res.json();
      setRoot(data.root);
      setEntries(data.entries);
    }
    setLoading(false);
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (files: FileList) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);

    setUploading(true);
    try {
      const res = await apiFetch(
        `/api/files?path=${encodeURIComponent(path)}`,
        {
          method: 'POST',
          body: form,
        }
      );
      if (!res.ok) return;
      const { uploaded } = await res.json();
      addToast(
        uploaded.length === 1
          ? `Uploaded ${uploaded[0]}`
          : `Uploaded ${uploaded.length} files`,
        'success'
      );
      await load();
    } finally {
      setUploading(false);
    }
  };

  const remove = async (entry: SharedFile) => {
    const res = await apiFetch(
      `/api/files?path=${encodeURIComponent(entry.path)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) return;
    addToast(`Deleted ${entry.name}`, 'success');
    await load();
  };

  const goUp = () => {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    setPath(parts.join('/'));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
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
            <h1 className="text-lg font-semibold">Files</h1>
            <div className="text-xs text-foreground/50 truncate">
              {root}
              {path && `/${path}`}
            </div>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-foreground/10 active:opacity-80"
          >
            <svg
              className={`w-5 h-5 text-foreground/60 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-sm bg-foreground text-background rounded-lg disabled:opacity-40"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) upload(files);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <main className="divide-y divide-foreground/10">
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
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-foreground/50">
            Nothing here yet — upload a file to get started
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.path} className="flex items-center pr-2">
              {entry.isDirectory ? (
                <button
                  onClick={() => setPath(entry.path)}
                  className="flex-1 min-w-0 px-4 py-3 text-left flex items-center gap-3 active:bg-foreground/5"
                >
                  <svg
                    className="w-5 h-5 shrink-0 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="flex-1 min-w-0 truncate">{entry.name}</span>
                  <svg
                    className="w-4 h-4 shrink-0 text-foreground/30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ) : (
                <div className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3">
                  <svg
                    className="w-5 h-5 shrink-0 text-foreground/40"
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
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{entry.name}</div>
                    <div className="text-xs text-foreground/50">
                      {formatSize(entry.size)} ·{' '}
                      {formatModified(entry.modified)}
                    </div>
                  </div>
                </div>
              )}
              <EntryMenu
                entry={entry}
                onDelete={() => setDeleteTarget(entry)}
              />
            </div>
          ))
        )}
      </main>

      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full">
              <div className="px-4 py-3 border-b border-foreground/10">
                <h3 className="font-medium">
                  {deleteTarget.isDirectory ? 'Delete folder?' : 'Delete file?'}
                </h3>
              </div>
              <div className="px-4 py-3 text-sm text-foreground/80">
                Delete{' '}
                <span className="font-mono break-all">{deleteTarget.name}</span>
                {deleteTarget.isDirectory && ' and everything inside it'}? This
                cannot be undone.
              </div>
              <div className="px-4 py-3 border-t border-foreground/10 flex justify-end gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const entry = deleteTarget;
                    setDeleteTarget(null);
                    remove(entry);
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
