'use client';

import { CustomModelPicker } from './CustomModelPicker';
import type { CustomModel } from '../../lib/desktop-models';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToast, apiFetch } from '../../lib/api';
import { launchDesktopSession } from '../../lib/desktop-client';
import {
  DESKTOP_MODES,
  DesktopMode,
  DEFAULT_DESKTOP_MODE,
} from '../../lib/desktop-modes';
import { Modal } from './Modal';
import { KebabMenu, KebabMenuItem } from './KebabMenu';
import { SpeakButton, appendSpoken } from './SpeakButton';

/**
 * The one way a desktop session is started from this app — the project card's menu on the front
 * page, the Claude tab and a pinboard note (its text as the opening prompt) all open this. Mode,
 * opening prompt and dictation sit behind the one button, the same trade every other thing sent
 * to a session already makes. A second composer only means the two drift: the front page kept
 * its own for a while, and it was the one without a Speak button.
 *
 * Worktree opens the session in a new worktree instead, on a branch forked off main — named by
 * hand, or suggested from the opening prompt. A worktree is a project of its own, so the page
 * moves to it once the session is up.
 */
export function NewSessionModal({
  projectId,
  canonicalId,
  initialPrompt = '',
  onClose,
  onLaunched,
}: {
  projectId: string;
  canonicalId: string;
  initialPrompt?: string;
  onClose: () => void;
  onLaunched?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<DesktopMode>(DEFAULT_DESKTOP_MODE);
  const [inWorktree, setInWorktree] = useState(false);
  const [branch, setBranch] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [customModel, setCustomModel] = useState<CustomModel>();
  const [launching, setLaunching] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<
    {
      id: string;
      name: string;
      progress: number;
      path?: string;
      error?: string;
    }[]
  >([]);
  const uploadsPending = images.some((image) => !image.path);

  const uploadImages = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      setImages((previous) => [
        ...previous,
        { id, name: file.name, progress: 0 },
      ]);
      const update = (changes: Partial<(typeof images)[number]>) =>
        setImages((previous) =>
          previous.map((image) =>
            image.id === id ? { ...image, ...changes } : image
          )
        );
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/session-images');
      xhr.responseType = 'json';
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          update({ progress: event.loaded / event.total });
      };
      const fail = (message: string) => {
        update({ error: message });
        addToast(message);
      };
      xhr.onload = () => {
        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          typeof xhr.response?.path === 'string'
        ) {
          update({ path: xhr.response.path, progress: 1 });
        } else {
          fail(xhr.response?.error || `Upload failed (${xhr.status})`);
        }
      };
      xhr.onerror = () => fail('Image upload failed: network error');
      xhr.onabort = () => fail('Image upload cancelled');
      const body = new FormData();
      body.append('image', file);
      xhr.send(body);
    }
  };

  const missingBranch = inWorktree && branch.trim() === '';

  const suggestBranch = async () => {
    setSuggesting(true);
    try {
      const res = await apiFetch('/api/branch-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt }),
      });
      if (res.ok) setBranch((await res.json()).branch);
    } finally {
      setSuggesting(false);
    }
  };

  const launch = async () => {
    if (launching || missingBranch || uploadsPending) return;
    setLaunching(true);
    try {
      const launchedIn = await launchDesktopSession(
        projectId,
        mode,
        images.length
          ? `${images.map((image, index) => `image ${index + 1}: ${image.path}`).join('\n')}\n\n${prompt.trim()}`
          : prompt.trim(),
        inWorktree ? branch.trim() : '',
        customModel
      );
      if (launchedIn === null) return;

      onClose();
      if (launchedIn === projectId) {
        onLaunched?.();
      } else {
        router.push(`/app/p/${launchedIn}?tab=claude`);
      }
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Modal
      heading={inWorktree ? 'New session in a worktree' : 'New session'}
      subtitle={projectId}
      onClose={onClose}
    >
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as DesktopMode)}
            className="flex-1 min-w-0 text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2"
          >
            {DESKTOP_MODES.map((entry) => (
              <option key={entry.mode} value={entry.mode}>
                {entry.label}
              </option>
            ))}
          </select>
          <KebabMenu label="Session options" disabled={launching}>
            <KebabMenuItem onSelect={() => setInWorktree(!inWorktree)}>
              <span
                className={`flex items-center gap-2 ${inWorktree ? 'text-blue-500' : ''}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="6" cy="5" r="3" />
                  <circle cx="6" cy="19" r="3" />
                  <circle cx="18" cy="5" r="3" />
                  <path d="M6 8v8m12-8a8 8 0 0 1-8 8H6" />
                </svg>
                Worktree{inWorktree ? ' ✓' : ''}
              </span>
            </KebabMenuItem>
            <KebabMenuItem onSelect={() => fileInput.current?.click()}>
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"
                  />
                </svg>
                Image
              </span>
            </KebabMenuItem>
          </KebabMenu>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              uploadImages(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
        <CustomModelPicker
          value={customModel}
          onChange={setCustomModel}
          disabled={launching}
        />
        {inWorktree && (
          <div className="flex gap-2">
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="New branch, off main"
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 min-w-0 text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2"
            />
            <button
              onClick={suggestBranch}
              disabled={prompt.trim() === '' || suggesting}
              title="Name it from the opening prompt"
              aria-label="Name the branch from the opening prompt"
              className="shrink-0 px-3 py-2 rounded-lg bg-foreground/10 border border-foreground/15 active:bg-foreground/20 disabled:opacity-40"
            >
              <svg
                className={`w-4 h-4 ${suggesting ? 'animate-pulse' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </button>
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Opening prompt (optional)"
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-none"
        />
        {images.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Image uploads"
          >
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                disabled={!image.error || launching}
                onClick={() =>
                  setImages((previous) =>
                    previous.filter((entry) => entry.id !== image.id)
                  )
                }
                title={`Image ${index + 1}: ${image.name} — ${image.error ? `${image.error}. Click to remove` : image.path ? 'Uploaded' : `${Math.round(image.progress * 100)}% uploaded`}`}
                aria-label={`Image ${index + 1}: ${image.name}, ${image.error ? 'upload failed, remove' : image.path ? 'uploaded' : 'uploading'}`}
                className={`p-1 ${image.path ? 'text-green-500' : image.error ? 'text-red-500' : 'text-foreground/40'}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(image.progress * 100)}
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.25"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={2 * Math.PI * 6}
                    strokeDashoffset={2 * Math.PI * 6 * (1 - image.progress)}
                    transform="rotate(-90 8 8)"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="2"
                    fill="currentColor"
                    className={
                      !image.path && !image.error ? 'animate-pulse' : ''
                    }
                  />
                </svg>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <SpeakButton
            projectId={canonicalId}
            onText={(spoken) => setPrompt((prev) => appendSpoken(prev, spoken))}
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
            >
              Cancel
            </button>
            <button
              onClick={launch}
              disabled={launching || missingBranch || uploadsPending}
              className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              {launching
                ? inWorktree
                  ? 'Creating...'
                  : 'Starting...'
                : 'Start'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
