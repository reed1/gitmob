'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { addToast } from '@/lib/api';
import { saveRecording, setRecordingText } from '@/lib/audio-history';
import {
  postRecording,
  TRANSCRIBE_URL,
  transcriptionFields,
} from '@/lib/transcribe';

// What rvoice sends over the tailnet, and transparent to Parakeet at that rate.
const AUDIO_BITRATE = 32000;

// Opus, in the only container MediaRecorder offers for it. Chrome records WebM, Firefox Ogg.
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'];

// How often the recorder hands over what it has encoded, so the upload trails speech by this much.
const TIMESLICE_MS = 250;

type Phase = 'idle' | 'recording' | 'transcribing';

/**
 * Dictation straight into a textarea, transcribed by the rvoice STT server on rdzero. Every
 * recording is also kept on the device, so one the server never heard can be sent again later.
 */
export function SpeakButton({
  projectId,
  textareaRef,
  onChange,
}: {
  projectId: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A phone that dims and locks mid-sentence suspends the recorder, and the tail of what was
  // said never reaches the encoder. Hold the screen awake for as long as we are recording.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const keepScreenAwake = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLockRef.current && !wakeLockRef.current.released) return;
    // Denied while the tab is hidden or the battery is low; dictation still works, dimmed.
    wakeLockRef.current = await navigator.wakeLock
      .request('screen')
      .catch(() => null);
  };

  const letScreenSleep = () => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  };

  // The lock is dropped whenever the tab is hidden, and is not restored on its own.
  useEffect(() => {
    if (phase !== 'recording') return;
    const reacquire = () => {
      if (document.visibilityState === 'visible') keepScreenAwake();
    };
    document.addEventListener('visibilitychange', reacquire);
    return () => document.removeEventListener('visibilitychange', reacquire);
  }, [phase]);

  useEffect(() => letScreenSleep, []);

  // Nothing else in the dialog can be pressed until the recording stops, so a stray tap cannot
  // send or close it mid-sentence. Buttons already disabled are left to their own modal.
  useEffect(() => {
    if (phase !== 'recording') return;
    const dialog = buttonRef.current?.closest('[role="dialog"]');
    if (!dialog) return;
    const held = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>('button')
    ).filter((button) => button !== buttonRef.current && !button.disabled);
    for (const button of held) {
      button.disabled = true;
      button.dataset.dictationHeld = '';
    }
    return () => {
      for (const button of held) {
        button.disabled = false;
        delete button.dataset.dictationHeld;
      }
    };
  }, [phase]);

  // The streamed upload is only a head start. Whatever cut it short, the whole recording is
  // still in hand, and goes again as one plain POST that reports its own failure.
  const transcribe = async (
    audio: Blob,
    streamed: Promise<Response | null> | null
  ) => {
    const res = await streamed;
    const text = res?.ok
      ? ((await res.json()).text as string).trim()
      : await postRecording(audio, projectId);
    if (text === null) return null;

    if (text) insertAtCaret(text);
    else addToast('Heard nothing', 'warning');
    return text;
  };

  // A textarea keeps its selection after it loses focus, so this is where the caret was left
  // before Speak was tapped — or the end, where setting a textarea's value puts it.
  const insertAtCaret = (spoken: string) => {
    const textarea = textareaRef.current!;
    const { value, selectionStart, selectionEnd } = textarea;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    const trail = after && !/^\s/.test(after) ? ' ' : '';
    flushSync(() => onChange(before + lead + spoken + trail + after));
    const caret = before.length + lead.length + spoken.length;
    textarea.setSelectionRange(caret, caret);
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
    const upload = supportsRequestStreams()
      ? streamUpload(transcriptionFields(projectId), mimeType)
      : null;
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: AUDIO_BITRATE,
    });
    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      chunks.push(e.data);
      upload?.write(e.data);
    };
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      letScreenSleep();
      setPhase('transcribing');
      const audio = new Blob(chunks, { type: mimeType });
      const saved = saveRecording({
        audio,
        durationMs: Date.now() - startedAt,
        projectId,
      });
      const transcribed = transcribe(audio, upload?.finish() ?? null).finally(
        () => setPhase('idle')
      );
      Promise.all([saved, transcribed]).then(([id, text]) => {
        if (id !== null && text !== null) return setRecordingText(id, text);
      });
    };

    recorderRef.current = recorder;
    const startedAt = Date.now();
    recorder.start(TIMESLICE_MS);
    setPhase('recording');
    keepScreenAwake();
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
        ref={buttonRef}
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

/**
 * Chrome uploads a stream only over HTTP/2, which the STT front speaks. Firefox and Safari
 * would send the stream's `toString()` instead, so they record whole and POST at the end.
 */
function supportsRequestStreams() {
  let duplexAccessed = false;
  const hasContentType = new Request(location.href, {
    body: new ReadableStream(),
    method: 'POST',
    get duplex() {
      duplexAccessed = true;
      return 'half';
    },
  } as RequestInit).headers.has('Content-Type');
  return duplexAccessed && !hasContentType;
}

/**
 * Opens the transcribe POST as recording starts and feeds it the audio as it is encoded, so
 * Stop only waits for the last slice and the transcription. The multipart is written by hand,
 * fields first and the file last, since the server reads it whole only once the body ends.
 */
function streamUpload(fields: Record<string, string>, mimeType: string) {
  const boundary = `gitmob-${crypto.randomUUID()}`;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start: (c) => {
      controller = c;
    },
    cancel: () => {
      cancelled = true;
    },
  });

  const response = fetch(TRANSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
    duplex: 'half',
  } as RequestInit).catch(() => null);

  // Blob reads resolve out of order, so each waits on the one before it.
  let written = Promise.resolve();
  const write = (part: Blob) => {
    written = written.then(async () => {
      const bytes = new Uint8Array(await part.arrayBuffer());
      if (!cancelled) controller.enqueue(bytes);
    });
  };

  const head = Object.entries(fields)
    .map(
      ([name, value]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    )
    .join('');
  write(
    new Blob([
      head,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="speech"\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
    ])
  );

  return {
    write,
    finish: () => {
      write(new Blob([`\r\n--${boundary}--\r\n`]));
      written.then(() => {
        if (!cancelled) controller.close();
      });
      return response;
    },
  };
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
