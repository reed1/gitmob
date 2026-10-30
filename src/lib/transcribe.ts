'use client';

import { apiFetch } from './api';

/**
 * The rvoice STT server on rdzero. The call goes to it directly rather than through `/api` —
 * Caddy already answers CORS on every front, so the audio takes one hop instead of two.
 */
export const TRANSCRIBE_URL =
  'https://rvoice-stt.zerotail.r-mulyadi.com/transcribe';

export function transcriptionFields(projectId: string) {
  return { language: 'en', autocorrect: projectId };
}

/**
 * Sends a whole recording as one plain POST and returns the trimmed text, or null when the
 * request failed — apiFetch has already reported why.
 */
export async function postRecording(
  audio: Blob,
  projectId: string
): Promise<string | null> {
  const form = new FormData();
  for (const [name, value] of Object.entries(transcriptionFields(projectId)))
    form.append(name, value);
  form.append('file', audio, 'speech');
  const res = await apiFetch(TRANSCRIBE_URL, {
    method: 'POST',
    body: form,
  }).catch(() => null);
  if (!res?.ok) return null;
  const { text } = await res.json();
  return text.trim();
}
