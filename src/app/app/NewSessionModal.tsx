'use client';

import { useState } from 'react';
import { launchDesktopSession } from '../../lib/desktop-client';
import {
  CLAUDE_MODES,
  ClaudeMode,
  DEFAULT_CLAUDE_MODE,
} from '../../lib/desktop-modes';
import { Modal } from './Modal';
import { SpeakButton, appendSpoken } from './SpeakButton';

/**
 * The one way a Claude session is started from this app — the project card's menu on the front
 * page and the Claude tab both open this. Mode, opening prompt and dictation sit behind the one
 * button, the same trade every other thing sent to a session already makes. A second composer
 * only means the two drift: the front page kept its own for a while, and it was the one without
 * a Speak button.
 */
export function NewSessionModal({
  projectId,
  canonicalId,
  onClose,
  onLaunched,
}: {
  projectId: string;
  canonicalId: string;
  onClose: () => void;
  onLaunched?: () => void;
}) {
  const [mode, setMode] = useState<ClaudeMode>(DEFAULT_CLAUDE_MODE);
  const [prompt, setPrompt] = useState('');
  const [launching, setLaunching] = useState(false);

  const launch = async () => {
    setLaunching(true);
    try {
      if (await launchDesktopSession(projectId, mode, prompt.trim())) {
        onClose();
        onLaunched?.();
      }
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Modal heading="New session" subtitle={projectId} onClose={onClose}>
      <div className="px-4 py-3 space-y-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ClaudeMode)}
          className="w-full text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2"
        >
          {CLAUDE_MODES.map((entry) => (
            <option key={entry.mode} value={entry.mode}>
              {entry.label}
            </option>
          ))}
        </select>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Opening prompt (optional)"
          className="w-full text-sm border border-foreground/20 rounded-lg px-3 py-2 bg-background resize-y"
        />
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
              disabled={launching}
              className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              {launching ? 'Starting...' : 'Start'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
