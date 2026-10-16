'use client';

import { useState } from 'react';
import { addToast } from '../../lib/api';
import { KebabMenuItem } from './KebabMenu';

interface ImageUpload {
  id: string;
  name: string;
  progress: number;
  path?: string;
  error?: string;
}

type ImageUploadsState = ReturnType<typeof useImageUploads>;

let nextUploadId = 0;

/**
 * Images handed to a session travel as paths: each is uploaded to the server's disk first, and
 * the session is told where to read it.
 */
export function useImageUploads() {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [images, setImages] = useState<ImageUpload[]>([]);

  const upload = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = String(nextUploadId++);
      setImages((previous) => [
        ...previous,
        { id, name: file.name, progress: 0 },
      ]);
      const update = (changes: Partial<ImageUpload>) =>
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

  return {
    setInput,
    images,
    pending: images.some((image) => !image.path),
    pick: () => input?.click(),
    upload,
    removeLast: () => setImages((previous) => previous.slice(0, -1)),
  };
}

export function withImagePaths(images: ImageUpload[], text: string): string {
  if (!images.length) return text;
  const paths = images
    .map((image, index) => `image ${index + 1}: ${image.path}`)
    .join('\n');
  return `${paths}\n\n${text}`;
}

export function ImageUploadMenuItem({
  uploads,
}: {
  uploads: ImageUploadsState;
}) {
  return (
    <KebabMenuItem onSelect={uploads.pick}>
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
  );
}

/**
 * The file picker the menu item opens, and a progress ring per image, filled green once it is
 * uploaded. The picker lives here rather than in the menu, which unmounts before a pick lands.
 * Removal works like Backspace: the rightmost image goes first.
 */
export function ImageUploads({
  uploads,
  disabled,
}: {
  uploads: ImageUploadsState;
  disabled?: boolean;
}) {
  const { setInput, upload, images, removeLast } = uploads;
  return (
    <>
      <input
        ref={setInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          upload(event.target.files);
          event.target.value = '';
        }}
      />
      {images.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Image uploads"
        >
          {images.map((image, index) => (
            <span
              key={image.id}
              title={`Image ${index + 1}: ${image.name} — ${image.error ?? (image.path ? 'Uploaded' : `${Math.round(image.progress * 100)}% uploaded`)}`}
              className={`p-1 ${image.path ? 'text-green-500' : image.error ? 'text-red-500' : 'text-foreground/40'}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                role="progressbar"
                aria-label={`Image ${index + 1}: ${image.name}`}
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
                  className={!image.path && !image.error ? 'animate-pulse' : ''}
                />
              </svg>
            </span>
          ))}
          <button
            type="button"
            onClick={removeLast}
            disabled={disabled}
            title="Remove image"
            aria-label="Remove the last image"
            className="p-1 text-foreground/50 active:text-foreground disabled:opacity-40"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm-3 4-6 6m0-6 6 6"
              />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
