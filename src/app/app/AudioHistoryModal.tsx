'use client';

import { useEffect, useState } from 'react';
import { addToast } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import {
  readRecordings,
  setRecordingText,
  type Recording,
} from '@/lib/audio-history';
import { postRecording } from '@/lib/transcribe';
import { Modal } from './Modal';

type PlayableRecording = Recording & { url: string };

export function AudioHistoryModal({ onClose }: { onClose: () => void }) {
  const [recordings, setRecordings] = useState<PlayableRecording[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);

  useEffect(() => {
    let closed = false;
    let urls: string[] = [];
    readRecordings()
      .then((read) => {
        if (closed) return;
        urls = read.map((recording) => URL.createObjectURL(recording.audio));
        setRecordings(
          read.map((recording, i) => ({ ...recording, url: urls[i] }))
        );
      })
      .catch(() => setError('Could not read recordings on this device.'));
    return () => {
      closed = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const transcribe = async (recording: Recording) => {
    setTranscribingId(recording.id);
    const text = await postRecording(
      recording.audio,
      recording.projectId
    ).finally(() => setTranscribingId(null));
    if (text === null) return;
    if (!text) addToast('Heard nothing', 'warning');
    setRecordings((current) =>
      current!.map((r) => (r.id === recording.id ? { ...r, text } : r))
    );
    await setRecordingText(recording.id, text);
  };

  return (
    <Modal
      heading="Audio history"
      subtitle="Last 5 recordings on this device"
      onClose={onClose}
    >
      <div className="p-4 space-y-3">
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        {recordings?.length === 0 && (
          <p className="text-sm text-foreground/50">No recordings yet.</p>
        )}
        {recordings?.map((recording) => (
          <RecordingCard
            key={recording.id}
            recording={recording}
            transcribing={transcribingId === recording.id}
            // One POST to the STT server at a time: apiFetch refuses a second to the same URL.
            canTranscribe={transcribingId === null}
            onTranscribe={() => transcribe(recording)}
          />
        ))}
      </div>
      <div className="px-4 py-3 border-t border-foreground/10 flex justify-end">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

function RecordingCard({
  recording,
  transcribing,
  canTranscribe,
  onTranscribe,
}: {
  recording: PlayableRecording;
  transcribing: boolean;
  canTranscribe: boolean;
  onTranscribe: () => void;
}) {
  const copy = async (text: string) => {
    if (await copyText(text)) addToast('Copied text', 'success');
    else addToast('Could not copy to the clipboard');
  };

  return (
    <article className="border border-foreground/15 rounded-lg p-3 space-y-2">
      <div className="min-w-0 text-xs text-foreground/60 break-words">
        <div className="font-medium text-foreground">
          {formatDuration(recording.durationMs)}
        </div>
        <div>{recording.projectId}</div>
        <time dateTime={recording.createdAt}>
          {new Date(recording.createdAt).toLocaleString()}
        </time>
      </div>
      <audio controls src={recording.url} className="w-full h-10" />
      {recording.text === null && (
        <p className="text-sm text-foreground/50">Not transcribed.</p>
      )}
      {recording.text === '' && (
        <p className="text-sm text-foreground/50">Heard nothing.</p>
      )}
      {recording.text && (
        <p className="text-sm whitespace-pre-wrap break-words">
          {recording.text}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href={recording.url}
          download={`gitmob-recording-${recording.createdAt}.${fileExtension(recording.audio)}`}
          className="px-3 py-1.5 text-xs rounded-lg bg-foreground/10 hover:bg-foreground/20"
        >
          Download
        </a>
        {recording.text && (
          <button
            onClick={() => copy(recording.text!)}
            className="px-3 py-1.5 text-xs rounded-lg bg-foreground/10 hover:bg-foreground/20"
          >
            Copy
          </button>
        )}
        <button
          onClick={onTranscribe}
          disabled={!canTranscribe}
          className="px-3 py-1.5 text-xs rounded-lg bg-foreground/10 hover:bg-foreground/20 disabled:opacity-50"
        >
          {transcribing
            ? 'Transcribing...'
            : recording.text === null
              ? 'Transcribe'
              : 'Retranscribe'}
        </button>
      </div>
    </article>
  );
}

function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function fileExtension(audio: Blob) {
  if (audio.type.startsWith('audio/webm')) return 'webm';
  if (audio.type.startsWith('audio/ogg')) return 'ogg';
  throw new Error(`Unexpected audio type: ${audio.type}`);
}
