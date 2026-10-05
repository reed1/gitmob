'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, addToast } from '../../../lib/api';
import { copyText } from '../../../lib/clipboard';
import { useOutsideClick } from '../../../lib/use-outside-click';
import { goHome } from '../../../lib/app-depth';
import { imageTypeFor } from '../../../lib/image-types';
import { useBackToDismiss } from '../../../lib/use-back-to-dismiss';
import { ImagePreview } from '../../../components/ImagePreview';

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

function ImageIcon() {
  return (
    <svg
      className="w-5 h-5 shrink-0 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function FileDetails({ entry }: { entry: SharedFile }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="truncate">{entry.name}</div>
      <div className="text-xs text-foreground/50">
        {formatSize(entry.size)} · {formatModified(entry.modified)}
      </div>
    </div>
  );
}

function EntryMenu({
  entry,
  root,
  onDelete,
}: {
  entry: SharedFile;
  root: string;
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
        <KebabIcon />
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
            onClick={async () => {
              setOpen(false);
              const absolutePath = `${root}/${entry.path}`;
              if (await copyText(absolutePath)) {
                addToast(`Copied ${absolutePath}`, 'success');
              } else {
                addToast('Could not copy to the clipboard');
              }
            }}
            className={itemClass}
          >
            Copy path
          </button>
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

function KebabIcon() {
  return (
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
  );
}

function FolderMenu({
  disabled,
  onMoveAll,
}: {
  disabled: boolean;
  onMoveAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(open, menuRef, () => setOpen(false));

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-foreground/60 hover:bg-foreground/10 active:opacity-80"
        aria-label="Folder actions"
      >
        <KebabIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-background border border-foreground/20 rounded-lg shadow-lg py-1 min-w-[160px]">
          <button
            onClick={() => {
              setOpen(false);
              onMoveAll();
            }}
            disabled={disabled}
            className="block w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 disabled:opacity-40"
          >
            Move all to rbak
          </button>
        </div>
      )}
    </div>
  );
}

function ImageOverlay({
  entry,
  onClose,
}: {
  entry: SharedFile;
  onClose: () => void;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="border-b border-foreground/10 px-4 py-3 flex items-center gap-3">
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
          <h2 className="text-base font-medium truncate">{entry.name}</h2>
          <div className="text-xs text-foreground/50">
            {formatSize(entry.size)}
            {size && ` · ${size.width} × ${size.height}`}
          </div>
        </div>
        <a
          href={`/api/files/download?path=${encodeURIComponent(entry.path)}`}
          download={entry.name}
          className="px-3 py-1.5 text-sm bg-foreground/10 hover:bg-foreground/20 rounded-lg"
        >
          Download
        </a>
      </header>
      <div className="flex-1 min-h-0">
        <ImagePreview
          src={`/api/files/image?path=${encodeURIComponent(entry.path)}`}
          alt={entry.name}
          onSize={setSize}
        />
      </div>
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
  const [moving, setMoving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SharedFile | null>(null);
  const [preview, setPreview] = useState<SharedFile | null>(null);
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

  const moveAllToRbak = async () => {
    setMoving(true);
    try {
      const res = await apiFetch(
        `/api/files/rbak?path=${encodeURIComponent(path)}`,
        { method: 'POST' }
      );
      if (!res.ok) return;
      const { moved } = await res.json();
      addToast(
        moved === 1 ? 'Moved 1 item to rbak' : `Moved ${moved} items to rbak`,
        'success'
      );
      await load();
    } finally {
      setMoving(false);
    }
  };

  useBackToDismiss(preview !== null, () => setPreview(null));

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
            onClick={() => goHome(router)}
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
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-sm bg-foreground text-background rounded-lg disabled:opacity-40"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <FolderMenu
            disabled={loading || moving || entries.length === 0}
            onMoveAll={moveAllToRbak}
          />
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
              ) : imageTypeFor(entry.name) ? (
                <button
                  onClick={() => setPreview(entry)}
                  className="flex-1 min-w-0 px-4 py-3 text-left flex items-center gap-3 active:bg-foreground/5"
                >
                  <ImageIcon />
                  <FileDetails entry={entry} />
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
                  <FileDetails entry={entry} />
                </div>
              )}
              <EntryMenu
                entry={entry}
                root={root}
                onDelete={() => setDeleteTarget(entry)}
              />
            </div>
          ))
        )}
      </main>

      {preview && (
        <ImageOverlay entry={preview} onClose={() => setPreview(null)} />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(null);
          }}
        >
          <div
            className="bg-background border border-foreground/20 rounded-lg shadow-xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
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
      )}
    </div>
  );
}
