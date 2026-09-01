'use client';

import { useRef, useState } from 'react';
import { addToast, apiFetch } from '../../lib/api';

/**
 * Dictation straight into a textarea, transcribed by the rvoice STT server on rdzero.
 * The call goes to it directly rather than through `/api` — Caddy already answers CORS on
 * every front, so the audio takes one hop instead of two.
 */
const TRANSCRIBE_URL = 'https://rvoice-stt.zerotail.r-mulyadi.com/transcribe';

// What rvoice sends over the tailnet, and transparent to Parakeet at that rate.
const AUDIO_BITRATE = 32000;

// Opus, in the only container MediaRecorder offers for it. Chrome records WebM, Firefox Ogg.
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'];

type Phase = 'idle' | 'recording' | 'transcribing';

export function SpeakButton({
  projectId,
  onText,
}: {
  projectId: string;
  onText: (text: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);

  const transcribe = async (audio: Blob) => {
    const form = new FormData();
    form.append('file', audio, 'speech');
    form.append('language', 'en');
    form.append('autocorrect', projectId);

    const res = await apiFetch(TRANSCRIBE_URL, { method: 'POST', body: form });
    if (!res.ok) return;

    const { text } = await res.json();
    if (text.trim()) onText(text.trim());
    else addToast('Heard nothing', 'warning');
  };

  const start = async () => {
    const mimeType = MIME_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );
    if (!mimeType) {
      addToast('This browser cannot record Opus');
      return;
    }

    // The microphone is only offered on a secure origin, so `mediaDevices` itself is missing
    // on the plain-HTTP fronts — same failure to the user either way.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
    } catch {
      addToast('No microphone — allow it, and open an HTTPS front');
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: AUDIO_BITRATE,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      setPhase('transcribing');
      // apiFetch has already reported anything that went wrong; this only clears the button.
      transcribe(new Blob(chunks, { type: mimeType }))
        .catch(() => {})
        .finally(() => setPhase('idle'));
    };

    recorderRef.current = recorder;
    recorder.start();
    setPhase('recording');
  };

  if (phase === 'idle') {
    return (
      <button
        onClick={start}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-foreground/10 border border-foreground/15 active:bg-foreground/20"
      >
        <MicIcon />
        Speak
      </button>
    );
  }

  if (phase === 'recording') {
    return (
      <button
        onClick={() => recorderRef.current?.stop()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/15 text-red-500 border border-red-500/25 active:opacity-80"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        Stop
      </button>
    );
  }

  if (phase === 'transcribing') {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-foreground/10 border border-foreground/15 opacity-50"
      >
        <MicIcon />
        Transcribing...
      </button>
    );
  }

  throw new Error(`Unexpected phase: ${phase}`);
}

function MicIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm7-3a7 7 0 01-14 0m7 7v3"
      />
    </svg>
  );
}

/** Dictation lands after whatever is already typed, as one more thing said. */
export function appendSpoken(existing: string, spoken: string): string {
  if (!existing) return spoken;
  if (/\s$/.test(existing)) return existing + spoken;
  return `${existing} ${spoken}`;
}
